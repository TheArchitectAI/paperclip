import postgres from "postgres";

async function main() {
  const sql = postgres("postgres://paperclip:paperclip@localhost:5432/paperclip");
  
  console.log("ROUTINES:");
  const routines = await sql`SELECT id, company_id, title, status, last_triggered_at, last_enqueued_at FROM routines WHERE id = 'e6fa1fae-ae4d-400d-9a56-64249f0780e5'`;
  console.log(JSON.stringify(routines, null, 2));

  console.log("\nROUTINE TRIGGERS:");
  const triggers = await sql`SELECT id, company_id, routine_id, kind, enabled, cron_expression, next_run_at, last_fired_at, last_result FROM routine_triggers WHERE routine_id = 'e6fa1fae-ae4d-400d-9a56-64249f0780e5'`;
  console.log(JSON.stringify(triggers, null, 2));

  console.log("\nROUTINE RUNS:");
  const runs = await sql`SELECT id, company_id, status, source, triggered_at, failure_reason, linked_issue_id FROM routine_runs WHERE routine_id = 'e6fa1fae-ae4d-400d-9a56-64249f0780e5' ORDER BY triggered_at DESC LIMIT 5`;
  console.log(JSON.stringify(runs, null, 2));

  await sql.end();
}

main().catch(console.error);
