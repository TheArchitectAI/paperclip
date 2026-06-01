import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { agentRoutes } from "../routes/agents.js";

const agentId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

const baseAgent = {
  id: agentId,
  companyId,
  name: "Communicate",
  urlKey: "communicate",
  role: "engineer",
  title: "Communications agent",
  icon: null,
  status: "idle",
  reportsTo: null,
  capabilities: null,
  adapterType: "process",
  // A real, non-empty config — the redactor MUST hide these values AND
  // also flag that the response was redacted, not legitimately empty.
  adapterConfig: { apiKey: "secret-token", endpoint: "https://example.com" },
  runtimeConfig: { workspaceCwd: "/tmp/sensitive" },
  budgetMonthlyCents: 0,
  spentMonthlyCents: 0,
  pauseReason: null,
  pausedAt: null,
  permissions: { canCreateAgents: false },
  lastHeartbeatAt: null,
  metadata: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  getChainOfCommand: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  decide: vi.fn(),
  getMembership: vi.fn(),
  listPrincipalGrants: vi.fn(),
  canUser: vi.fn(),
  hasPermission: vi.fn(),
  ensureMembership: vi.fn(),
  setPrincipalPermission: vi.fn(),
}));

const mockApprovalService = vi.hoisted(() => ({ create: vi.fn(), getById: vi.fn() }));
const mockBudgetService = vi.hoisted(() => ({ upsertPolicy: vi.fn() }));
const mockHeartbeatService = vi.hoisted(() => ({ cancelActiveForAgent: vi.fn() }));
const mockIssueApprovalService = vi.hoisted(() => ({ linkManyForApproval: vi.fn() }));
const mockIssueService = vi.hoisted(() => ({ list: vi.fn() }));
const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(),
  resolveAdapterConfigForRuntime: vi.fn(),
}));
const mockAgentInstructionsService = vi.hoisted(() => ({ materializeManagedBundle: vi.fn() }));
const mockCompanySkillService = vi.hoisted(() => ({
  listRuntimeSkillEntries: vi.fn(),
  resolveRequestedSkillKeys: vi.fn(),
}));
const mockWorkspaceOperationService = vi.hoisted(() => ({}));
const mockLogActivity = vi.hoisted(() => vi.fn());
const mockGetTelemetryClient = vi.hoisted(() => vi.fn());

vi.mock("@paperclipai/shared/telemetry", () => ({
  trackAgentCreated: vi.fn(),
  trackErrorHandlerCrash: vi.fn(),
}));

vi.mock("../telemetry.js", () => ({
  getTelemetryClient: mockGetTelemetryClient,
}));

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  agentInstructionsService: () => mockAgentInstructionsService,
  accessService: () => mockAccessService,
  approvalService: () => mockApprovalService,
  companySkillService: () => mockCompanySkillService,
  budgetService: () => mockBudgetService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  secretService: () => mockSecretService,
  syncInstructionsBundleConfigFromFilePath: vi.fn((_agent: unknown, config: unknown) => config),
  workspaceOperationService: () => mockWorkspaceOperationService,
}));

vi.mock("../services/instance-settings.js", () => ({
  instanceSettingsService: () => ({
    getGeneral: vi.fn(async () => ({ censorUsernameInLogs: false })),
  }),
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", agentRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("GET /agents/:id restricted-view redaction marker (ROC-1009)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTelemetryClient.mockReturnValue({ track: vi.fn() });
    mockAgentService.getById.mockResolvedValue(baseAgent);
    mockAgentService.getChainOfCommand.mockResolvedValue([]);
    mockAccessService.getMembership.mockResolvedValue(null);
    mockAccessService.listPrincipalGrants.mockResolvedValue([]);
  });

  it("returns explicit configRedacted:true (not adapterConfig:{}) for callers without agent_config:read", async () => {
    // Caller has company access but NO agent_config:read grant.
    mockAccessService.decide.mockResolvedValue({ allowed: false });

    const app = createApp({
      type: "board",
      userId: "restricted-board-user",
      companyIds: [companyId],
      source: "session",
      isInstanceAdmin: false,
    });

    const res = await request(app).get(`/api/agents/${agentId}`);

    expect(res.status).toBe(200);

    // The must-have: callers can distinguish redacted from legitimately empty.
    expect(res.body.configRedacted).toBe(true);

    // Sensitive shapes are nulled out (not {}, which previously aliased with "real wipe").
    expect(res.body.adapterConfig).toBeNull();
    expect(res.body.runtimeConfig).toBeNull();

    // Sanity: redacted values must not leak through.
    expect(JSON.stringify(res.body)).not.toContain("secret-token");
    expect(JSON.stringify(res.body)).not.toContain("/tmp/sensitive");

    // Non-sensitive surface still visible.
    expect(res.body.id).toBe(agentId);
    expect(res.body.companyId).toBe(companyId);
    expect(res.body.adapterType).toBe("process");
  });

  it("returns the real adapterConfig (and no configRedacted marker) when the caller has agent_config:read", async () => {
    // Caller has full grant.
    mockAccessService.decide.mockResolvedValue({ allowed: true });

    const app = createApp({
      type: "board",
      userId: "privileged-board-user",
      companyIds: [companyId],
      source: "session",
      isInstanceAdmin: false,
    });

    const res = await request(app).get(`/api/agents/${agentId}`);

    expect(res.status).toBe(200);
    expect(res.body.configRedacted).toBeUndefined();
    expect(res.body.adapterConfig).toEqual({
      apiKey: "secret-token",
      endpoint: "https://example.com",
    });
    expect(res.body.runtimeConfig).toEqual({ workspaceCwd: "/tmp/sensitive" });
  });
});
