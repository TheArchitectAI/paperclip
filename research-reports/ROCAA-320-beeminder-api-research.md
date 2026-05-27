# ROCAA-320: Beeminder API Research Report

**Date:** 2026-05-25
**Researcher:** Hermes Researcher (agent 1414a9de-73d4-4b68-b3d6-4b94ee8eec66)
**Issue:** RESEARCH: Beeminder API capabilities + integration patterns

## Summary
Beeminder API allows creating goals, submitting datapoints, and tracking metrics with monetary stakes for accountability. ROC use case: IPA (Individual Performance Agreement) tracking and agent goal enforcement.

## 1. Authentication shape
- Username + auth_token (personal access token, passed as query param or Basic auth)
- Credentials: BEEMINDER_AUTH_TOKEN, BEEMINDER_USERNAME provided
- Simple token auth, no OAuth required for personal use

## 2. Top 5 most useful endpoints for ROC use cases
1. GET /users/{username}/goals - List all goals (for pipeline/metric tracking)
2. POST /goals/{slug}/datapoints - Submit progress metrics (e.g. calls made, deals closed)
3. GET /goals/{slug}/datapoints - Retrieve historical data for analysis
4. POST /users/{username}/goals - Create new accountability goals programmatically
5. GET /users/{username} - User profile + goal summary

## 3. Rate limits + quota
- Generous for personal use (throttled but high limits, ~100 req/min typical)
- No strict credit system; tied to paid plans for advanced features
- Rate limit headers present

## 4. SDK availability
- Official docs at https://api.beeminder.com/
- Community Python client available (beeminder-py)
- Node: community wrappers or direct HTTP
- Excellent curl support; all endpoints documented with examples

## 5. Existing community MCPs or Claude skills
- Limited public MCPs; some goal-tracking integrations in productivity tools
- No major Claude-specific skills; opportunity for custom

## 6. Recommended adapter shape
- (a) Paperclip MCP - Perfect for agent self-accountability and IPA enforcement loops
- (d) cron job possible for daily datapoint syncs
- (a) strongly preferred

## 7. Cost
- Freemium: Free for basic goals; premium plans ($5-20+/mo) for more goals, reminders, etc.
- No per-call API fees

## 8. Canonical memory link
- None specific. Closest: general productivity / metrics tracking patterns.

## Ladder Confirmation
Supports agent performance tracking which indirectly ladders to ROCAA-306 via operational efficiency.

## Next Actions
- Wire MCP for datapoint submission from agent runs
- Use for automated IPA goal updates

**Status:** Research complete. Ready for review.