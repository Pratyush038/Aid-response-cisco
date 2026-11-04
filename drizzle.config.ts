import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // The session table is created and owned by connect-pg-simple at runtime;
  // keep drizzle-kit from trying to "fix" its column types on every push.
  tablesFilter: ["!session"],
});
