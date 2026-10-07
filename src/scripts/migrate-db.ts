import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

interface JournalEntry { idx: number; version: string; when: number; tag: string; breakpoints: boolean }
interface Journal { version: string; dialect: string; entries: JournalEntry[] }
interface Snapshot { columns: Set<string>; indexes: Map<string, string> }

function snapshot(db: Database.Database): Snapshot {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'").pluck().all() as string[];
  const columns = new Set(tables.flatMap((table) => (db.prepare("SELECT name FROM pragma_table_info(?)").pluck().all(table) as string[]).map((column) => `${table}.${column}`)));
  const indexes = new Map((db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all() as { name: string; sql: string }[]).map((index) => [index.name, index.sql]));
  return { columns, indexes };
}

/** Schema produced by each registered migration prefix, replayed in memory. */
function prefixSnapshots(sqls: string[]): Snapshot[] {
  const reference = new Database(":memory:");
  try {
    return sqls.map((sql) => {
      reference.exec(sql);
      return snapshot(reference);
    });
  } finally {
    reference.close();
  }
}

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
    const appliedPositions = known.flatMap((migration, index) => appliedHashes.has(migration.hash) ? [index] : []);
    const lastApplied = appliedPositions.length ? appliedPositions[appliedPositions.length - 1] : -1;
    let cutoff = lastApplied;
    let recordOnly: typeof known = [];
    let missingIndexes: string[] = [];
    if (appliedPositions.length !== lastApplied + 1) {
      // Ledger has holes: part of the schema was built outside this runner (drizzle-kit push).
      // Adopt the longest registered prefix whose tables and columns all exist instead of
      // replaying DDL that is not idempotent (0007 drops timeline_projects). Only schema is
      // verified; data-only statements in adopted migrations are assumed done.
      const prefixes = prefixSnapshots(known.map((migration) => migration.sql));
      const live = snapshot(sqlite);
      cutoff = known.length - 1;
      while (cutoff >= lastApplied && ![...prefixes[cutoff].columns].every((column) => live.columns.has(column))) cutoff--;
      if (cutoff < lastApplied) throw new Error("Migration ledger is not a complete prefix of the registered migrations and the live schema lacks their tables or columns; back up and reconcile before upgrading.");
      recordOnly = known.slice(0, cutoff + 1).filter((migration) => !appliedHashes.has(migration.hash));
      missingIndexes = [...prefixes[cutoff].indexes].filter(([name]) => !live.indexes.has(name)).map(([, sql]) => sql);
    }
    const pending = known.slice(cutoff + 1);
    if (!pending.length && !recordOnly.length) return { applied: 0, reconciled: 0 };
    const latest = applied.reduce((max, migration) => Math.max(max, Number(migration.created_at)), Date.now());
    if (!Number.isSafeInteger(latest) || latest > Number.MAX_SAFE_INTEGER - recordOnly.length - pending.length) throw new Error("Invalid migration ledger timestamps.");
    // Drizzle SQLiteSyncDialect uses this exact ledger shape and inserts the SQL hash
    // with the journal timestamp. Its statement-breakpoint runner cannot execute
    // older multi-statement SQL files that lack breakpoint markers; sqlite.exec can.
    sqlite.transaction(() => {
      sqlite.exec('CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)');
      const record = sqlite.prepare('INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)');
      let createdAt = latest;
      for (const sql of missingIndexes) sqlite.exec(sql);
      for (const migration of recordOnly) record.run(migration.hash, ++createdAt);
      for (const migration of pending) {
        sqlite.exec(migration.sql);
        record.run(migration.hash, ++createdAt);
      }
    })();
    return { applied: pending.length, reconciled: recordOnly.length };
  } finally {
    sqlite.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = migrateDatabase(process.env.DATABASE_URL ?? "./kpit.db");
  if (result.reconciled) console.log(`Recorded ${result.reconciled} migration(s) already present in the schema.`);
  console.log(`Applied ${result.applied} migration(s).`);
}
