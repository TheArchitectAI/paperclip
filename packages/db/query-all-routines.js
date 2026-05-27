import postgres from "postgres";

async function main() {
  const sql = postgres("postgres://paperclip:paperclip@localhost:5432/paperclip");
  
  console.log("ALL ROUTINES:");
  const routines = await sql`
    SELECT id, title, status, last_triggered_at, last_enqueued_at, created_at
    FROM routines 
    ORDER BY created_at DESC
  `;
  for (const r of routines) {
    console.log(`Routine ID: ${r.id}`);
    console.log(`Title: ${r.title}`);
    console.log(`Status: ${r.status}`);
    console.log(`Last Triggered: ${r.last_triggered_at}`);
    console.log(`Last Enqueued: ${r.last_enqueued_at}`);
    console.log(`Created: ${r.created_at}`);
    
    const triggers = await sql`
      SELECT id, kind, enabled, cron_expression, timezone, next_run_at, last_fired_at, last_result
      FROM routine_triggers
      WHERE routine_id = ${r.id}
    `;
    console.log("Triggers:");
    console.log(JSON.stringify(triggers, null, 2));
    console.log("=========================================\n");
  }

  await sql.end();
}

main().catch(console.error);
