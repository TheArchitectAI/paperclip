import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];

  try {
    await import("@langchain/langgraph");
    await import("@langchain/langgraph-checkpoint-postgres");
    checks.push({
      code: "langgraph_deps_importable",
      level: "info",
      message: "LangGraph runtime dependencies are importable.",
    });
  } catch (err) {
    checks.push({
      code: "langgraph_deps_missing",
      level: "error",
      message: err instanceof Error ? err.message : "LangGraph dependencies are not importable.",
    });
  }

  if (process.env.DATABASE_URL) {
    checks.push({
      code: "langgraph_database_url_present",
      level: "info",
      message: "DATABASE_URL is configured.",
    });
  } else {
    checks.push({
      code: "langgraph_database_url_missing",
      level: "error",
      message: "langgraph_local requires DATABASE_URL for Postgres checkpoint persistence.",
      hint: "Set DATABASE_URL before running langgraph_local agents.",
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
