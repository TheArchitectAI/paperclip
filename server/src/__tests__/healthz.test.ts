import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Db } from "@paperclipai/db";
import { healthzRoutes } from "../routes/healthz.js";
import { serverVersion } from "../version.js";

function createApp(db?: Db) {
  const app = express();
  app.use("/healthz", healthzRoutes(db));
  return app;
}

describe("GET /healthz", () => {
  it("returns ok=true when no db is wired", async () => {
    const app = createApp();

    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      version: serverVersion,
      dbReachable: false,
    });
    expect(typeof res.body.uptimeSec).toBe("number");
    expect(res.body.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it("returns ok=true with dbReachable=true when the db probe succeeds", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as Db;
    const app = createApp(db);

    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({
      ok: true,
      version: serverVersion,
      dbReachable: true,
    });
  });

  it("returns 503 with ok=false when the db probe fails", async () => {
    const db = {
      execute: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
    } as unknown as Db;
    const app = createApp(db);

    const res = await request(app).get("/healthz");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      ok: false,
      version: serverVersion,
      dbReachable: false,
      error: "database_unreachable",
    });
  });

  it("ignores actor context — no auth dependency", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as Db;
    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = { type: "none", source: "none" };
      next();
    });
    app.use("/healthz", healthzRoutes(db));

    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
