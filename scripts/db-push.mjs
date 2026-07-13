import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Prefer Neon's HTTP/fetch path so schema push works when TCP:5432 is blocked
neonConfig.poolQueryViaFetch = true;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Set it in .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const script = readFileSync(resolve("prisma/init.sql"), "utf8");

// Split on semicolons that end a statement (keep DO $$ ... $$ blocks intact)
const statements = script
  .split(/;\s*(?=(?:--|CREATE|ALTER|DO|$))/i)
  .map((s) => s.trim())
  .filter(
    (s) =>
      s.length > 0 &&
      !s.split("\n").every((line) => {
        const t = line.trim();
        return t.length === 0 || t.startsWith("--");
      })
  );

function isAlreadyApplied(message = "") {
  return /already exists|duplicate_object|duplicate key/i.test(message);
}

async function main() {
  console.log(`Applying ${statements.length} statements to Neon via HTTP...`);
  let applied = 0;
  let skipped = 0;
  try {
    for (const statement of statements) {
      const body = statement.endsWith(";") ? statement : `${statement};`;
      try {
        await pool.query(body);
        applied += 1;
      } catch (err) {
        if (isAlreadyApplied(err.message)) {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }
    console.log(
      `Schema up to date. Applied: ${applied}, already present: ${skipped}.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Failed to apply schema:", err.message || err);
  process.exit(1);
});
