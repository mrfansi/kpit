import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { migrateDatabase } from "./migrate-db";

test("migration upgrade skips applied hashes even when old ledger timestamps differ from journal", () => {
  const root = mkdtempSync(join(tmpdir(), "kpit-ledger-"));
  const folder = join(root, "migrations");
  const path = join(root, "db.sqlite");
  mkdirSync(join(folder, "meta"), { recursive: true });
  const old = { idx: 0, version: "6", when: 1900000000000, tag: "0000_base", breakpoints: true };
  const next = { idx: 1, version: "6", when: 1900000000001, tag: "0001_extra", breakpoints: true };
  const journal = (entries: typeof old[]) => writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify({ version: "7", dialect: "sqlite", entries }));
  try {
    writeFileSync(join(folder, "0000_base.sql"), "CREATE TABLE base (id integer PRIMARY KEY);\nALTER TABLE base ADD COLUMN label text;");
    journal([old]);
    assert.equal(migrateDatabase(path, folder).applied, 1);
    const sqlite = new Database(path);
    sqlite.prepare("UPDATE __drizzle_migrations SET created_at = ?").run(10);
    sqlite.close();
    writeFileSync(join(folder, "0001_extra.sql"), "CREATE TABLE extra (id integer PRIMARY KEY);");
    journal([old, next]);
    assert.equal(migrateDatabase(path, folder).applied, 1);
    const verified = new Database(path);
    const ledgerCount = verified.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations").get();
    const tableCount = verified.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='base'").get();
    const columns = verified.prepare("PRAGMA table_info(base)").all() as { name: string }[];
    assert.ok(ledgerCount && typeof ledgerCount === "object" && "count" in ledgerCount);
    assert.ok(tableCount && typeof tableCount === "object" && "count" in tableCount);
    assert.equal(ledgerCount.count, 2);
    assert.equal(tableCount.count, 1);
    assert.deepEqual(columns.map((column) => column.name), ["id", "label"]);
    verified.close();
    assert.equal(migrateDatabase(path, folder).applied, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("migration runner refuses nonempty databases without ledger", () => {
  const root = mkdtempSync(join(tmpdir(), "kpit-untracked-"));
  const folder = join(root, "migrations");
  const path = join(root, "db.sqlite");
  mkdirSync(join(folder, "meta"), { recursive: true });
  try {
    writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify({ version: "7", dialect: "sqlite", entries: [{ idx: 0, version: "6", when: 1, tag: "0000_base", breakpoints: true }] }));
    writeFileSync(join(folder, "0000_base.sql"), "CREATE TABLE base (id integer PRIMARY KEY);");
    const sqlite = new Database(path);
    sqlite.exec("CREATE TABLE existing(id integer PRIMARY KEY)");
    sqlite.close();
    assert.throws(() => migrateDatabase(path, folder), /no Drizzle migration ledger/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ledger gaps adopt migrations whose schema exists, create their missing indexes, and refuse missing columns", () => {
  const root = mkdtempSync(join(tmpdir(), "kpit-gap-"));
  const folder = join(root, "migrations");
  mkdirSync(join(folder, "meta"), { recursive: true });
  const sqls = [
    "CREATE TABLE base (id integer PRIMARY KEY);",
    "ALTER TABLE base ADD COLUMN label text;\nCREATE INDEX idx_base_label ON base(label);",
    "CREATE TABLE extra (id integer PRIMARY KEY);",
    "DROP TABLE extra;\nCREATE TABLE extra (id integer PRIMARY KEY, note text);",
    "CREATE TABLE fresh (id integer PRIMARY KEY);",
  ];
  sqls.forEach((sql, idx) => writeFileSync(join(folder, `000${idx}_m.sql`), sql));
  writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify({ version: "7", dialect: "sqlite", entries: sqls.map((_, idx) => ({ idx, version: "6", when: idx, tag: `000${idx}_m`, breakpoints: true })) }));
  // Ledger records 0000 and 0002 only; the rest of the schema came from drizzle-kit push.
  const pushed = (labelColumn: string) => {
    const path = join(root, `${labelColumn}.sqlite`);
    const sqlite = new Database(path);
    sqlite.exec(`CREATE TABLE base (id integer PRIMARY KEY, ${labelColumn} text);
      CREATE TABLE extra (id integer PRIMARY KEY, note text);
      INSERT INTO extra VALUES (1, 'keep');
      CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);`);
    for (const sql of [sqls[0], sqls[2]]) sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, 1)").run(createHash("sha256").update(sql).digest("hex"));
    sqlite.close();
    return path;
  };
  try {
    const path = pushed("label");
    assert.deepEqual(migrateDatabase(path, folder), { applied: 1, reconciled: 2 });
    const sqlite = new Database(path);
    assert.deepEqual(sqlite.prepare("SELECT note FROM extra").pluck().all(), ["keep"]);
    assert.equal(sqlite.prepare("SELECT COUNT(*) FROM sqlite_master WHERE name IN ('idx_base_label', 'fresh')").pluck().get(), 2);
    assert.equal(sqlite.prepare("SELECT COUNT(*) FROM __drizzle_migrations").pluck().get(), 5);
    sqlite.close();
    assert.deepEqual(migrateDatabase(path, folder), { applied: 0, reconciled: 0 });

    assert.throws(() => migrateDatabase(pushed("other"), folder), /not a complete prefix/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
