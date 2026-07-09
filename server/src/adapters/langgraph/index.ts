import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const langgraphAdapter: ServerAdapterModule = {
  type: "langgraph_local",
  execute,
  testEnvironment,
  models: [],
  agentConfigurationDoc: `# langgraph_local agent configuration

Adapter: langgraph_local

Purpose:
- P3a Phase-2 plumbing proof for one LangGraph interrupt/resume seam.
- Synthetic state only: counter, decision, and short log strings.

Operational notes:
- Requires DATABASE_URL so the LangGraph Postgres checkpointer can persist thread state.
- Uses the dedicated langgraph schema for checkpoint tables.
- Expects run context to include issueId so the interrupt can create and link a board approval.
`,
};
