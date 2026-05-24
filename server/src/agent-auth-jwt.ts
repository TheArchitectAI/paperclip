import { createHmac, timingSafeEqual } from "node:crypto";

import {
  getSecret,
  prewarmInfrastructureSecret,
  type GetInfrastructureSecretOptions,
  type InfrastructureSecretError,
} from "./lib/secrets.js";

interface JwtHeader {
  alg: string;
  typ?: string;
}

export interface LocalAgentJwtClaims {
  sub: string;
  company_id: string;
  adapter_type: string;
  run_id: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
  jti?: string;
}

const JWT_ALGORITHM = "HS256";

export const AGENT_JWT_SECRET_NAME = "PAPERCLIP_AGENT_JWT_SECRET";

/**
 * Env vars that may supply the JWT signing secret. Listed in priority order.
 * `BETTER_AUTH_SECRET` is honored for backwards compatibility with deployments
 * that share the signing key between agent JWTs and Better Auth sessions.
 */
const AGENT_JWT_ENV_KEYS = [
  AGENT_JWT_SECRET_NAME,
  "BETTER_AUTH_SECRET",
] as const;

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function staticJwtConfig() {
  return {
    ttlSeconds: parseNumber(process.env.PAPERCLIP_AGENT_JWT_TTL_SECONDS, 60 * 60 * 48),
    issuer: process.env.PAPERCLIP_AGENT_JWT_ISSUER ?? "paperclip",
    audience: process.env.PAPERCLIP_AGENT_JWT_AUDIENCE ?? "paperclip-api",
  };
}

/** Test-only: lets a test inject a fake secret resolver / env override. */
let secretOptionsOverride: GetInfrastructureSecretOptions | null = null;

export function __setAgentJwtSecretOptionsForTests(
  options: GetInfrastructureSecretOptions | null,
): void {
  secretOptionsOverride = options;
}

async function resolveAgentJwtSecret(): Promise<string | null> {
  try {
    return await getSecret(AGENT_JWT_SECRET_NAME, {
      ...(secretOptionsOverride ?? {}),
      envKeys: AGENT_JWT_ENV_KEYS,
    });
  } catch {
    // Surface as "no JWT configured" — callers already handle null by
    // returning null tokens / failing verification, which matches the
    // pre-refactor behavior when env vars were unset.
    return null;
  }
}

/**
 * Eagerly populates the secret cache. Call once at server startup so the first
 * authenticated request does not pay the Secret Manager cold-cache cost.
 */
export async function prewarmAgentJwtSecret(
  onError?: (err: InfrastructureSecretError | Error) => void,
): Promise<void> {
  await prewarmInfrastructureSecret(AGENT_JWT_SECRET_NAME, {
    ...(secretOptionsOverride ?? {}),
    envKeys: AGENT_JWT_ENV_KEYS,
    ...(onError ? { onError } : {}),
  });
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(secret: string, signingInput: string) {
  return createHmac("sha256", secret).update(signingInput).digest("base64url");
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createLocalAgentJwt(
  agentId: string,
  companyId: string,
  adapterType: string,
  runId: string,
): Promise<string | null> {
  const secret = await resolveAgentJwtSecret();
  if (!secret) return null;
  const config = staticJwtConfig();

  const now = Math.floor(Date.now() / 1000);
  const claims: LocalAgentJwtClaims = {
    sub: agentId,
    company_id: companyId,
    adapter_type: adapterType,
    run_id: runId,
    iat: now,
    exp: now + config.ttlSeconds,
    iss: config.issuer,
    aud: config.audience,
  };

  const header: JwtHeader = {
    alg: JWT_ALGORITHM,
    typ: "JWT",
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
  const signature = signPayload(secret, signingInput);

  return `${signingInput}.${signature}`;
}

export async function verifyLocalAgentJwt(token: string): Promise<LocalAgentJwtClaims | null> {
  if (!token) return null;
  const secret = await resolveAgentJwtSecret();
  if (!secret) return null;
  const config = staticJwtConfig();

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, claimsB64, signature] = parts;

  const header = parseJson(base64UrlDecode(headerB64));
  if (!header || header.alg !== JWT_ALGORITHM) return null;

  const signingInput = `${headerB64}.${claimsB64}`;
  const expectedSig = signPayload(secret, signingInput);
  if (!safeCompare(signature, expectedSig)) return null;

  const claims = parseJson(base64UrlDecode(claimsB64));
  if (!claims) return null;

  const sub = typeof claims.sub === "string" ? claims.sub : null;
  const companyId = typeof claims.company_id === "string" ? claims.company_id : null;
  const adapterType = typeof claims.adapter_type === "string" ? claims.adapter_type : null;
  const runId = typeof claims.run_id === "string" ? claims.run_id : null;
  const iat = typeof claims.iat === "number" ? claims.iat : null;
  const exp = typeof claims.exp === "number" ? claims.exp : null;
  if (!sub || !companyId || !adapterType || !runId || !iat || !exp) return null;

  const now = Math.floor(Date.now() / 1000);
  if (exp < now) return null;

  const issuer = typeof claims.iss === "string" ? claims.iss : undefined;
  const audience = typeof claims.aud === "string" ? claims.aud : undefined;
  if (issuer && issuer !== config.issuer) return null;
  if (audience && audience !== config.audience) return null;

  return {
    sub,
    company_id: companyId,
    adapter_type: adapterType,
    run_id: runId,
    iat,
    exp,
    ...(issuer ? { iss: issuer } : {}),
    ...(audience ? { aud: audience } : {}),
    jti: typeof claims.jti === "string" ? claims.jti : undefined,
  };
}
