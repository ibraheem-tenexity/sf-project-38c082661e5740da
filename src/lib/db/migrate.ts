import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";

async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("placeholder")) {
    console.log("Skipping migrations — DATABASE_URL not configured");
    return;
  }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("Migrations complete");
  await pool.end();
}

runMigrations().catch((e) => { console.error(e); process.exit(1); });
