/**
 * Canonical infrastructure-secret loader for paperclip-server.
 *
 * This module is the **reference implementation** for loading operator-controlled
 * secrets (JWT signing keys, future DB passwords, third-party API keys, etc.) in
 * the MA monorepo. Future services should follow the same pattern instead of
 * reading `process.env.*` directly.
 *
 * Do not confuse this with `server/src/secrets/` — that directory holds the
 * per-company **user-facing** secret vault (database-backed, exposed to
 * end-users). This module loads **infrastructure** secrets that the server
 * itself needs to function (signing keys, system credentials).
 *
 * Resolution order (highest precedence first):
 *
 *   1. Any env var listed in `envKeys` whose value is non-empty after trim.
 *      First match wins. Used for local dev, CI, break-glass operation, and
 *      explicit overrides in production. Source reported as `env_var`.
 *   2. GCP Secret Manager: `projects/${projectId}/secrets/${secretName}/versions/latest`.
 *      `projectId` is resolved from `options.projectId`, then `GCP_PROJECT`,
 *      then `GOOGLE_CLOUD_PROJECT`. Source reported as `gcp_secret_manager`.
 *
 * Security & performance contract (audited surface):
 *
 *   - The resolved value is **cached in-process** for `ttlMs` (default 10
 *     minutes). We never refetch per request — that would burn Secret Manager
 *     quota and add per-request latency to every authenticated API call.
 *   - The cached value is **never logged**. Only the `name` and the `source`
 *     are exposed to callers and emitted via the optional logger.
 *   - The `@google-cloud/secret-manager` dependency is loaded via **dynamic
 *     import** so the rest of the server remains usable on hosts that have
 *     not installed the GCP SDK (CI, local dev, on-prem). A clear error is
 *     surfaced if a caller needs Secret Manager and the SDK is unavailable.
 *   - The factory + env injection seams are intended for tests only.
 *     Production code never sets them.
 *
 * Companion docs: `doc/secret-management.md`.
 */

export type InfrastructureSecretSource = "env_var" | "gcp_secret_manager";

export interface InfrastructureSecret {
  /** The secret bytes. Do NOT log this value; the audit layer logs `name` + `source` only. */
  readonly value: string;
  /** Stable secret name (matches the Secret Manager secret id in production). */
  readonly name: string;
  /** Which env var actually supplied the value, when `source === "env_var"`. */
  readonly envKeyUsed: string | null;
  readonly source: InfrastructureSecretSource;
  /** Epoch ms when this entry was fetched. */
  readonly fetchedAt: number;
}

export interface GetInfrastructureSecretOptions {
  /**
   * Env var names checked before contacting Secret Manager, in priority order.
   * Defaults to `[secretName]`. Supply multiple keys when migrating a legacy
   * secret that has historically been read from more than one env var.
   */
  envKeys?: readonly string[];
  /** GCP project id. Defaults to `GCP_PROJECT` / `GOOGLE_CLOUD_PROJECT` env. */
  projectId?: string;
  /** Override for the secret resource name (`projects/.../secrets/.../versions/latest`). */
  resourceName?: string;
  /** Cache TTL in ms. Default 10 minutes. */
  ttlMs?: number;
  /**
   * Injection seam used by tests: when provided, this function is called
   * instead of dynamically importing `@google-cloud/secret-manager`.
   * Production code never sets this.
   */
  secretManagerClientFactory?: () => Promise<SecretManagerLike>;
  /** Injection seam for `process.env`; defaults to `process.env`. */
  envOverride?: NodeJS.ProcessEnv;
}

/**
 * Minimal subset of `@google-cloud/secret-manager`'s `SecretManagerServiceClient`
 * we depend on. Keeping this narrow lets us mock it cleanly in tests and avoids
 * dragging the full SDK type surface into other call sites.
 */
