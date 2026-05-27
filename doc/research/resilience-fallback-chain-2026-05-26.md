# ROCAA-325 Research: $0-First Resilience Fallback Chain + Per-Action Cost Measurement

**Researcher:** Hermes Researcher (1414a9de)
**Date:** 2026-05-26
**Priority:** Critical
**Related:** ROCAA-22, ROCAA-304, ROCAA-310, feedback_paid_fallback_policy_2026-05-26

## Problem Statement
Current failover (ROCAA-22) only triggers on 429/rate-limit signals. It misses the "out-of-extra-usage" / `claude_auth_required` case that occurs when a Claude Max seat exhausts its daily extra usage. This caused the 2026-05-25 outage.

Policy: $0-first (Max seat rotation → Grok/SuperGrok via Hermes → capped paid → RunPod), with hard per-action cost attribution.

## Current State Analysis

### Existing Components
- `packages/adapters/claude-local/src/server/failover.ts` — Tier 0/1/3 orchestrator
- `packages/adapters/claude-local/src/server/classifier.ts` — RecoverabilityVerdict rules
- `packages/adapters/claude-local/src/server/tier1-cost-cap.ts` — Daily + per-issue caps
- `parse.ts` — `detectClaudeLoginRequired`, `isClaudeMaxTurnsResult`
- `quota.ts`, `failover-events.ts`

### Gap Identified
- Classifier regex misses: `out-of-extra-usage`, `claude_auth_required`, Max seat cap exhaustion text
- No CLAUDE_CONFIG_DIR rotation logic for multiple $0 Max seats (`~/.claude`, `ivanloanman`, `info-rochomeloans`)
- No per-action cost ledger (only aggregate + per-issue)

## Recommended $0-First Fallback Chain

1. **Tier 0 Rotation ($0 Max seats)**
   - Maintain list of healthy Max seat config dirs.
   - On `claude_auth_required` / `out-of-extra-usage` → rotate to next seat via `CLAUDE_CONFIG_DIR`.
   - Track last-used seat + cooldown.

2. **Tier 0b: Hermes / Grok ($0)**
   - Use local Hermes or SuperGrok (via hermes_local adapter) for model-agnostic classify/extract tasks.
   - Only for non-Claude-specific work.

3. **Tier 1 (Capped Paid)**
   - After $0 exhausted.
   - Enforce $50/day soft cap + $300/mo ceiling (already partially in tier1-cost-cap.ts).
   - On breach → Slack-OPS alert + throttle.

4. **Tier 3 (RunPod)**
   - Only after paid breakeven.

## Detection Improvements Needed

Add to `classifier.ts`:

```ts
const RULE_OUT_OF_EXTRA_USAGE: RegexRule = {
  reason: "quota_exhausted", // or new "max_extra_usage_exhausted"
  recoverable: true, // because we can rotate seats
  pattern: /out.of.extra.usage|claude_auth_required|extra.usage.exhausted|daily.limit.reached/i,
};
```

Also enhance `parse.ts` `detectClaudeLoginRequired` to surface the exact error code.

## Per-Action Cost Measurement

Extend existing `model-usage.jsonl` + `tier-cost-logger.py`:

- Emit per-action record: `{agentId, issueId, actionType, model, inputTokens, outputTokens, costUsd, externalCostUsd, timestamp}`
- Aggregate rollups by (agent, ticket, day)
- Foundation already exists — wire adapter token emission + external (GHL/SMS/email) unit costs.

## Implementation Recommendations

1. Patch `classifier.ts` with new `RULE_OUT_OF_EXTRA_USAGE`.
2. Add `configRotation.ts` helper for CLAUDE_CONFIG_DIR cycling (3 known seats).
3. Wire Hermes as Tier 0b in failover orchestrator for suitable tasks.
4. Extend cost events schema for per-action attribution.
5. Update acceptance tests in `failover.acceptance.test.ts`.

## Acceptance Criteria Met By This Research
- Clear detection path for Max seat exhaustion
- Documented $0-first rotation strategy
- Cost measurement design ready for implementation by Scaffolder / Velocity team

**Next owner:** Master Scaffolder (queue + rotation daemon) + adapter maintainers for code changes.

This completes the Hermes Researcher research scope for ROCAA-325.