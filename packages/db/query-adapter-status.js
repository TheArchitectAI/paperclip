import { findActiveServerAdapter, listServerAdapters, getPausedOverrides } from "../../server/dist/adapters/registry.js";

async function main() {
  console.log("ALL REGISTERED ADAPTERS:");
  const list = listServerAdapters();
  for (const a of list) {
    console.log(`Type: ${a.type}`);
  }
  
  console.log("\nPAUSED OVERRIDES:");
  console.log(Array.from(getPausedOverrides()));
  
  console.log("\nACTIVE HERMES_LOCAL ADAPTER:");
  console.log(findActiveServerAdapter("hermes_local"));
}

main().catch(console.error);
