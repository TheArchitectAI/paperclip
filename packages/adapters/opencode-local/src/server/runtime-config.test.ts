import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareOpenCodeRuntimeConfig } from "./runtime-config.js";

const cleanupPaths = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...cleanupPaths].map(async (filepath) => {
      await fs.rm(filepath, { recursive: true, force: true });
      cleanupPaths.delete(filepath);
    }),
  );
});

async function makeConfigHome(initialConfig?: Record<string, unknown>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-test-"));
  cleanupPaths.add(root);
  const configDir = path.join(root, "opencode");
  await fs.mkdir(configDir, { recursive: true });
  if (initialConfig) {
    await fs.writeFile(
      path.join(configDir, "opencode.json"),
      `${JSON.stringify(initialConfig, null, 2)}\n`,
      "utf8",
    );
  }
  return root;
}

const SAMPLE_PAPERCLIP_ENV = {
  PAPERCLIP_API_URL: "http://localhost:3100",
  PAPERCLIP_API_KEY: "secret-key-do-not-log",
  PAPERCLIP_AGENT_ID: "agent-123",
  PAPERCLIP_COMPANY_ID: "company-456",
  PAPERCLIP_RUN_ID: "run-789",
  PAPERCLIP_TASK_ID: "task-abc",
  AGENT_HOME: "/home/agent",
  // Non-paperclip vars should NOT land in the creds file.
  HOME: "/home/someone",
  PATH: "/usr/bin",
};

describe("prepareOpenCodeRuntimeConfig", () => {
  it("widens headless permission defaults and preserves user-set keys", async () => {
    const configHome = await makeConfigHome({
      permission: {
        // User explicitly chose ask for bash; that should be preserved.
        bash: "ask",
        // Pre-existing read=allow should be preserved.
        read: "allow",
      },
      theme: "system",
    });

    const prepared = await prepareOpenCodeRuntimeConfig({
      env: { XDG_CONFIG_HOME: configHome, ...SAMPLE_PAPERCLIP_ENV },
      config: {},
    });
    cleanupPaths.add(prepared.env.XDG_CONFIG_HOME);

    expect(prepared.env.XDG_CONFIG_HOME).not.toBe(configHome);
    const runtimeConfig = JSON.parse(
      await fs.readFile(
        path.join(prepared.env.XDG_CONFIG_HOME, "opencode", "opencode.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(runtimeConfig).toMatchObject({
      theme: "system",
      permission: {
        // User keys preserved.
        bash: "ask",
        read: "allow",
        // Defaults filled in.
        edit: "allow",
        write: "allow",
        webfetch: "allow",
        external_directory: "allow",
      },
    });

    await prepared.cleanup();
    cleanupPaths.delete(prepared.env.XDG_CONFIG_HOME);
    await expect(fs.access(prepared.env.XDG_CONFIG_HOME)).rejects.toThrow();
  });

  it("respects explicit opt-out for permissions but still writes the creds file", async () => {
    const configHome = await makeConfigHome();
    const prepared = await prepareOpenCodeRuntimeConfig({
      env: { XDG_CONFIG_HOME: configHome, ...SAMPLE_PAPERCLIP_ENV },
      config: { dangerouslySkipPermissions: false },
    });
    // Opt-out preserves env (no XDG_CONFIG_HOME rewrite) and skips permission injection.
    expect(prepared.env).toEqual({ XDG_CONFIG_HOME: configHome, ...SAMPLE_PAPERCLIP_ENV });
    expect(prepared.runtimeConfigDir).toBeNull();
    // But the creds file is still written (it's the primary fix; needed regardless).
    expect(prepared.credsFilePath).toBeTruthy();
    const credsContents = await fs.readFile(prepared.credsFilePath as string, "utf8");
    expect(credsContents).toContain("export PAPERCLIP_API_KEY='secret-key-do-not-log'");
    await prepared.cleanup();
  });

  it("writes a 0600 creds file containing only PAPERCLIP_* + AGENT_HOME exports", async () => {
    const configHome = await makeConfigHome();
    const prepared = await prepareOpenCodeRuntimeConfig({
      env: { XDG_CONFIG_HOME: configHome, ...SAMPLE_PAPERCLIP_ENV },
      config: {},
    });
    cleanupPaths.add(prepared.env.XDG_CONFIG_HOME);

    expect(prepared.credsFilePath).toBeTruthy();
    const credsPath = prepared.credsFilePath as string;

    const stat = await fs.stat(credsPath);
    // mode 0600 → 0o600 (mask out file-type bits).
    expect(stat.mode & 0o777).toBe(0o600);

    const contents = await fs.readFile(credsPath, "utf8");
    // Every PAPERCLIP_* var present as a quoted export.
    expect(contents).toContain("export PAPERCLIP_API_URL='http://localhost:3100'");
    expect(contents).toContain("export PAPERCLIP_API_KEY='secret-key-do-not-log'");
    expect(contents).toContain("export PAPERCLIP_AGENT_ID='agent-123'");
    expect(contents).toContain("export PAPERCLIP_COMPANY_ID='company-456'");
    expect(contents).toContain("export PAPERCLIP_RUN_ID='run-789'");
    expect(contents).toContain("export PAPERCLIP_TASK_ID='task-abc'");
    expect(contents).toContain("export AGENT_HOME='/home/agent'");

    // Non-paperclip vars (HOME, PATH, XDG_CONFIG_HOME) must NOT leak in.
    expect(contents).not.toContain("export HOME=");
    expect(contents).not.toContain("export PATH=");
    expect(contents).not.toContain("XDG_CONFIG_HOME");

    // Cleanup removes the file and its parent temp dir.
    await prepared.cleanup();
    cleanupPaths.delete(prepared.env.XDG_CONFIG_HOME);
    await expect(fs.access(credsPath)).rejects.toThrow();
  });

  it("shell-quotes values containing single quotes", async () => {
    const configHome = await makeConfigHome();
    const prepared = await prepareOpenCodeRuntimeConfig({
      env: {
        XDG_CONFIG_HOME: configHome,
        PAPERCLIP_API_KEY: "abc'def$weird",
      },
      config: { dangerouslySkipPermissions: false },
    });
    const contents = await fs.readFile(prepared.credsFilePath as string, "utf8");
    // POSIX single-quote escape: close-quote, escaped quote, reopen.
    expect(contents).toContain("export PAPERCLIP_API_KEY='abc'\\''def$weird'");
    await prepared.cleanup();
  });
});
