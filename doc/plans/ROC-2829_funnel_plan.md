# Plan: Operationalizing the Origination Funnel (ROC-2829)

## 1. Goal
Ensure the 'WE NEED LEADS' North Star is baked into daily operating procedures, board strategy, and agent blueprints.

## 2. Deliverables
- [ ] Define 'Daily Leads/Conversion' metrics in `/start`, `/eod`, `/ipa` commands.
- [ ] Update Board Strategy to rank lead-gen/conversion as highest priority.
- [ ] Update Agent Blueprints (`AGENTS.md` and related files) with funnel stage and lead-gen mandates.

## 3. Strategy
- Leverage existing `generate_funnel_brief.py` as the data foundation.
- Integrate these metrics directly into the agent's interaction surface (CLI tools).
- Update board governance logic to reflect these priorities.

## 4. Execution Plan
1. Audit existing `ipa`, `start`, `eod` commands to see where funnel metrics can be added.
2. Update agent blueprint templates in `AGENTS.md` and check agent implementations.
3. Propose board strategy updates as a ticket/plan for the human/board to review.

