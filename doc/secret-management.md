# Secret Management (Canonical Pattern)

Status: Reference implementation, shipped as part of [ROCAA-219](../README.md).
Module: `server/src/lib/secrets.ts`.

This document is the **single source of truth** for how paperclip-server (and
future MA services) load operator-controlled secrets at runtime.

## Scope

This pattern covers **infrastructure secrets** — credentials the server itself
needs to function: JWT signing keys, Better Auth session secrets, database
passwords, third-party API keys used by background jobs, etc.

It does **not** cover:

- **Per-company user secrets** (e.g. an API key a user uploaded for their own
  workflow). Those live in `server/src/secrets/` and are persisted in
  Postgres with a per-tenant provider abstraction.
- **Build-time configuration** (feature flags, deployment mode, host name).
  Those remain plain environment variables.

If you're unsure whether your secret is "infrastructure", ask: *is this value
read once by the server process at startup or by background workers, and would
exposing it compromise the platform itself (vs. one tenant)?* If yes, use this
pattern.

## Resolution order

`getInfrastructureSecret(secretName, options)` resolves a secret using the
first source that has a value, in this order:

1. **Environment variables** — each name in `options.envKeys` (default
   `[secretName]`) is checked in order. The first non-empty value wins.
   - Reported as `source: "env_var"`.
   - Use for local dev, CI, and break-glass overrides in production.
2. **GCP Secret Manager** — `projects/${projectId}/secrets/${secretName}/versions/latest`.
   - `projectId` resolves from `options.projectId`, then `GCP_PROJECT`, then
     `GOOGLE_CLOUD_PROJECT`.
   - Reported as `source: "gcp_secret_manager"`.
   - Used in production deployments where env vars are intentionally not set.

If neither source yields a value, an `InfrastructureSecretError` is thrown with
a stable `code` field (`missing_project`, `secret_manager_failure`,
`empty_payload`, `missing_sdk`).

## Caching & performance contract

- Resolved values are cached **in-process** for `ttlMs` (default 10 minutes).
- The cache is keyed by `secretName | projectId | resourceName`, so injecting
  a custom `resourceName` in a test does not poison the production slot.
- The cache survives across requests but is reset on process restart.
- Cached values are **never logged**. Only the secret name, source, and
  `envKeyUsed` (when applicable) are safe to emit.

This contract matters: the server's auth middleware calls
`verifyLocalAgentJwt` on **every authenticated request**. Without the cache,
each request would round-trip to Secret Manager — that's both a quota and a
latency disaster.

## Adding a new secret consumer

```ts
import { getSecret } from "../lib/secrets.js";

const value = await getSecret("MY_SECRET_NAME", {
  envKeys: ["MY_SECRET_NAME", "LEGACY_NAME"], // optional aliases
});
```

If you need metadata:

```ts
import { getInfrastructureSecret } from "../lib/secrets.js";

const { value, source, envKeyUsed } = await getInfrastructureSecret(
  "MY_SECRET_NAME",
);
logger.info({ source, envKeyUsed }, "loaded MY_SECRET_NAME");
```

For hot paths, prewarm at startup so the first request doesn't pay the cold
GCP cost:

```ts
import { prewarmInfrastructureSecret } from "../lib/secrets.js";

await prewarmInfrastructureSecret("MY_SECRET_NAME", {
  onError: (err) => logger.warn({ err: err.message }, "prewarm failed"),
});
```

## Adding the secret in production

Per ROCAA-219, the operator workflow for a new infrastructure secret is:

1. Create the secret with the same name your code passes to `getSecret(...)`:

   ```bash
   echo -n "$VALUE" | gcloud secrets create MY_SECRET_NAME \
     --replication-policy="automatic" \
     --data-file=-
   ```

2. Grant the paperclip service account read access:

   ```bash
   gcloud secrets add-iam-policy-binding MY_SECRET_NAME \
     --member="serviceAccount:paperclip@${PROJECT_ID}.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. Ensure the host has `@google-cloud/secret-manager` available. The package
   is loaded via dynamic import, so it only needs to be installed where the
   GCP path actually runs (production hosts, staging). Local dev keeps using
   env vars.

4. Roll the server. The startup banner reports `loaded from gcp_secret_manager`
   when the value came from Secret Manager, or `set (<env-var-name>)` when it
   came from the environment.

## Reference implementation: agent JWT secret

The agent JWT signing key is the first infrastructure secret to use this
pattern (ROCAA-219). Specifically:

- Secret name: `PAPERCLIP_AGENT_JWT_SECRET`
- Env aliases (backwards-compatible): `BETTER_AUTH_SECRET`
- Consumers:
  - `server/src/agent-auth-jwt.ts` (`createLocalAgentJwt`, `verifyLocalAgentJwt`)
  - `server/src/auth/better-auth.ts` (`createBetterAuthInstance`)
- Prewarm site: `server/src/index.ts` (just after auth initialization)
- Startup banner: reports `loaded from gcp_secret_manager` or `set (env)`

## Migrating an existing env-var secret

1. Add the secret to GCP Secret Manager (see "Adding the secret in production").
2. Refactor the call site to `await getSecret("SECRET_NAME", { envKeys: ["SECRET_NAME", "LEGACY_ALIAS"] })`.
3. Convert any sync callers up the chain to async — most server entry points
   already are.
4. If the secret is read on a hot path, add a `prewarmInfrastructureSecret`
   call to the startup sequence.
5. Update tests to use `__resetInfrastructureSecretCacheForTests` between
   cases and inject a fake client factory for Secret Manager paths.
6. Leave the env var alias in place for at least one release so local dev,
   CI, and rollback paths keep working.

## Testing

`server/src/lib/secrets.ts` exposes two test seams:

- `secretManagerClientFactory`: return a fake `SecretManagerLike` to assert
  request shape and inject canned responses.
- `envOverride`: pass a synthetic `process.env` instead of mutating the real
  one. Combined with `__resetInfrastructureSecretCacheForTests()` in
  `beforeEach`/`afterEach`, this keeps tests hermetic.

See `server/src/__tests__/secrets.test.ts` for worked examples covering env
fallback, cache TTL, Uint8Array decoding, and each error code.
