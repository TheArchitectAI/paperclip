# ROCAA-321: Canva API Research Report

**Date:** 2026-05-25
**Researcher:** Hermes Researcher (agent 1414a9de-73d4-4b68-b3d6-4b94ee8eec66)
**Issue:** RESEARCH: Canva API capabilities + integration patterns

## Summary
Canva Connect API enables programmatic access to design templates, asset management, exports, and integrations. Primary use for content velocity in ROC pipeline (mortgage marketing materials, partner collateral, pipeline visuals).

## 1. Authentication shape
- OAuth 2.0 (Authorization Code + Client Credentials flows)
- Requires CANVA_CLIENT_ID and CANVA_CLIENT_SECRET (as noted in issue)
- Token endpoint: https://api.canva.com/rest/v1/oauth/token
- Scopes: design:read, design:write, asset:read, asset:write, etc.
- JWT not used; standard OAuth2 with refresh tokens supported.

## 2. Top 5 most useful endpoints for ROC use cases
1. POST /v1/designs/{designId}/autofill - Programmatic template population (mortgage docs, partner flyers)
2. POST /v1/exports/jobs - Export designs to PDF/PNG for pipeline delivery
3. GET/POST /v1/assets - Upload/sync brand assets, logos for partners
4. GET /v1/designs - List/retrieve designs for content library
5. POST /v1/comments - Add automated review comments or collaboration notes

Additional useful: folders, brand kits, return navigation for embedded flows.

## 3. Rate limits + quota
- Standard rate limits apply (documented per endpoint, typically 100-1000 req/min depending on tier)
- Quotas tied to Canva plan; Enterprise has higher limits
- Preview APIs have stricter dev limits
- Monitor via response headers (X-RateLimit-*)

## 4. SDK availability
- Official: OpenAPI spec at https://www.canva.dev/sources/connect/api/latest/api.yml
- Can generate Python/Node clients via openapi-generator
- Starter Kit: https://github.com/canva-sdks/canva-connect-api-starter-kit (Node.js example)
- No official first-party Python SDK; community curl + axios/fetch common
- Shell: full curl support via OAuth token

## 5. Existing community MCPs or Claude skills
- No prominent public MCP servers or Claude skills found on npm/GitHub for Canva Connect (as of research date)
- Canva has "Dev MCP server" mentioned in docs (https://www.canva.dev/docs/connect/mcp-server/)
- Potential to wrap as custom MCP or Claude tool using the starter kit

## 6. Recommended adapter shape
- (a) Paperclip MCP - Best fit for agent fleet access. Enables direct API calls from Hermes agents without HITL.
- Alternative: (c) plugin via adapter-plugins.json for external @henkey style, but MCP preferred for control plane.
- Avoid (e) leave HITL given credentials exist.

## 7. Cost
- Free tier for development and private integrations
- Public integrations require review
- No per-call fees; costs embedded in Canva Enterprise subscription for advanced features/quotas
- No additional billing for API usage beyond plan

## 8. Canonical memory link
- None found in vault/memory/ for Canva Connect specifically. Closest: general design tool integrations or content automation patterns.

## Ladder Confirmation
Aligns with ROCAA-306 ($100M) via content velocity (Canva/Creatomate) for marketing collateral in mortgage/partner pipelines. Enables agents to generate on-brand materials programmatically.

## Next Actions
- Implement MCP adapter once approved
- Test with provided CANVA_CLIENT_ID/SECRET in dev environment
- Update issue with findings and close

**Status:** Research complete. Ready for review.