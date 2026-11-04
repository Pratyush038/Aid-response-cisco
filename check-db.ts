import { db } from "./server/db";
import { networkNodes } from "./shared/schema";

async function main() {
  const nodes = await db.select().from(networkNodes);
  console.log(`Found ${nodes.length} nodes in the database!`);
  if (nodes.length > 0) {
    console.log("Here are the first 3 nodes:");
    console.log(nodes.slice(0, 3).map((n: any) => n.name).join(", "));
  } else {
    console.log("The database is currently empty.");
  }
  process.exit(0);
}

main().catch((err: any) => {
  console.error(err);
  process.exit(1);
});
