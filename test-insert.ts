import { db } from "./server/db";
import { networkNodes, networkConnections, messages } from "./shared/schema";

async function main() {
  try {
    const existing = await db.select().from(networkNodes);
    console.log(`Current nodes: ${existing.length}`);
    if (existing.length === 0) {
      console.log("Inserting a test node...");
      await db.insert(networkNodes).values({
        nodeId: "test-node",
        name: "Test Node",
        latitude: 12.92,
        longitude: 77.50,
      });
      const after = await db.select().from(networkNodes);
      console.log(`Nodes after insert: ${after.length} - ${after[0].name}`);
    }
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
main();
