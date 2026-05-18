import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { sql } from "drizzle-orm";
import { logger } from "../middleware/logger.js";
import { serverVersion } from "../version.js";

/**
 * Minimal Kubernetes-style liveness probe.
 *
 * Separate from /api/health (the rich, auth-aware status route) so that:
 *   - deploy automation has a stable, narrow contract (`ok: true`)
 *   - the probe never depends on auth middleware or actor context
 *   - the response stays small enough for tight curl-based gates
 *
 * 200: process is up and database is reachable.
 * 503: database probe failed.
 */
export function healthzRoutes(db?: Db) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const uptimeSec = Math.floor(process.uptime());

    if (!db) {
      res.json({
        ok: true,
        version: serverVersion,
        uptimeSec,
        dbReachable: false,
      });
      return;
    }

    try {
      await db.execute(sql`SELECT 1`);
    } catch (error) {
      logger.warn({ err: error }, "Liveness probe database check failed");
      res.status(503).json({
        ok: false,
        version: serverVersion,
        uptimeSec,
        dbReachable: false,
        error: "database_unreachable",
      });
      return;
    }

    res.json({
      ok: true,
      version: serverVersion,
      uptimeSec,
      dbReachable: true,
    });
  });

  return router;
}
