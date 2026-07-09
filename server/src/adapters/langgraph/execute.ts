import { and, desc, eq } from "drizzle-orm";
import {
  INTERRUPT,
  isInterrupted,
  type Interrupt,
  type StateSnapshot,
} from "@langchain/langgraph";
import type { Db } from "@paperclipai/db";
import { approvals, createDb, issueApprovals } from "@paperclipai/db";
import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { approvalService } from "../../services/approvals.js";
import { issueService } from "../../services/issues.js";
import {
  Command,
  createInitialSeamState,
  getSeamGraph,
  HITL_QUESTION,
  type SeamDecision,
  type SeamGraph,
  type SeamState,
} from "./graph.js";

export const LANGGRAPH_APPROVAL_TYPE = "langgraph_seam_hitl";

type ApprovalRecord = typeof approvals.$inferSelect;

type LatestLinkedApproval = {
  approval: ApprovalRecord;
  issueId: string;
};

export type LangGraphAdapterDeps = {
  getGraph: () => Promise<SeamGraph>;
  getDb: (ctx: AdapterExecutionContext) => Db;
  createApproval: (
    db: Db,
    input: {
      companyId: string;
      agentId: string;
      question: string;
      threadId: string;
      runId: string;
    },
  ) => Promise<ApprovalRecord>;
  linkApproval: (
    db: Db,
    input: {
      companyId: string;
      issueId: string;
      approvalId: string;
      agentId: string;
    },
  ) => Promise<void>;
  findLatestLinkedApproval: (
    db: Db,
    input: {
      companyId: string;
      issueId: string;
    },
  ) => Promise<LatestLinkedApproval | null>;
  addIssueComment: (
    db: Db,
    input: {
      issueId: string;
      body: string;
      agentId: string;
      runId: string;
    },
  ) => Promise<void>;
};

let cachedDb: Db | null = null;

function getDefaultDb(ctx: AdapterExecutionContext): Db {
  if (ctx.db) return ctx.db as Db;
  if (cachedDb) return cachedDb;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for langgraph_local persistence");
  }
  cachedDb = createDb(databaseUrl);
  return cachedDb;
}

