import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { migrateDatabase } from "../scripts/migrate-db";

// The runtime DB singleton is imported only after pointing it at this isolated migrated file.
test("monthly drafts are scoped to their domain and reject stale revisions or foreign KPI IDs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kpit-monthly-"));
  const former = process.env.DATABASE_URL;
  const path = join(directory, "reports.sqlite");
  process.env.DATABASE_URL = path;
  try {
    migrateDatabase(path, resolve("drizzle"));
    const sqlite = new Database(path);
    sqlite.exec(`INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance'),(2,'Sales','sales');
      INSERT INTO kpis (id,domain_id,name,description,unit,target,threshold_green,threshold_yellow,created_at) VALUES
      (10,1,'Cash','Month-end cash','Rp',100,90,80,0),(20,2,'Sales','Booked revenue','Rp',100,90,80,0);`);
    sqlite.close();
    const { getMonthlyReportBundle, saveMonthlyReport, MonthlyReportError } = await import("./monthly-report-store");
    const report = await getMonthlyReportBundle("finance", "2026-04-01");
    assert.ok(report);
    assert.equal(report.revision, 0);
    assert.deepEqual(report.content.metrics.map((m) => m.kpiId), [10]);
    assert.equal(await getMonthlyReportBundle("missing", "2026-04-01"), null);
    const expectedMonths = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"];
    assert.deepEqual(report.content.metrics[0].observations.map((row) => row.month), expectedMonths);
    const draft = structuredClone(report.content);
    draft.metrics[0].observations.reverse();
    for (const row of draft.metrics[0].observations) row.source = `Source for ${row.month}`;
    const inserted = await saveMonthlyReport("finance", report.period, draft, 0, { id: "admin" });
    assert.equal(inserted.revision, 1);
    assert.deepEqual(inserted.content.metrics[0].observations.map((row) => [row.month, row.source]), expectedMonths.map((month) => [month, `Source for ${month}`]));
    const legacy = new Database(path);
    legacy.prepare("UPDATE monthly_reports SET content = ? WHERE domain_id = ? AND period = ?").run(JSON.stringify(draft), 1, report.period);
    legacy.close();
    const normalized = await getMonthlyReportBundle("finance", report.period);
    assert.ok(normalized);
    assert.deepEqual(normalized.content.metrics[0].observations.map((row) => [row.month, row.source]), expectedMonths.map((month) => [month, `Source for ${month}`]));
    await assert.rejects(() => saveMonthlyReport("finance", report.period, report.content, 0, { id: "admin" }), (error: unknown) => error instanceof MonthlyReportError && error.status === 409);
    await assert.rejects(() => saveMonthlyReport("finance", report.period, { ...report.content, metrics: [{ ...report.content.metrics[0], kpiId: 20 }] }, 1, { id: "admin" }), (error: unknown) => error instanceof MonthlyReportError && error.status === 400);
    const verified = new Database(path, { readonly: true });
    const revisions = verified.prepare("SELECT revision FROM monthly_report_revisions ORDER BY revision").all() as { revision: number }[];
    verified.close();
    assert.deepEqual(revisions.map((r) => r.revision), [1]);
    const changedRegistry = new Database(path);
    changedRegistry.prepare("DELETE FROM kpis WHERE id = 10").run();
    changedRegistry.close();
    // May is intentionally skipped: the latest saved April snapshot still owns #10.
    const later = await getMonthlyReportBundle("finance", "2026-06-01");
    assert.ok(later);
    assert.deepEqual(later.content.metrics.map((m) => m.kpiId), [10]);
    assert.equal(later.content.metrics[0].observations.find((o) => o.month === "2026-06-01")?.state, "missing");
    assert.ok(later.questions.some((q) => q.path === "kpiSetChangeNote"));
    const updated = structuredClone(later.content);
    updated.kpiSetChangeNote = "Cash KPI deleted from registry; June value is not tracked.";
    const june = updated.metrics[0].observations.find((o) => o.month === "2026-06-01");
    assert.ok(june);
    june.state = "untracked";
    const continued = await saveMonthlyReport("finance", later.period, updated, 0, { id: "admin" });
    assert.equal(continued.revision, 1);
    assert.equal(continued.content.metrics[0].observations.find((o) => o.month === "2026-06-01")?.state, "untracked");
    assert.ok(!continued.questions.some((q) => q.path === "kpiSetChangeNote"));
  } finally {
    if (former === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = former;
    rmSync(directory, { recursive: true, force: true });
  }
});
