import postgres from "postgres";

async function main() {
  const sql = postgres("postgres://paperclip:paperclip@localhost:5432/paperclip");
  
  console.log("HEARTBEAT RUNS FOR LEARN-AGENT:");
  const runs = await sql`
    SELECT id, status, created_at, finished_at, error, exit_code, signal, error_code, context_snapshot
    FROM heartbeat_runs 
    WHERE agent_id = 'f376b919-3872-4de7-bb55-2db55c4548d6' 
    ORDER BY created_at DESC 
    LIMIT 20
  `;
  for (const r of runs) {
    console.log(`Run ID: ${r.id}`);
    console.log(`Status: ${r.status}`);
    console.log(`Created: ${r.created_at}`);
    console.log(`Finished: ${r.finished_at}`);
    console.log(`Error: ${r.error}`);
    console.log(`ErrorCode: ${r.error_code}`);
    console.log(`Issue: ${r.context_snapshot?.issueId}`);
    console.log(`Wake Reason: ${r.context_snapshot?.wakeReason}`);
    console.log("-----------------------------------------");
  }

  await sql.end();
}

main().catch(console.error);
