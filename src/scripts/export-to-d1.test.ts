import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { exportDatabase, importExport, queryD1, verifyExport, wrangler } from "./export-to-d1";
import { migrateDatabase } from "./migrate-db";

function fixture(root: string) {
  const path = join(root, "source.sqlite");
  migrateDatabase(path);
  const db = new Database(path);
  db.exec(`INSERT INTO domains(id,name,slug,description) VALUES (1,'O''Brien 日本語','unicode',NULL),(2,'Binary','blob',X'00FFCAFE');
    INSERT INTO kpis(id,domain_id,name,target,threshold_green,threshold_yellow,created_at) VALUES(1,1,'Metric',0.1,1.25,-0.003,1);
    INSERT INTO kpi_comments(kpi_id,period_date,content,created_at) VALUES(1,'2026-01-01','<p>It''s 日本語</p><img src="/uploads/comments/test.png"><img src="/uploads/comments/missing.png">',1);
    INSERT INTO audit_logs(id,action,entity,detail,created_at) VALUES(9007199254740993,'create','test','nul' || char(0) || 'text',1);`);
  return { path, db };
}

test("export/import/verify preserves exact SQLite values and R2 bytes; occupied targets and tampering fail closed", { timeout: 300_000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), "kpit-export-test-"));
  const { path, db } = fixture(root);
  try {
    const uploads = join(root, "images");
    mkdirSync(uploads);
    writeFileSync(join(uploads, "test.png"), Buffer.from([137, 80, 78, 71, 0, 255]));
    const original = createHash("sha256").update(readFileSync(path)).digest("hex");
    const out = join(root, "export");
    const manifest = await exportDatabase(path, out, uploads);
    assert.ok(manifest.warnings.includes("Missing referenced upload: missing.png"));
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), original);
    const sql = readFileSync(join(out, "data.sql"), "utf8");
    assert.ok(sql.includes("9007199254740993"));
    assert.ok(sql.includes("X'00FFCAFE'"));
    assert.ok(!/\b(BEGIN|COMMIT)\b/.test(sql));
    const target = { local: true, persistTo: join(root, "d1") };
    wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", target.persistTo]);
    importExport(out, target);
    verifyExport(out, target);
    assert.equal(queryD1("SELECT CAST(id AS TEXT) AS id FROM audit_logs", target)[0].id, "9007199254740993");
    assert.throws(() => importExport(out, target), /Target is not empty; refusing import/);
    queryD1("UPDATE domains SET name='tampered' WHERE id=1", target);
    assert.throws(() => verifyExport(out, target), /Verification failed:[\s\S]*domains/);
    await assert.rejects(exportDatabase(path, out), /must not exist/);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test("orphaned foreign keys are listed and export is refused", async () => {
  const root = mkdtempSync(join(tmpdir(), "kpit-orphan-test-"));
  const { path, db } = fixture(root);
  try {
    db.pragma("foreign_keys = OFF");
    db.exec("INSERT INTO timeline_projects (name,start_date,end_date,status_id,created_at,updated_at) VALUES('Orphan','2026-01-01','2026-01-02',999,1,1)");
    await assert.rejects(exportDatabase(path, join(root, "export")), /Foreign key violations:[\s\S]*table=timeline_projects rowid=1 parent=timeline_project_statuses/);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test("schema drift extra columns are named and export is refused", async () => {
  const root = mkdtempSync(join(tmpdir(), "kpit-drift-test-"));
  const { path, db } = fixture(root);
  try {
    db.exec("ALTER TABLE domains ADD COLUMN unmanaged TEXT");
    await assert.rejects(exportDatabase(path, join(root, "export")), /extra source column domains.unmanaged/);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test("readonly WAL snapshot includes committed WAL rows without modifying source", async () => {
  const root = mkdtempSync(join(tmpdir(), "kpit-wal-test-"));
  const { path, db } = fixture(root);
  try {
    db.pragma("journal_mode = WAL");
    db.exec("INSERT INTO domains(name,slug) VALUES('WAL row','wal')");
    const manifest = await exportDatabase(path, join(root, "export"));
    assert.equal(manifest.tables.find((table) => table.name === "domains")?.count, 3);
    assert.equal(db.prepare("SELECT name FROM domains WHERE slug='wal'").pluck().get(), "WAL row");
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
