import {
  Annotation,
  Command,
  END,
  START,
  StateGraph,
  interrupt,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

export { Command };

export const LANGGRAPH_THREAD_SCHEMA = "langgraph";
export const HITL_QUESTION =
  "P3a Phase-2 seam round-trip: approve to resume the graph";

export type SeamDecision = "approved" | "rejected";

export const SeamStateAnnotation = Annotation.Root({
  counter: Annotation<number>(),
  decision: Annotation<string | null>(),
  log: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export type SeamState = typeof SeamStateAnnotation.State;

export type SeamGraph = ReturnType<typeof createSeamGraph>;

export function createSeamGraph(checkpointer: BaseCheckpointSaver) {
  return new StateGraph(SeamStateAnnotation)
    .addNode("prepare", (state: SeamState) => ({
      counter: state.counter + 1,
      log: ["prepare: counter incremented"],
    }))
    .addNode("hitl", () => {
      const decision = interrupt<{ question: string }, SeamDecision>({
        question: HITL_QUESTION,
      });
      return {
        decision,
        log: [`hitl: resumed with ${decision}`],
      };
    })
    .addNode("finalize", (state: SeamState) => ({
      log: [`finalize: counter=${state.counter}, decision=${state.decision}`],
    }))
    .addEdge(START, "prepare")
    .addEdge("prepare", "hitl")
    .addEdge("hitl", "finalize")
    .addEdge("finalize", END)
    .compile({ checkpointer });
}

let postgresSaver: PostgresSaver | null = null;
let postgresSetupPromise: Promise<void> | null = null;
let seamGraph: SeamGraph | null = null;

export async function getSeamGraph(): Promise<SeamGraph> {
  if (seamGraph) return seamGraph;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for langgraph_local checkpointer");
  }
  if (!postgresSaver) {
    postgresSaver = PostgresSaver.fromConnString(databaseUrl, {
      schema: LANGGRAPH_THREAD_SCHEMA,
    });
  }
  postgresSetupPromise ??= postgresSaver.setup();
  await postgresSetupPromise;
  seamGraph = createSeamGraph(postgresSaver);
  return seamGraph;
}

export function createInitialSeamState(): SeamState {
  return {
    counter: 0,
    decision: null,
    log: [],
  };
}
