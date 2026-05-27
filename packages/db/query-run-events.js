import postgres from "postgres";

async function main() {
  const sql = postgres("postgres://paperclip:paperclip@localhost:5432/paperclip");
  
  console.log("EVENTS FOR RUN bfe0d3f6-d9e0-4798-b171-097ac29e916d:");
  const events = await sql`
    SELECT id, event_type, stream, level, message, payload, created_at 
    FROM heartbeat_run_events 
    WHERE run_id = 'bfe0d3f6-d9e0-4798-b171-097ac29e916d' 
    ORDER BY seq ASC
  `;
  for (const e of events) {
    console.log(`[${e.created_at.toISOString()}] ${e.event_type} (${e.level}): ${e.message}`);
    if (e.payload) {
      console.log(JSON.stringify(e.payload, null, 2));
    }
    console.log("-----------------------------------------");
  }

  await sql.end();
}

main().catch(console.error);