export interface SecretManagerLike {
  accessSecretVersion(request: { name: string }): Promise<
    [{ payload?: { data?: string | Uint8Array | null } | null } | null]
  >;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export class InfrastructureSecretError extends Error {
  readonly code:
    | "missing_sdk"
    | "missing_project"
    | "secret_manager_failure"
    | "empty_payload"
    | "not_found";
  readonly secretName: string;
  readonly cause?: unknown;
  constructor(
    code: InfrastructureSecretError["code"],
    secretName: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "InfrastructureSecretError";
    this.code = code;
    this.secretName = secretName;
    this.cause = options?.cause;
  }
}

interface CacheEntry {
  secret: InfrastructureSecret;
  expiresAt: number;
}

/**
 * Module-level cache. Keyed by `name|projectId|resourceName` so that overriding
 * the resource name in a test does not collide with the production cache slot.
 */
const cache = new Map<string, CacheEntry>();

/** Test-only. Clears the in-process secret cache. */
export function __resetInfrastructureSecretCacheForTests(): void {
  cache.clear();
}

function cacheKey(name: string, projectId: string | null, resourceName: string | null): string {
  return `${name}|${projectId ?? ""}|${resourceName ?? ""}`;
}

async function loadDefaultSecretManagerClient(secretName: string): Promise<SecretManagerLike> {
  try {
    // Dynamic import so consumers without the GCP SDK installed don't pay the
    // cost. The package is an optional runtime dep, resolved at runtime in
    // production hosts.
    // @ts-ignore — optional runtime dependency.
    const mod = (await import("@google-cloud/secret-manager")) as unknown as {
      SecretManagerServiceClient: new () => SecretManagerLike;
    };
    return new mod.SecretManagerServiceClient();
  } catch (err) {
    throw new InfrastructureSecretError(
      "missing_sdk",
      secretName,
      "GCP Secret Manager SDK is not installed. Install `@google-cloud/secret-manager` in the " +
        `host environment, or supply ${secretName} (or a documented alias) via an environment ` +
        "variable for local development.",
      { cause: err },
    );
  }
}

/**
 * Resolves an infrastructure secret. See module header for resolution order,
 * caching contract, and security notes.
 *
 * Throws `InfrastructureSecretError` with a stable `code` on failure so callers
 * can shape user-facing messaging without parsing prose.
 */
export async function getInfrastructureSecret(
  secretName: string,
  options: GetInfrastructureSecretOptions = {},
): Promise<InfrastructureSecret> {
  if (!secretName || typeof secretName !== "string") {
    throw new InfrastructureSecretError(
      "not_found",
      String(secretName ?? ""),
      "getInfrastructureSecret(secretName): secretName is required",
    );
  }

  const env = options.envOverride ?? process.env;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const envKeys = options.envKeys ?? [secretName];
  const now = Date.now();

  // 1. Env-var fallback (local dev, break-glass, explicit override).
  for (const key of envKeys) {
    const raw = env[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      const trimmed = raw.trim();
      const cacheKeyEnv = cacheKey(secretName, null, `env_var:${key}`);
      const existing = cache.get(cacheKeyEnv);
      if (existing && existing.expiresAt > now && existing.secret.value === trimmed) {
        return existing.secret;
      }
      const secret: InfrastructureSecret = {
        value: trimmed,
        name: secretName,
        envKeyUsed: key,
        source: "env_var",
        fetchedAt: now,
      };
      cache.set(cacheKeyEnv, { secret, expiresAt: now + ttlMs });
      return secret;
    }
  }

  // 2. GCP Secret Manager.
  const projectId =
    options.projectId ?? env.GCP_PROJECT ?? env.GOOGLE_CLOUD_PROJECT ?? null;
  const resourceName =
    options.resourceName ??
    (projectId
      ? `projects/${projectId}/secrets/${secretName}/versions/latest`
      : null);

  if (!resourceName) {
    throw new InfrastructureSecretError(
      "missing_project",
      secretName,
      `Cannot fetch ${secretName}: no GCP project id available. Set GCP_PROJECT or pass ` +
        `projectId, or set one of [${envKeys.join(", ")}] to provide the value directly.`,
    );
  }

  const key = cacheKey(secretName, projectId, resourceName);
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.secret;
  }

  const factory =
    options.secretManagerClientFactory ?? (() => loadDefaultSecretManagerClient(secretName));
  let client: SecretManagerLike;
  try {
    client = await factory();
  } catch (err) {
    if (err instanceof InfrastructureSecretError) throw err;
    throw new InfrastructureSecretError(
      "secret_manager_failure",
      secretName,
      `Failed to initialize Secret Manager client: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  let response: Awaited<ReturnType<SecretManagerLike["accessSecretVersion"]>>;
  try {
    response = await client.accessSecretVersion({ name: resourceName });
  } catch (err) {
    throw new InfrastructureSecretError(
      "secret_manager_failure",
      secretName,
      `Secret Manager accessSecretVersion(${resourceName}) failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  const data = response?.[0]?.payload?.data;
  if (data == null) {
    throw new InfrastructureSecretError(
      "empty_payload",
      secretName,
      `Secret Manager returned no payload for ${resourceName}.`,
    );
  }

  const decoded = typeof data === "string" ? data : Buffer.from(data).toString("utf8");
  const trimmed = decoded.trim();
  if (trimmed.length === 0) {
    throw new InfrastructureSecretError(
      "empty_payload",
      secretName,
      `Secret Manager payload for ${resourceName} was empty after trim.`,
    );
  }

  const secret: InfrastructureSecret = {
    value: trimmed,
    name: secretName,
    envKeyUsed: null,
    source: "gcp_secret_manager",
    fetchedAt: now,
  };
  cache.set(key, { secret, expiresAt: now + ttlMs });
  return secret;
}

/**
 * Convenience wrapper that returns only the secret bytes. Use this at call
 * sites that do not need the metadata (source, fetchedAt). The audit log line,
 * if any, should still be emitted by the caller using `getInfrastructureSecret`.
 */
export async function getSecret(
  secretName: string,
  options: GetInfrastructureSecretOptions = {},
): Promise<string> {
  const { value } = await getInfrastructureSecret(secretName, options);
  return value;
}

/**
 * Eagerly populates the cache for a secret so the first authenticated request
 * doesn't pay the cold-cache cost. Safe to call from startup; swallows errors
 * by default so a Secret Manager outage at boot doesn't crash the process —
 * the first real consumer will surface the error with a real call stack.
 */
export async function prewarmInfrastructureSecret(
  secretName: string,
  options: GetInfrastructureSecretOptions & {
    onError?: (err: InfrastructureSecretError | Error) => void;
  } = {},
): Promise<InfrastructureSecret | null> {
  try {
    return await getInfrastructureSecret(secretName, options);
  } catch (err) {
    if (options.onError) options.onError(err as Error);
    return null;
  }
}
