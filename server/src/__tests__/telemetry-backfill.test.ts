import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { agentRuns, agents, companies, createDb, heartbeatRuns } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import {
  backfillFeedbackForApproval,
  backfillOutcomeForClosedIssue,
} from "../services/telemetry-backfill.ts";
import { logger } from "../middleware/logger.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres telemetry backfill tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("telemetry backfill", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-telemetry-backfill-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(agentRuns);
    await db.delete(heartbeatRuns);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedAgent() {
    const companyId = randomUUID();
    const agentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "CodexCoder",
      role: "engineer",
      status: "running",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    return { companyId, agentId };
  }

  async function insertRunFixture(input: {
    companyId: string;
    agentId: string;
    issueId: string;
    runId: string;
    status: "succeeded" | "failed" | "cancelled" | "timed_out";
    finishedAt: string;
    outcome?: string | null;
    userFeedback?: number | null;
  }) {
    await db.insert(heartbeatRuns).values({
      id: input.runId,
      companyId: input.companyId,
      agentId: input.agentId,
      invocationSource: "manual",
      status: input.status,
      startedAt: new Date(new Date(input.finishedAt).getTime() - 60_000),
      finishedAt: new Date(input.finishedAt),
      contextSnapshot: { issueId: input.issueId },
    });

    await db.insert(agentRuns).values({
      agent: input.agentId,
      taskClass: "general",
      outcome: input.outcome ?? null,
      userFeedback: input.userFeedback ?? null,
      latencyMs: 60_000,
      tier: null,
      heartbeatRunId: input.runId,
    });
  }

  it("maps done issues to closed on only the latest terminal run", async () => {
    const { companyId, agentId } = await seedAgent();
    const issueId = randomUUID();
    const olderRunId = randomUUID();
    const newerRunId = randomUUID();

    await insertRunFixture({
      companyId,
      agentId,
      issueId,
      runId: olderRunId,
      status: "failed",
      finishedAt: "2026-06-23T10:00:00.000Z",
    });
    await insertRunFixture({
      companyId,
      agentId,
      issueId,
      runId: newerRunId,
      status: "succeeded",
      finishedAt: "2026-06-23T11:00:00.000Z",
    });

    await backfillOutcomeForClosedIssue(db, issueId, "done");

    const rows = await db.select().from(agentRuns);
    const older = rows.find((row) => row.heartbeatRunId === olderRunId);
    const newer = rows.find((row) => row.heartbeatRunId === newerRunId);

    expect(older?.outcome).toBeNull();
    expect(newer?.outcome).toBe("closed");
  });

  it("maps cancelled issues to abandoned without overwriting existing failures", async () => {
    const { companyId, agentId } = await seedAgent();
    const mappedIssueId = randomUUID();
    const protectedIssueId = randomUUID();
    const mappedRunId = randomUUID();
    const protectedRunId = randomUUID();

    await insertRunFixture({
      companyId,
      agentId,
      issueId: mappedIssueId,
      runId: mappedRunId,
      status: "cancelled",
      finishedAt: "2026-06-23T12:00:00.000Z",
    });
    await insertRunFixture({
      companyId,
      agentId,
      issueId: protectedIssueId,
      runId: protectedRunId,
      status: "failed",
      finishedAt: "2026-06-23T13:00:00.000Z",
      outcome: "failed",
    });

    await backfillOutcomeForClosedIssue(db, mappedIssueId, "cancelled");
    await backfillOutcomeForClosedIssue(db, protectedIssueId, "cancelled");

    const rows = await db.select().from(agentRuns);
    const mapped = rows.find((row) => row.heartbeatRunId === mappedRunId);
    const protectedRow = rows.find((row) => row.heartbeatRunId === protectedRunId);

    expect(mapped?.outcome).toBe("abandoned");
    expect(protectedRow?.outcome).toBe("failed");
  });

  it("sets approval feedback to +1 and -1 on the latest terminal run", async () => {
    const { companyId, agentId } = await seedAgent();
    const issueId = randomUUID();
    const olderRunId = randomUUID();
    const newerRunId = randomUUID();

    await insertRunFixture({
      companyId,
      agentId,
      issueId,
      runId: olderRunId,
      status: "succeeded",
      finishedAt: "2026-06-23T14:00:00.000Z",
    });
    await insertRunFixture({
      companyId,
      agentId,
      issueId,
      runId: newerRunId,
      status: "succeeded",
      finishedAt: "2026-06-23T15:00:00.000Z",
    });

    await backfillFeedbackForApproval(db, issueId, "approved");
    let rows = await db.select().from(agentRuns);
    expect(rows.find((row) => row.heartbeatRunId === olderRunId)?.userFeedback).toBeNull();
    expect(rows.find((row) => row.heartbeatRunId === newerRunId)?.userFeedback).toBe(1);

    await backfillFeedbackForApproval(db, issueId, "rejected");
    rows = await db.select().from(agentRuns);
    expect(rows.find((row) => row.heartbeatRunId === newerRunId)?.userFeedback).toBe(-1);
  });

  it("swallows database errors", async () => {
    const loggerError = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const brokenDb = {
      select: () => {
        throw new Error("boom");
      },
    } as unknown as ReturnType<typeof createDb>;

    await expect(backfillOutcomeForClosedIssue(brokenDb, "issue-1", "done")).resolves.toBeUndefined();
    await expect(
      backfillFeedbackForApproval(brokenDb, "issue-1", "approved"),
    ).resolves.toBeUndefined();
    expect(loggerError).toHaveBeenCalledTimes(2);
  });
});
