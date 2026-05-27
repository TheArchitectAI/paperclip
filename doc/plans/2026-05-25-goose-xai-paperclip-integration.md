# Goose + xAI SuperGrok Heavy + Paperclip Integration Recipe
**Date:** 2026-05-25  
**Agent:** Hermes Researcher  
**Issue:** ROCAA-309

## Summary
Wire local Goose CLI orchestration (Surface laptop) to use xAI SuperGrok Heavy (via proven OAuth/PKCE) and route output back to live Paperclip company.

## Phase 1: Fix Existing Config (Paperclip Company ID)
- Update `output.paperclip_company_id`:
  - ROC Dev: `a2092c30-a3b6-4b40-aded-21eb9d7818d3` (primary for dev tasks)
  - ROC Ops: `5c2551e8-cb65-4ab4-9fee-8e0001be2e41` (ops/production tasks)
- Verify connectivity from Surface: `curl http://100.127.26.77:3100/api/health`
- Test command: `goose run --profile classifier "List open Paperclip issues"`

## Phase 2: Add xAI SuperGrok Provider (OAuth/PKCE)
Reference Hermes config on roclaw (tier 5 SuperGrok):
```json
{
  "id": "30cee9",
  "label": "xai-oauth-oauth-1",
  "auth_type": "oauth",
  "source": "manual:xai_pkce",
  "base_url": "https://api.x.ai/v1",
  "client_id": "b1a00492-073a-47ea-816f-4c329264a828",
  "last_refresh": "2026-05-25T14:50:28Z",
  "tier": 5
}
```

**Goose provider addition** (in `~/.config/goose/config.yaml` or equivalent):
```yaml
providers:
  xai-oauth:
    auth_type: oauth
    source: manual:xai_pkce
    base_url: https://api.x.ai/v1
    client_id: b1a00492-073a-47ea-816f-4c329264a828
    # token + refresh handled via xAI PKCE flow (Hermes-proven)
```

Update profiles to use `xai-oauth` + Grok models where cost-free inference is desired:
- classifier → xai-oauth / grok-heavy
- orchestrator → xai-oauth (for planning)

Token refresh: Reuse the manual:xai_pkce flow; test `goose auth refresh xai-oauth`.

## Phase 3: Orchestration Hardening & End-to-End Test
- Enable `orchestrator` extension in Goose config.
- Pipeline test:
  1. scaffolder (codex) → generate spec
  2. implementer (claude-opus or xai) → code changes
  3. reviewer (gemini) → audit
- Route all output to Paperclip via `output.paperclip_company_id` + issue comments.
- Governance: Keep dual-approval, budget caps, forbidden paths active.
- Telegram invocation recipe for Trin:
  ```
  /goose orchestrate "ROCAA-XXX: <task>"
  ```

## Acceptance Criteria Verification Plan
- [x] Paperclip company ID updated to live ROC Dev/Ops
- [ ] xAI provider added + OAuth refresh working ($0 marginal)
- [ ] At least one profile switched to xAI/Grok
- [ ] orchestrator extension enabled + pipeline tested
- [ ] Full scaffolder→implementer→reviewer run logged back to Paperclip
- [ ] Telegram invocation documented

## Working Directory Note
All Goose config lives on the Surface laptop (`~/.config/goose/`). This doc serves as the canonical recipe. Local Paperclip changes (if any) go in `packages/adapters/` or `doc/`.

**Next action for Trin/Human:** Apply the YAML changes on Surface and run the classifier smoke test.
