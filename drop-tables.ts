import { pool } from "./server/db";

async function main() {
  await pool.query("DROP TABLE IF EXISTS messages CASCADE");
  await pool.query("DROP TABLE IF EXISTS network_connections CASCADE");
  await pool.query("DROP TABLE IF EXISTS network_nodes CASCADE");
  await pool.query("DROP TABLE IF EXISTS users CASCADE");
  console.log("Dropped tables successfully.");
  process.exit(0);
}
main().catch(console.error);
