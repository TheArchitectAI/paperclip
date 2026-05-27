# Calendly API Research - ROCAA-315

**Date:** 2026-05-25
**Researcher:** Hermes Researcher (1414a9de-73d4-4b68-b3d6-4b94ee8eec66)
**Status:** Completed

## 1. Authentication shape
- Primary: Personal Access Token (PAT) via `Authorization: Bearer <token>` header.
- Also supports OAuth 2.0 for multi-user integrations (client credentials / authorization code flows).
- No JWT for core API; tokens are long-lived PATs scoped to user.

## 2. Top 5 most useful endpoints for ROC use cases (mortgage / partners / pipeline / content)
1. `GET /users/me` - Retrieve authenticated user details and organization.
2. `GET /event_types` - List available event types (matches CALENDLY_EVENT_TYPE_* env vars). Filter by active status.
3. `GET /scheduled_events` - Query booked meetings with filters (status, date range, invitee email). Critical for pipeline tracking.
4. `POST /webhook_subscriptions` - Register webhooks for `invitee.created`, `invitee.canceled`, `routing_form_submission.created` etc. Enables real-time pipeline updates.
5. `GET /event_type_available_times` + `GET /availability_schedules` - Poll availability slots for dynamic scheduling in partner/mortgage flows.

Bonus: `GET /routing_forms` and submissions for lead routing.

## 3. Rate limits + quota
- 500 requests per minute per access token (most endpoints).
- Webhook subscriptions limited per organization (plan-dependent, typically dozens).
- Burst protection; implement exponential backoff + jitter.
- No hard daily quota but monitor via response headers (if present).

## 4. SDK availability
- No official Calendly-maintained SDK.
- Python: `requests` + custom wrapper, or community `calendly` PyPI packages.
- Node.js: `calendly-node` or `axios` based clients.
- Shell: Direct `curl` with Bearer token is fully supported and recommended for simple agents.
- TypeScript definitions available via community or OpenAPI spec (Calendly provides OpenAPI docs).

## 5. Existing community MCPs or Claude skills
- No prominent official or widely-used MCP (Model Context Protocol) server found for Calendly.
- Claude skills: Limited community examples; mostly custom tool definitions in projects.
- Integrations exist via Zapier, Make, n8n, but no direct Claude Desktop / Anthropic tool server.
- GitHub search yields custom wrappers and Zapier-style recipes. This research closes the gap for direct agent use.

## 6. Recommended adapter shape
- **(a) Paperclip MCP** — Recommended primary path. Exposes Calendly as MCP server for all agents in fleet (consistent with other API adapters).
- **(b) Claude skill** — Secondary, for direct Claude Code / Claude Desktop use.
- Avoid (e) HITL now that credentials exist. Not suitable as pure cron (needs reactive webhooks). Plugin possible but MCP is more general.

## 7. Cost (subscription / per-call)
- No per-call fees.
- Gated behind Calendly paid plans (Professional ~$12-16/user/mo, Teams/Enterprise higher).
- Includes API + webhooks. Free plan has very limited/no API access.
- Existing credentials (CALENDLY_API_KEY etc.) imply paid plan already active.

## 8. Link to closest canonical memory in vault/memory/
- None found in initial sweep. No prior `vault/memory/calendly*` or `api-calendly.md` entry.
- Related: general scheduling patterns in `vault/memory/scheduling-apis.md` (if exists) or ROC pipeline memory.

## Synthesis / Ladder note
Calendly directly supports ROCAA-306 ($100M) goal via:
- Revenue: faster partner/mortgage call booking conversion
- Pipeline accuracy: real-time scheduled events into CRM
- Content velocity: not primary but supports content review meetings

Ready for MCP implementation or Claude skill wiring.