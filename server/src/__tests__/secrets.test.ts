import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetInfrastructureSecretCacheForTests,
  getInfrastructureSecret,
  getSecret,
  InfrastructureSecretError,
  prewarmInfrastructureSecret,
  type SecretManagerLike,
} from "../lib/secrets.js";

describe("getInfrastructureSecret", () => {
  beforeEach(() => {
    __resetInfrastructureSecretCacheForTests();
  });

  afterEach(() => {
    __resetInfrastructureSecretCacheForTests();
    vi.useRealTimers();
  });

  it("returns the env var value when set, marking source=env_var", async () => {
    const result = await getInfrastructureSecret("PAPERCLIP_AGENT_JWT_SECRET", {
      envOverride: { PAPERCLIP_AGENT_JWT_SECRET: "from-env" },
    });
    expect(result.value).toBe("from-env");
    expect(result.source).toBe("env_var");
    expect(result.envKeyUsed).toBe("PAPERCLIP_AGENT_JWT_SECRET");
  });

  it("trims env var values and ignores empty/whitespace-only entries", async () => {
    const result = await getInfrastructureSecret("X", {
      envKeys: ["X", "Y"],
      envOverride: { X: "   ", Y: "  real  " },
    });
    expect(result.value).toBe("real");
    expect(result.envKeyUsed).toBe("Y");
  });

  it("uses the first non-empty env key in priority order", async () => {
    const result = await getInfrastructureSecret("PRIMARY", {
      envKeys: ["PRIMARY", "FALLBACK"],
      envOverride: { PRIMARY: "first-wins", FALLBACK: "should-not-be-used" },
    });
    expect(result.value).toBe("first-wins");
    expect(result.envKeyUsed).toBe("PRIMARY");
  });

  it("falls back to GCP Secret Manager when no env vars are set", async () => {
    const access = vi.fn().mockResolvedValue([{ payload: { data: "gcp-value" } }]);
    const result = await getInfrastructureSecret("MY_SECRET", {
      envOverride: { GCP_PROJECT: "test-project" },
      secretManagerClientFactory: async () => ({ accessSecretVersion: access }) as SecretManagerLike,
    });
    expect(result.value).toBe("gcp-value");
    expect(result.source).toBe("gcp_secret_manager");
    expect(access).toHaveBeenCalledWith({
      name: "projects/test-project/secrets/MY_SECRET/versions/latest",
    });
  });

  it("caches resolved values for ttlMs and reuses them on subsequent calls", async () => {
    const access = vi.fn().mockResolvedValue([{ payload: { data: "cached-value" } }]);
    const factory = vi.fn(async () => ({ accessSecretVersion: access }) as SecretManagerLike);
    const opts = {
      envOverride: { GCP_PROJECT: "test-project" },
      secretManagerClientFactory: factory,
      ttlMs: 60_000,
    };

    const first = await getInfrastructureSecret("CACHED", opts);
    const second = await getInfrastructureSecret("CACHED", opts);
    expect(first.value).toBe("cached-value");
    expect(second.value).toBe("cached-value");
    expect(access).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("refetches after TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const access = vi
      .fn()
      .mockResolvedValueOnce([{ payload: { data: "first" } }])
      .mockResolvedValueOnce([{ payload: { data: "second" } }]);
    const opts = {
      envOverride: { GCP_PROJECT: "test-project" },
      secretManagerClientFactory: async () => ({ accessSecretVersion: access }) as SecretManagerLike,
      ttlMs: 1000,
    };

    const first = await getInfrastructureSecret("ROTATING", opts);
    expect(first.value).toBe("first");

    vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z"));
    const second = await getInfrastructureSecret("ROTATING", opts);
    expect(second.value).toBe("second");
  });

  it("throws missing_project when no env vars and no projectId/resourceName", async () => {
    await expect(
      getInfrastructureSecret("NOPE", {
        envOverride: {},
      }),
    ).rejects.toMatchObject({
      name: "InfrastructureSecretError",
      code: "missing_project",
      secretName: "NOPE",
    });
  });

  it("throws empty_payload when Secret Manager returns no data", async () => {
    await expect(
      getInfrastructureSecret("EMPTY", {
        envOverride: { GCP_PROJECT: "p" },
        secretManagerClientFactory: async () => ({
          accessSecretVersion: async () => [{ payload: { data: null } }],
        } as SecretManagerLike),
      }),
    ).rejects.toMatchObject({ code: "empty_payload" });
  });

  it("throws empty_payload when payload trims to empty", async () => {
    await expect(
      getInfrastructureSecret("BLANK", {
        envOverride: { GCP_PROJECT: "p" },
        secretManagerClientFactory: async () => ({
          accessSecretVersion: async () => [{ payload: { data: "   \n  " } }],
        } as SecretManagerLike),
      }),
    ).rejects.toMatchObject({ code: "empty_payload" });
  });

  it("wraps Secret Manager failures with secret_manager_failure code", async () => {
    await expect(
      getInfrastructureSecret("BAD", {
        envOverride: { GCP_PROJECT: "p" },
        secretManagerClientFactory: async () => ({
          accessSecretVersion: async () => {
            throw new Error("PERMISSION_DENIED");
          },
        } as SecretManagerLike),
      }),
    ).rejects.toMatchObject({
      code: "secret_manager_failure",
      secretName: "BAD",
    });
  });

  it("decodes Uint8Array payloads from Secret Manager", async () => {
    const result = await getInfrastructureSecret("BINARY", {
      envOverride: { GCP_PROJECT: "p" },
      secretManagerClientFactory: async () => ({
        accessSecretVersion: async () => [
          { payload: { data: Buffer.from("binary-value", "utf8") } },
        ],
      } as SecretManagerLike),
    });
    expect(result.value).toBe("binary-value");
  });

  it("getSecret returns only the value", async () => {
    const value = await getSecret("X", {
      envOverride: { X: "raw" },
    });
    expect(value).toBe("raw");
  });

  it("prewarmInfrastructureSecret swallows errors and invokes onError", async () => {
    const onError = vi.fn();
    const result = await prewarmInfrastructureSecret("PREWARM", {
      envOverride: {},
      onError,
    });
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as InfrastructureSecretError;
    expect(err.code).toBe("missing_project");
  });

  it("prewarmInfrastructureSecret returns the secret on success and caches it", async () => {
    const access = vi.fn().mockResolvedValue([{ payload: { data: "warm" } }]);
    const opts = {
      envOverride: { GCP_PROJECT: "p" },
      secretManagerClientFactory: async () => ({ accessSecretVersion: access }) as SecretManagerLike,
    };
    const warmed = await prewarmInfrastructureSecret("WARMED", opts);
    expect(warmed?.value).toBe("warm");
    const again = await getInfrastructureSecret("WARMED", opts);
    expect(again.value).toBe("warm");
    expect(access).toHaveBeenCalledTimes(1);
  });
});
