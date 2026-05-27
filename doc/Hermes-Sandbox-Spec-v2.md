# Hermes-Sandbox-Spec-v2

**Owner:** Hermes (CTO Dev)
**Status:** Draft v2 (extending prior Hermes-Sandbox-Spec.md)
**Priority:** P1 SECURITY BLOCKER for autonomous Hermes CTO runs
**Date:** 2026-05-25

## Background
Current Hermes CTO deployment runs with `--yolo` (full bypass of approval gates). This gives broad local/system access while operating on critical goals. Per dual review of ROCAA-228, this posture is materially worse than target sandbox and must be remediated before steady-state autonomous missions.

## Scope
This spec is backend-agnostic (applies to SuperGrok-Hermes and future RunPod-Hermes).

## Requirements

### 1. Least-Privilege Tool Allowlist
Hermes may only use the following tools (no `--yolo`):
- paperclip (create/comment/PATCH-status on self-tickets only)
- vault_read (scoped)
- vault_search (scoped)
- terminal-scoped (whitelisted commands only)
- web (allowlisted domains)
- rag_mcp (read-only)

All other tools require explicit per-tool approval rules or are disabled.

### 2. Vault Scoping
- Read-only access to `vault/{memory, wiki}`
- Write access only via new `vault-commit` tool:
  - Signs commits
  - Requires Ivan (local-board) approval for changes > N files
  - No direct filesystem writes to vault

### 3. RAG via MCP
- Structured read-only tool (track in ROCAA-244)
- No shell-out or arbitrary queries
- MCP server wrapper around RAG service

### 4. Paperclip Scoping
- Allowed: create, comment, PATCH-status on tickets
- Forbidden:
  - Change ownership of non-self tickets
  - Delete tickets
  - Modify goal tickets where `assigneeAgentId != self`

### 5. Outbound Network Allowlist
- Paperclip: 127.0.0.1:3100
- RAG: 100.127.26.77:8765
- GCP (scoped IAM)
- GitHub
- RunPod (once live)
- All other outbound blocked or require approval

### 6. Secret Access Scoping
- IAM limited to secrets Hermes explicitly needs
- No "list all" or broad secret enumeration
- Use secretService with explicit allowlist

## Implementation Plan
1. Create this spec (done)
2. File follow-up ROCAA tickets per layer (tool allowlist, vault-commit tool, MCP RAG, Paperclip guardrails, network policy, IAM scoping)
3. Update agent execution policy + adapter harness to enforce sandbox
4. Remove `--yolo` from Hermes CTO dispatch once implemented

## Risk Mitigation (Interim)
Until this lands:
- Hermes autonomous dispatch reviewed by Ivan weekly
- No infra changes, secret rotations, or external-effect actions (sendEmail/SMS/PR-merge) without per-action HITL

## References
- ROCAA-281 (this ticket)
- ROCAA-228 (RunPod Hermes Phase 3)
- ROCAA-244 (RAG MCP)
- Existing Hermes-Sandbox-Spec.md (baseline)