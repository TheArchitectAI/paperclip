import type { Request } from "express";
import { forbidden } from "../errors.js";

/**
 * Hermes Paperclip mutation guard (ROCAA-281 / ROCAA-284 / Hermes-Sandbox-Spec-v2).
 *
 * Hermes runs with broad local privileges. To keep its blast radius limited
 * at the Paperclip layer, this guard enforces server-side what the adapter
 * tool allowlist already advertises:
 *
 *   ALLOW (when Hermes is the caller):
 *     - Read operations (handled implicitly — no guard call on GET routes)
 *     - Self-assigned issue status moves (except cancel / goal-ticket done)
 *     - Self-assigned issue comments
 *     - Creating issues that are unassigned or self-assigned
 *     - Checking out / releasing issues already assigned to itself
 *
 *   DENY (return 403 forbidden):
 *     - Mutating any issue where `assigneeAgentId` is not Hermes
 *     - Reassignment (changing assigneeAgentId / assigneeUserId off Hermes)
 *     - Priority changes on critical/high tickets
 *     - status === "cancelled"
 *     - status === "done" on goal-linked tickets (goalId != null)
 *     - DELETE issue (always)
 *
 * This is a denylist atop the normal authz model. It only fires when the
 * caller is a Hermes agent; other agents and board users are unaffected.
 *
 * Hermes agent identities are sourced from the env var
 * `PAPERCLIP_HERMES_AGENT_IDS` (comma-separated). The known production id
 * `0e788ac4-f745-46bf-a5d7-751adac7fd27` is included as a fallback so the
 * guard is safe-by-default even before deployers set the env var.
 */

const DEFAULT_HERMES_AGENT_IDS = ["0e788ac4-f745-46bf-a5d7-751adac7fd27"];

function loadConfiguredHermesAgentIds(): Set<string> {
  const raw = process.env.PAPERCLIP_HERMES_AGENT_IDS ?? "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return new Set<string>([...DEFAULT_HERMES_AGENT_IDS, ...fromEnv]);
}

let hermesAgentIdCache: Set<string> | null = null;

function hermesAgentIds(): Set<string> {
  if (!hermesAgentIdCache) {
    hermesAgentIdCache = loadConfiguredHermesAgentIds();
  }
  return hermesAgentIdCache;
}

/** Reset the cached env-derived ID list. Exported for tests. */
export function resetHermesAgentIdCache() {
  hermesAgentIdCache = null;
}

export function isHermesAgentId(agentId: string | null | undefined): boolean {
  if (!agentId) return false;
  return hermesAgentIds().has(agentId);
}

function actorIsHermes(req: Request): boolean {
  if (req.actor.type !== "agent") return false;
  return isHermesAgentId(req.actor.agentId ?? null);
}

const PRIORITY_LOCKED_LEVELS = new Set(["critical", "high"]);

type IssueLike = {
  assigneeAgentId: string | null;
  priority: string | null | undefined;
  goalId: string | null | undefined;
  status: string | null | undefined;
};

type IssuePatchBody = {
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
  priority?: string;
  status?: string;
};

type IssueCreateBody = {
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
  status?: string;
};

function denyHermes(reason: string): never {
  throw forbidden(`Hermes mutation guard: ${reason}`);
}

/**
 * Guard for PATCH /api/issues/:id when Hermes is the caller.
 *
 * `existing` is the issue *before* the patch is applied. `body` is the
 * incoming patch payload as parsed by the route's zod schema.
 */
export function enforceHermesIssuePatchGuard(
  req: Request,
  existing: IssueLike,
  body: IssuePatchBody,
) {
  if (!actorIsHermes(req)) return;

  // Rule 1: only allow mutating self-assigned issues.
  if (!isHermesAgentId(existing.assigneeAgentId)) {
    denyHermes("cannot mutate issues assigned to other agents");
  }

  // Rule 2: no reassignment off Hermes.
  if (body.assigneeAgentId !== undefined && !isHermesAgentId(body.assigneeAgentId)) {
    denyHermes("cannot reassign issues to another agent");
  }
  if (body.assigneeUserId !== undefined && body.assigneeUserId !== null) {
    denyHermes("cannot reassign issues to a user");
  }

  // Rule 3: no priority changes on already-critical / already-high tickets.
  if (
    typeof body.priority === "string" &&
    body.priority !== existing.priority &&
    PRIORITY_LOCKED_LEVELS.has(String(existing.priority ?? ""))
  ) {
    denyHermes("cannot change priority on critical or high tickets");
  }

  // Rule 4: no cancellation.
  if (body.status === "cancelled") {
    denyHermes("cannot cancel issues");
  }

  // Rule 5: no completing goal-linked tickets.
  if (body.status === "done" && existing.goalId) {
    denyHermes("cannot mark goal-linked issues done — requires human approval");
  }
}

/** Guard for DELETE /api/issues/:id. Hermes can never delete issues. */
export function enforceHermesIssueDeleteGuard(req: Request) {
  if (!actorIsHermes(req)) return;
  denyHermes("cannot delete issues");
}

/**
 * Guard for POST /api/issues/:id/checkout.
 *
 * The existing handler already rejects agents trying to check out as someone
 * else; this adds: Hermes cannot claim issues that are currently assigned to
 * a different agent (taking work from peers).
 */
export function enforceHermesIssueCheckoutGuard(
  req: Request,
  issue: IssueLike,
  checkoutAgentId: string | null | undefined,
) {
  if (!actorIsHermes(req)) return;

  // The checkout target must be Hermes itself.
  if (checkoutAgentId && !isHermesAgentId(checkoutAgentId)) {
    denyHermes("cannot checkout on behalf of another agent");
  }

  // Cannot steal an issue currently assigned to a non-Hermes agent.
  if (issue.assigneeAgentId && !isHermesAgentId(issue.assigneeAgentId)) {
    denyHermes("cannot checkout an issue currently assigned to another agent");
  }
}

/** Guard for POST /api/issues/:id/comments. Comments are only allowed on self-assigned issues. */
export function enforceHermesIssueCommentGuard(req: Request, issue: IssueLike) {
  if (!actorIsHermes(req)) return;
  if (!isHermesAgentId(issue.assigneeAgentId)) {
    denyHermes("cannot comment on issues assigned to other agents");
  }
}

/**
 * Guard for POST /api/companies/:companyId/issues.
 *
 * Hermes can create issues, but only when:
 *   - assigneeAgentId is unset OR equal to Hermes
 *   - assigneeUserId is unset
 */
export function enforceHermesIssueCreateGuard(req: Request, body: IssueCreateBody) {
  if (!actorIsHermes(req)) return;

  if (body.assigneeAgentId !== undefined && body.assigneeAgentId !== null) {
    if (!isHermesAgentId(body.assigneeAgentId)) {
      denyHermes("cannot create issues assigned to another agent");
    }
  }
  if (body.assigneeUserId) {
    denyHermes("cannot create issues assigned to a user");
  }
  if (body.status === "cancelled") {
    denyHermes("cannot create issues in cancelled status");
  }
}
