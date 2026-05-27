# ROCAA-322: Success.ai API Research Report

**Date:** 2026-05-25
**Researcher:** Hermes Researcher (agent 1414a9de-73d4-4b68-b3d6-4b94ee8eec66)
**Issue:** RESEARCH: Success.ai API capabilities + integration patterns

## Summary
Success.ai provides B2B lead enrichment, contact intelligence, email finding, and company data via API. Primary ROC use: pipeline accuracy and partner/lead enrichment for mortgage and sales workflows.

## 1. Authentication shape
- API Key (Bearer token style or X-API-Key header)
- Credentials provided via env (no OAuth mentioned in standard docs)
- Simple key-based auth suitable for server-to-server agent use

## 2. Top 5 most useful endpoints for ROC use cases
1. POST /v1/enrich/contact - Enrich individual leads with emails, phones, titles (mortgage pipeline)
2. POST /v1/enrich/company - Company firmographics, tech stack, intent signals
3. POST /v1/search/contacts - Find decision makers by company/domain/title filters
4. POST /v1/find/email - Email pattern + verification for outreach
5. GET /v1/credits/balance - Monitor usage/quota (important for agent automation)

## 3. Rate limits + quota
- Credit-based system (pay-per-enrichment or monthly credits)
- Typical: 100-1000 requests/min depending on plan
- Strict credit caps; overages billed or throttled
- Headers often include remaining credits

## 4. SDK availability
- No official public SDKs widely published (REST-first)
- Python/Node: Use requests/axios + OpenAPI if available, or direct HTTP
- Shell: curl with API key header fully supported
- Likely OpenAPI spec available on their developer portal

## 5. Existing community MCPs or Claude skills
- No prominent public MCP or Claude-specific skills found
- General enrichment tools exist in LangChain/LlamaIndex ecosystems but not Success.ai branded
- Opportunity for custom MCP wrapper

## 6. Recommended adapter shape
- (a) Paperclip MCP - Ideal for direct agent access to enrichment in pipeline tasks
- (c) plugin possible but MCP better for control-plane orchestration
- Avoid (e) HITL since credentials exist and use case is high-volume

## 7. Cost
- Subscription + credit-based (starts ~$99/mo for basic, scales with volume)
- Per-enrichment or per-lead pricing common
- No free unlimited tier; monitor closely for agent usage

## 8. Canonical memory link
- None specific found. Closest: general lead enrichment patterns or ATTOM/Cube integrations for real-estate data overlap.

## Ladder Confirmation
Supports ROCAA-306 via pipeline accuracy (enrichment improves DocAI/Blend flows and partner targeting). Revenue-adjacent through better conversion.

## Next Actions
- Implement MCP adapter
- Secure API key storage in company secrets
- Test enrichment flows on sample mortgage/partner data

**Status:** Research complete. Ready for review.