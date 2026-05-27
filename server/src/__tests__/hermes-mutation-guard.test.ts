import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { issueRoutes } from "../routes/issues.js";
import { resetHermesAgentIdCache } from "../routes/hermes-mutation-guard.js";

const HERMES_ID = "0e788ac4-f745-46bf-a5d7-751adac7fd27";
const OTHER_AGENT_ID = "11111111-1111-1111-1111-111111111111";

const mockIssueService = vi.hoisted(() => ({
  addComment: vi.fn(),
  assertCheckoutOwner: vi.fn(),
  create: vi.fn(),
  checkout: vi.fn(),
  findMentionedAgents: vi.fn(),
  getByIdentifier: vi.fn(),
  getById: vi.fn(),
  getRelationSummaries: vi.fn(),
  getWakeableParentAfterChildCompletion: vi.fn(),
  listWakeableBlockedDependents: vi.fn(),
  listAttachments: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => ({
    canUser: vi.fn(async () => true),
    hasPermission: vi.fn(async () => true),
  }),
  agentService: () => ({
    getById: vi.fn(async () => null),
  }),
  documentService: () => ({}),
  executionWorkspaceService: () => ({
    getById: vi.fn(async () => null),
  }),
  feedbackService: () => ({
    listIssueVotesForUser: vi.fn(async () => []),
    saveIssueVote: vi.fn(async () => ({ vote: null, consentEnabledNow: false, sharingEnabled: false })),
  }),
  goalService: () => ({}),
  heartbeatService: () => ({
    wakeup: vi.fn(async () => undefined),
    reportRunActivity: vi.fn(async () => undefined),
    getRun: vi.fn(async () => null),
    getActiveRunForAgent: vi.fn(async () => null),
    cancelRun: vi.fn(async () => null),
  }),
  instanceSettingsService: () => ({
    get: vi.fn(async () => ({
      id: "instance-settings-1",
      general: {
        censorUsernameInLogs: false,
        feedbackDataSharingPreference: "prompt",
      },
    })),
    listCompanyIds: vi.fn(async () => ["company-1"]),
  }),
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: vi.fn(async () => undefined),
  projectService: () => ({}),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => ({}),
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

function hermesActor() {
  return {
    type: "agent",
    agentId: HERMES_ID,
    companyId: "company-1",
    source: "agent_key",
    runId: "run-1",
  };
}

function otherAgentActor() {
  return {
    type: "agent",
    agentId: OTHER_AGENT_ID,
    companyId: "company-1",
    source: "agent_key",
    runId: "run-1",
  };
}

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: "issue-1",
    companyId: "company-1",
    status: "in_progress",
    priority: "medium",
    projectId: null,
    goalId: null,
    parentId: null,
    assigneeAgentId: HERMES_ID,
    assigneeUserId: null,
    createdByUserId: "board-user",
    identifier: "PAP-1000",
    title: "Hermes guarded",
    executionPolicy: null,
    executionState: null,
    executionWorkspaceId: null,
    checkoutRunId: "run-1",
    executionRunId: "run-1",
    executionAgentNameKey: null,
    executionLockedAt: null,
    hiddenAt: null,
    ...overrides,
  };
}

describe("hermes mutation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetHermesAgentIdCache();
    mockIssueService.addComment.mockResolvedValue(null);
    mockIssueService.create.mockResolvedValue(makeIssue());
    mockIssueService.findMentionedAgents.mockResolvedValue([]);
    mockIssueService.getByIdentifier.mockResolvedValue(null);
    mockIssueService.getRelationSummaries.mockResolvedValue({ blockedBy: [], blocks: [] });
    mockIssueService.getWakeableParentAfterChildCompletion.mockResolvedValue(null);
    mockIssueService.listWakeableBlockedDependents.mockResolvedValue([]);
    mockIssueService.assertCheckoutOwner.mockResolvedValue({ adoptedFromRunId: null });
    mockIssueService.update.mockResolvedValue(makeIssue());
    mockIssueService.listAttachments.mockResolvedValue([]);
    mockIssueService.remove.mockResolvedValue(makeIssue());
    mockIssueService.checkout.mockResolvedValue(makeIssue());
  });

  it("rejects Hermes PATCH on an issue assigned to another agent", async () => {
    mockIssueService.getById.mockResolvedValue(
      makeIssue({ assigneeAgentId: OTHER_AGENT_ID }),
    );

    const res = await request(createApp(hermesActor()))
      .patch("/api/issues/issue-1")
      .send({ status: "in_progress" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Hermes mutation guard/);
    expect(mockIssueService.update).not.toHaveBeenCalled();
  });

  it("rejects Hermes reassigning a self-owned issue to another agent", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue());

    const res = await request(createApp(hermesActor()))
      .patch("/api/issues/issue-1")
      .send({ assigneeAgentId: OTHER_AGENT_ID });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/reassign/);
    expect(mockIssueService.update).not.toHaveBeenCalled();
  });

  it("rejects Hermes changing priority of a critical issue", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue({ priority: "critical" }));

    const res = await request(createApp(hermesActor()))
      .patch("/api/issues/issue-1")
      .send({ priority: "low" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/priority/);
    expect(mockIssueService.update).not.toHaveBeenCalled();
  });

  it("rejects Hermes cancelling a self-owned issue", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue());

    const res = await request(createApp(hermesActor()))
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cancel/);
    expect(mockIssueService.update).not.toHaveBeenCalled();
  });

  it("rejects Hermes marking a goal-linked issue done", async () => {
    mockIssueService.getById.mockResolvedValue(
      makeIssue({ goalId: "goal-7" }),
    );

    const res = await request(createApp(hermesActor()))
      .patch("/api/issues/issue-1")
      .send({ status: "done" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/goal/);
    expect(mockIssueService.update).not.toHaveBeenCalled();
  });

  it("rejects Hermes deleting any issue", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue());

    const res = await request(createApp(hermesActor())).delete("/api/issues/issue-1");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/delete/);
    expect(mockIssueService.remove).not.toHaveBeenCalled();
  });

  it("rejects Hermes commenting on an issue assigned to another agent", async () => {
    mockIssueService.getById.mockResolvedValue(
      makeIssue({ assigneeAgentId: OTHER_AGENT_ID }),
    );

    const res = await request(createApp(hermesActor()))
      .post("/api/issues/issue-1/comments")
      .send({ body: "drive-by" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/comment/);
    expect(mockIssueService.addComment).not.toHaveBeenCalled();
  });

  it("rejects Hermes checking out an issue currently assigned to another agent", async () => {
    mockIssueService.getById.mockResolvedValue(
      makeIssue({ assigneeAgentId: OTHER_AGENT_ID }),
    );

    const res = await request(createApp(hermesActor()))
      .post("/api/issues/issue-1/checkout")
      .send({ agentId: HERMES_ID, expectedStatuses: ["todo"] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/checkout/);
    expect(mockIssueService.checkout).not.toHaveBeenCalled();
  });

  it("rejects Hermes creating an issue assigned to a different agent", async () => {
    const res = await request(createApp(hermesActor()))
      .post("/api/companies/company-1/issues")
      .send({ title: "spam", assigneeAgentId: OTHER_AGENT_ID });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/create issues assigned/);
    expect(mockIssueService.create).not.toHaveBeenCalled();
  });

  it("does not affect non-Hermes agents performing the same mutations", async () => {
    mockIssueService.getById.mockResolvedValue(
      makeIssue({
        assigneeAgentId: OTHER_AGENT_ID,
        checkoutRunId: "run-1",
        executionRunId: "run-1",
      }),
    );

    const res = await request(createApp(otherAgentActor()))
      .patch("/api/issues/issue-1")
      .send({ status: "in_progress" });

    // Guard should not intercept; other authz layers may still allow or
    // deny. We only assert the Hermes-specific guard didn't fire.
    expect(res.body.error ?? "").not.toMatch(/Hermes mutation guard/);
  });
});
