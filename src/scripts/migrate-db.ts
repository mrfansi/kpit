import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

interface JournalEntry { idx: number; version: string; when: number; tag: string; breakpoints: boolean }
interface Journal { version: string; dialect: string; entries: JournalEntry[] }

/** Apply registered migrations by Drizzle's SQL content hash, not historic journal timestamps. */
export function migrateDatabase(databasePath: string, migrationFolder = resolve("drizzle")) {
  const sqlite = new Database(databasePath);
  try {
    const journal = JSON.parse(readFileSync(join(migrationFolder, "meta", "_journal.json"), "utf8")) as Journal;
    const known = journal.entries.map((entry) => {
      const sql = readFileSync(join(migrationFolder, `${entry.tag}.sql`), "utf8");
      return { entry, sql, hash: createHash("sha256").update(sql).digest("hex") };
    });
    if (new Set(known.map((migration) => migration.hash)).size !== known.length) throw new Error("Duplicate migration SQL hashes; cannot establish history safely.");
    const ledgerExists = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get();
    const applicationTables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'").all();
    if (!ledgerExists && applicationTables.length) throw new Error("Existing tables have no Drizzle migration ledger. Back up and baseline explicitly; refusing to replay migrations.");
    const applied = ledgerExists ? sqlite.prepare("SELECT hash, created_at FROM __drizzle_migrations").all() as { hash: string; created_at: number }[] : [];
    if (ledgerExists && !applied.length && applicationTables.length) throw new Error("Existing tables have an empty migration ledger. Back up and baseline explicitly.");
    const knownHashes = new Set(known.map((migration) => migration.hash));
    if (applied.some((migration) => !knownHashes.has(migration.hash))) throw new Error("Migration ledger includes unknown SQL hashes; refusing to replay or skip migrations.");
    const appliedHashes = new Set(applied.map((migration) => migration.hash));
    if (appliedHashes.size !== applied.length) throw new Error("Duplicate migration ledger hashes; back up and reconcile before upgrading.");
    let missingSeen = false;
    for (const migration of known) {
      if (!appliedHashes.has(migration.hash)) missingSeen = true;
      else if (missingSeen) throw new Error("Migration ledger is not a complete prefix of the registered migrations; back up and reconcile before upgrading.");
    }
    const pending = known.filter((migration) => !appliedHashes.has(migration.hash));
    if (!pending.length) return { applied: 0 };
    const latest = applied.reduce((max, migration) => Math.max(max, Number(migration.created_at)), Date.now());
    if (!Number.isSafeInteger(latest) || latest > Number.MAX_SAFE_INTEGER - pending.length) throw new Error("Invalid migration ledger timestamps.");
    // Drizzle SQLiteSyncDialect uses this exact ledger shape and inserts the SQL hash
    // with the journal timestamp. Its statement-breakpoint runner cannot execute
    // older multi-statement SQL files that lack breakpoint markers; sqlite.exec can.
    sqlite.transaction(() => {
      sqlite.exec('CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)');
      for (const [index, migration] of pending.entries()) {
        sqlite.exec(migration.sql);
        sqlite.prepare('INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)').run(migration.hash, latest + index + 1);
      }
    })();
    return { applied: pending.length };
  } finally {
    sqlite.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = migrateDatabase(process.env.DATABASE_URL ?? "./kpit.db");
  console.log(`Applied ${result.applied} migration(s).`);
}
