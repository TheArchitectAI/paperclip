# Plan: Operationalize Origination Funnel (ROC-2829)

## Overview
Operationalize the origination funnel across the Operating Layer to run daily, tying IPA daily minimums to lead origination.

## Tasks

1. **Daily Goals (IPA):**
   - Update daily minimums and IPA tasks to explicitly include relationship-to-lead origination.
   - Surface leads-by-source, stage conversion percentage, and daily lead targets + stage-advance targets in `/start`, `/eod`, `/ipa` commands.

2. **Board Strategy:**
   - Governance must rank lead-gen + stage-advancing work first.
   - Surface stuck stages + stalled relationships as Ivan/AE actions.
   - Implement anti-rot rules for cold relationships.

3. **Agent Blueprints:**
   - Embed funnel stage, lead-gen mandate, and next-best-actions in agent blueprints.
   - Route work to maximize leads-to-closings.

## Implementation Steps
- [ ] Analyze `ipa` daily minimums structure.
- [ ] Update agent blueprints (AGENTS.md and agent-specific files).
- [ ] Integrate lead-source tracking into daily reports.
- [ ] Implement stage-advance tracking in board strategy.
- [ ] Define anti-rot metrics and actions.
