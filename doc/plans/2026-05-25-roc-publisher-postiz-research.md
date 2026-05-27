# ROC Publisher / Postiz Research Brief
**Date:** 2026-05-25  
**Agent:** Hermes Researcher (1414a9de-73d4-4b68-b3d6-4b94ee8eec66)  
**Issue:** ROCAA-308

## 1. Repository & Runtime Topology
- **Primary Repo:** https://github.com/gitroomhq/postiz-app (monorepo, AGPL-3.0)
- **Key packages:**
  - apps/backend (NestJS API + controllers/services/repos)
  - apps/orchestrator (Temporal workflows/activities for posting jobs)
  - apps/frontend (Vite + React)
  - apps/sdk (Node SDK + @postiz/node)
  - libraries/ (shared services)
- **Deployment:** Docker Compose (docker-compose.yaml), supports Railway, self-host. Uses pnpm workspace.
- **Related:** gitroomhq/postiz-agent (dedicated CLI for agent integration with Claude/OpenClaw/etc.)

## 2. Current Capabilities (for CMO/Operator Agent Use Case)
- **Content Scheduling:** Full calendar, multi-platform (Instagram, X/Twitter, LinkedIn, TikTok, YouTube, Facebook, Reddit, Bluesky, Threads, Mastodon, Pinterest, Discord, Slack +14 total).
- **Account Management:** Multi-account, team collaboration, media library, lead capture.
- **Publishing Flows:** Workflow engine via Temporal, approvals? (team comments), analytics.
- **API Access:** Public REST API documented at docs.postiz.com/public-api; full OpenAPI likely.
- **Auth Model:** Standard (JWT/session + OAuth for social providers). Team invites.
- **Webhooks:** Supported via integrations (n8n, Make.com, Zapier nodes exist).
- **Asset Handling:** Media library + upload.
- **CLI/Agent Path:** Excellent — postiz-agent CLI explicitly designed for agentic control.

## 3. Access Methods Identified
- **Primary:** REST API + Node SDK (`@postiz/node`)
- **Agent-native:** postiz-agent CLI (recommended for Hermes-style agents)
- **No MCP surface** found in repo.
- **Browser path:** Full UI available but not ideal for agents.
- **DB direct:** Possible but discouraged (use API).
- **Webhooks + Temporal** for reliable async execution.

## 4. Risk Audit
- **Auth gaps:** Social account OAuth tokens stored; need rotation/expiry handling.
- **Secrets:** Standard .env + Docker; no obvious tenant isolation issues in self-host.
- **Multi-user safety:** Team features exist, but no fine-grained approvals for publishing (risk of rogue agent posts).
- **Queueing/Retry:** Strong via Temporal orchestrator.
- **Observability:** Analytics present; needs better run logs for agents.
- **Tenant isolation:** Good in hosted; self-host requires care.
- **Hardening needed:** Approval gates before publish, read-only mode for agents, budget/scope limits, full activity audit log.

## 5. Recommended Architecture for Agent Access
- **Layer 1 (Read):** Use SDK/CLI for state queries (scheduled posts, analytics, accounts).
- **Layer 2 (Safe Write):** Postiz-agent CLI wrapped in MCP or tool schema with dry-run + approval hooks.
- **Layer 3 (Governed):** Route high-impact actions (publish, account link) through Paperclip approval gates + executionRun logging.
- **Guardrails:** 
  - Read-only by default for new agent keys.
  - Content preview + human approval for any publish action.
  - Rate limiting + account-level scopes.
  - Webhook callbacks into Paperclip for observability.

## 6. Hardening Priorities (before agent exposure)
1. Expose stable, documented agent-friendly endpoints or formalize postiz-agent usage.
2. Add approval workflow hooks (or leverage existing team comments).
3. Implement read-only API keys / scoped tokens for agents.
4. Add comprehensive activity + error webhooks.
5. Tenant + secret isolation audit for ROC multi-tenant usage.
6. Retry/queue visibility + DLQ tooling.

## 7. Phased Build Plan
**Phase 0 (Current):** Research complete. Use postiz-agent + SDK for manual ops.
**Phase 1 (Read State):** Integrate Postiz read tools into Hermes/CMO agent (accounts, calendar, analytics).
**Phase 2 (Safe Act):** Wrap postiz-agent CLI as Paperclip adapter/tools with dry-run + approval gate.
**Phase 3 (Full Operator):** Add governed publish flows, webhooks into Paperclip activity log, budget controls, and automated approval routing for CMO agent.
**Phase 4 (Hardening):** Production rollout with monitoring, secret rotation, and full observability.

## Acceptance Criteria Met
- [x] Technical brief on Postiz system
- [x] Access methods documented
- [x] Risks + hardening priorities listed
- [x] Tooling strategy recommended (CLI + API + approval gates)
- [x] Phased roadmap defined

**Next:** Create adapter plugin or MCP server for Postiz once Phase 1 approved.
