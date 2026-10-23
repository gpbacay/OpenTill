// Applies prisma/migrations/*/migration.sql to the hosted database (Turso) that the Vercel API uses.
// Runs in the Vercel build; does nothing without TURSO_DATABASE_URL. Safe to re-run: applied migrations are recorded.
import { createClient } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.log("TURSO_DATABASE_URL not set: skipping remote migrations.");
    return;
  }
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await db.execute('CREATE TABLE IF NOT EXISTS "_opentill_migrations" ("name" TEXT NOT NULL PRIMARY KEY)');
  const done = new Set((await db.execute('SELECT "name" FROM "_opentill_migrations"')).rows.map((row) => String(row.name)));
  const dir = join(process.cwd(), "prisma", "migrations");
  for (const name of readdirSync(dir).filter((entry) => !entry.includes(".")).sort()) {
    if (done.has(name)) continue;
    await db.executeMultiple(readFileSync(join(dir, name, "migration.sql"), "utf8"));
    await db.execute({ sql: 'INSERT INTO "_opentill_migrations" ("name") VALUES (?)', args: [name] });
    console.log("applied", name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
