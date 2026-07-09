import { afterEach, describe, expect, it, vi } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { findActiveServerAdapter } from "../adapters/index.js";
import { createSeamGraph } from "../adapters/langgraph/graph.js";
import {
  execute,
  resetLangGraphAdapterDepsForTest,
  setLangGraphAdapterDepsForTest,
} from "../adapters/langgraph/execute.js";
import type { AdapterExecutionContext } from "../adapters/types.js";

const agent = {
  id: "00000000-0000-4000-8000-000000000001",
  companyId: "00000000-0000-4000-8000-000000000002",
  name: "LangGraph Seam Test",
  adapterType: "langgraph_local",
  adapterConfig: {},
};

function ctx(runId: string): AdapterExecutionContext {
  return {
    runId,
    agent,
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: "issue-1",
    },
    config: {},
    context: {
      issueId: "00000000-0000-4000-8000-000000000003",
    },
    onLog: vi.fn(async () => {}),
  };
}

describe("langgraph_local adapter", () => {
  afterEach(() => {
    resetLangGraphAdapterDepsForTest();
  });

  it("is exposed by the server adapter registry", () => {
    expect(findActiveServerAdapter("langgraph_local")?.type).toBe("langgraph_local");
  });

  it("walks interrupt, wait, and resume without rerunning prepare", async () => {
    const graph = createSeamGraph(new MemorySaver());
    const approval = {
      id: "00000000-0000-4000-8000-000000000004",
      companyId: agent.companyId,
      type: "langgraph_seam_hitl",
      requestedByAgentId: agent.id,
      requestedByUserId: null,
      status: "pending",
      payload: {},
      decisionNote: null,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = {} as never;
    const createApproval = vi.fn(async () => approval);
    const linkApproval = vi.fn(async () => {});
    const addIssueComment = vi.fn(async () => {});

    setLangGraphAdapterDepsForTest({
      getGraph: async () => graph,
      getDb: () => db,
      createApproval,
      linkApproval,
      findLatestLinkedApproval: vi.fn(async () => ({
        issueId: "00000000-0000-4000-8000-000000000003",
        approval,
      })),
      addIssueComment,
    });

    const first = await execute(ctx("00000000-0000-4000-8000-000000000011"));
    expect(first.exitCode).toBe(0);
    expect(first.resultJson).toMatchObject({
      phase: "interrupted",
      approvalId: approval.id,
      counter: 1,
    });
    expect(createApproval).toHaveBeenCalledTimes(1);
    expect(linkApproval).toHaveBeenCalledTimes(1);

    const waiting = await execute(ctx("00000000-0000-4000-8000-000000000012"));
    expect(waiting.exitCode).toBe(0);
    expect(waiting.resultJson).toMatchObject({
      phase: "waiting_hitl",
      approvalId: approval.id,
    });
    expect(createApproval).toHaveBeenCalledTimes(1);
    expect(addIssueComment).not.toHaveBeenCalled();

    approval.status = "approved";

    const complete = await execute(ctx("00000000-0000-4000-8000-000000000013"));
    expect(complete.exitCode).toBe(0);
    expect(complete.resultJson).toMatchObject({
      phase: "complete",
      approvalId: approval.id,
      counter: 1,
      decision: "approved",
    });
    expect(addIssueComment).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        body: expect.stringContaining("counter=1 (prepare did NOT re-run)"),
      }),
    );
  });
});
