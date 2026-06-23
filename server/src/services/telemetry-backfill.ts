import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { type Db, agentRuns, heartbeatRuns } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

const TERMINAL_STATUSES = ["succeeded", "failed", "cancelled", "timed_out"];

async function findLatestTerminalRunIdForIssue(db: Db, issueId: string): Promise<string | null> {
  const rows = await db
    .select({ id: heartbeatRuns.id })
    .from(heartbeatRuns)
    .where(
      and(
        inArray(heartbeatRuns.status, TERMINAL_STATUSES),
        sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issueId}`,
      ),
    )
    .orderBy(sql`${heartbeatRuns.finishedAt} DESC NULLS LAST`)
    .limit(1);

  return rows[0]?.id ?? null;
}

export async function backfillOutcomeForClosedIssue(
  db: Db,
  issueId: string,
  issueStatus: string,
): Promise<void> {
  try {
    const outcome =
      issueStatus === "done" ? "closed" : issueStatus === "cancelled" ? "abandoned" : null;
    if (!outcome) return;

    const heartbeatRunId = await findLatestTerminalRunIdForIssue(db, issueId);
    if (!heartbeatRunId) return;

    await db
      .update(agentRuns)
      .set({ outcome })
      .where(and(eq(agentRuns.heartbeatRunId, heartbeatRunId), isNull(agentRuns.outcome)));
  } catch (err) {
    logger.error({ err, issueId, issueStatus }, "agent_runs outcome backfill failed (non-fatal)");
  }
}

export async function backfillFeedbackForApproval(
  db: Db,
  issueId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  try {
    const userFeedback = decision === "approved" ? 1 : -1;
    const heartbeatRunId = await findLatestTerminalRunIdForIssue(db, issueId);
    if (!heartbeatRunId) return;

    await db
      .update(agentRuns)
      .set({ userFeedback })
      .where(eq(agentRuns.heartbeatRunId, heartbeatRunId));
  } catch (err) {
    logger.error({ err, issueId, decision }, "agent_runs feedback backfill failed (non-fatal)");
  }
}