const defaultDeps: LangGraphAdapterDeps = {
  getGraph: getSeamGraph,
  getDb: getDefaultDb,
  createApproval: async (db, input) =>
    approvalService(db).create(input.companyId, {
      type: LANGGRAPH_APPROVAL_TYPE,
      requestedByAgentId: input.agentId,
      requestedByUserId: null,
      status: "pending",
      payload: {
        title: "P3a Phase-2 LangGraph seam HITL",
        question: input.question,
        threadId: input.threadId,
        runId: input.runId,
      },
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
    }),
  linkApproval: async (db, input) => {
    await db.insert(issueApprovals).values({
      companyId: input.companyId,
      issueId: input.issueId,
      approvalId: input.approvalId,
      linkedByAgentId: input.agentId,
      linkedByUserId: null,
    });
  },
  findLatestLinkedApproval: async (db, input) => {
    const row = await db
      .select({
        issueId: issueApprovals.issueId,
        approval: approvals,
      })
      .from(issueApprovals)
      .innerJoin(approvals, eq(issueApprovals.approvalId, approvals.id))
      .where(
        and(
          eq(issueApprovals.companyId, input.companyId),
          eq(issueApprovals.issueId, input.issueId),
          eq(approvals.companyId, input.companyId),
          eq(approvals.type, LANGGRAPH_APPROVAL_TYPE),
        ),
      )
      .orderBy(desc(issueApprovals.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return row ? { approval: row.approval, issueId: row.issueId } : null;
  },
  addIssueComment: async (db, input) => {
    await issueService(db).addComment(input.issueId, input.body, {
      agentId: input.agentId,
      runId: input.runId,
    });
  },
};

let deps: LangGraphAdapterDeps = defaultDeps;

export function setLangGraphAdapterDepsForTest(overrides: Partial<LangGraphAdapterDeps>): void {
  deps = { ...defaultDeps, ...overrides };
}

export function resetLangGraphAdapterDepsForTest(): void {
  deps = defaultDeps;
}

function ok(resultJson: Record<string, unknown>): AdapterExecutionResult {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    resultJson,
  };
}

function fail(message: string): AdapterExecutionResult {
  return {
    exitCode: 1,
    signal: null,
    timedOut: false,
    errorMessage: message,
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readSeamState(value: unknown): Partial<SeamState> {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const state: Partial<SeamState> = {};
  if (typeof record.counter === "number") state.counter = record.counter;
  if (typeof record.decision === "string" || record.decision === null) {
    state.decision = record.decision;
  }
  if (Array.isArray(record.log)) {
    state.log = record.log.filter((entry) => typeof entry === "string");
  }
  return state;
}

function extractInterruptQuestion(result: unknown, snapshot: StateSnapshot): string | null {
  const interrupts = isInterrupted<{ question?: unknown }>(result)
    ? result[INTERRUPT]
    : snapshot.tasks.flatMap((task) => task.interrupts as Interrupt<{ question?: unknown }>[]);
  for (const item of interrupts) {
    const question = item.value?.question;
    if (typeof question === "string" && question.trim()) return question;
  }
  return null;
}

function isPendingInterrupt(snapshot: StateSnapshot): boolean {
  return snapshot.next.includes("hitl") || snapshot.tasks.some((task) => task.interrupts.length > 0);
}

function approvalDecision(approval: ApprovalRecord): SeamDecision | null {
  if (approval.status === "approved") return "approved";
  if (approval.status === "rejected") return "rejected";
  return null;
}

function completeComment(input: {
  counter: number;
  decision: SeamDecision;
  threadId: string;
}): string {
  return `P3a seam round-trip COMPLETE: counter=${input.counter} (prepare did NOT re-run), decision=${input.decision}, thread=${input.threadId}`;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, context, onLog } = ctx;

  try {
    const issueId = readString(context.issueId);
    const threadId = issueId ?? runId;
    if (!issueId) {
      await onLog(
        "stderr",
        "[langgraph_local] context.issueId missing; falling back to runId for thread_id\n",
      );
    }

    const graph = await deps.getGraph();
    const db = deps.getDb(ctx);
    const config = { configurable: { thread_id: threadId } };
    const before = await graph.getState(config);
    const beforeValues = readSeamState(before.values);

    await onLog(
      "stdout",
      `[langgraph_local] thread=${threadId} checkpoint=${before.next.length > 0 || Object.keys(beforeValues).length > 0 ? "present" : "missing"}\n`,
    );

    if (before.next.length === 0 && Object.keys(beforeValues).length === 0) {
      const result = await graph.invoke(createInitialSeamState(), config);
      const after = await graph.getState(config);
      const afterValues = readSeamState(after.values);
      const question = extractInterruptQuestion(result, after) ?? HITL_QUESTION;

      if (!isPendingInterrupt(after)) {
        return fail("LangGraph seam expected an interrupt after first invoke");
      }
      if (!issueId) {
        return fail("LangGraph seam interrupted without context.issueId; cannot create issue approval link");
      }

      const approval = await deps.createApproval(db, {
        companyId: agent.companyId,
        agentId: agent.id,
        question,
        threadId,
        runId,
      });
      await deps.linkApproval(db, {
        companyId: agent.companyId,
        issueId,
        approvalId: approval.id,
        agentId: agent.id,
      });

      await onLog(
        "stdout",
        `[langgraph_local] interrupted; approval=${approval.id} counter=${afterValues.counter ?? null}\n`,
      );

      return ok({
        phase: "interrupted",
        approvalId: approval.id,
        threadId,
        counter: afterValues.counter ?? null,
      });
    }

    if (!isPendingInterrupt(before)) {
      return ok({
        phase: "already_complete",
        threadId,
        counter: beforeValues.counter ?? null,
        decision: beforeValues.decision ?? null,
      });
    }

    if (!issueId) {
      return fail("LangGraph seam has a pending interrupt but context.issueId is missing");
    }

    const linked = await deps.findLatestLinkedApproval(db, {
      companyId: agent.companyId,
      issueId,
    });
    if (!linked) {
      return fail("LangGraph seam has a pending interrupt but no linked approval was found");
    }

    if (linked.approval.status === "pending" || linked.approval.status === "revision_requested") {
      await onLog(
        "stdout",
        `[langgraph_local] waiting for HITL approval=${linked.approval.id}; graph not re-invoked\n`,
      );
      return ok({
        phase: "waiting_hitl",
        approvalId: linked.approval.id,
        threadId,
      });
    }

    const decision = approvalDecision(linked.approval);
    if (!decision) {
      return fail(`Unsupported LangGraph seam approval status: ${linked.approval.status}`);
    }

    const result = await graph.invoke(new Command({ resume: decision }), config);
    const values = readSeamState(result);
    const counter = values.counter;
    if (counter !== 1) {
      return fail(`LangGraph seam counter invariant failed: expected 1, got ${counter ?? "null"}`);
    }

    await deps.addIssueComment(db, {
      issueId,
      body: completeComment({ counter, decision, threadId }),
      agentId: agent.id,
      runId,
    });

    await onLog(
      "stdout",
      `[langgraph_local] complete; approval=${linked.approval.id} counter=${counter} decision=${decision}\n`,
    );

    return ok({
      phase: "complete",
      approvalId: linked.approval.id,
      threadId,
      counter,
      decision,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
