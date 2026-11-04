import assert from "node:assert/strict";
import test from "node:test";
import { createTestD1 } from "./test-d1";
import { getMonthlyReportBundle, saveMonthlyReport, MonthlyReportError } from "./monthly-report-store";
import type { MonthlyReportBundle } from "./monthly-report-types";

test("monthly drafts are scoped to their domain and reject stale revisions or foreign KPI IDs", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance'),(2,'Sales','sales')"),
      env.DB.prepare(`INSERT INTO kpis (id,domain_id,name,description,unit,target,threshold_green,threshold_yellow,created_at) VALUES
        (10,1,'Cash','Month-end cash','Rp',100,90,80,0),(20,2,'Sales','Booked revenue','Rp',100,90,80,0)`),
    ]);
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
    await env.DB.prepare("UPDATE monthly_reports SET content = ? WHERE domain_id = ? AND period = ?").bind(JSON.stringify(draft), 1, report.period).run();
    const normalized = await getMonthlyReportBundle("finance", report.period);
    assert.ok(normalized);
    assert.deepEqual(normalized.content.metrics[0].observations.map((row) => [row.month, row.source]), expectedMonths.map((month) => [month, `Source for ${month}`]));
    await assert.rejects(() => saveMonthlyReport("finance", report.period, report.content, 0, { id: "admin" }), (error: unknown) => error instanceof MonthlyReportError && error.status === 409);
    await assert.rejects(() => saveMonthlyReport("finance", report.period, { ...report.content, metrics: [{ ...report.content.metrics[0], kpiId: 20 }] }, 1, { id: "admin" }), (error: unknown) => error instanceof MonthlyReportError && error.status === 400);
    const { results: revisions } = await env.DB.prepare("SELECT revision FROM monthly_report_revisions ORDER BY revision").all<{ revision: number }>();
    assert.deepEqual(revisions.map((r) => r.revision), [1]);
    const audit = await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE entity = 'monthly_report'").first<{ count: number }>();
    assert.equal(audit?.count, 1);
    await env.DB.prepare("DELETE FROM kpis WHERE id = 10").run();
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
    await dispose();
  }
});

test("stale revisions return 409 without changing the report, revision history, or audit log", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')").run();
    const initial = await getMonthlyReportBundle("finance", "2026-04-01");
    assert.ok(initial);
    const first = await saveMonthlyReport("finance", initial.period, initial.content, 0, { id: "admin" });
    const updated = { ...first.content, kpiSetChangeNote: "Latest revision" };
    await saveMonthlyReport("finance", initial.period, updated, 1, { id: "admin" });

    for (const revision of [0, 1, 3]) {
      await assert.rejects(
        () => saveMonthlyReport("finance", initial.period, initial.content, revision, { id: "admin" }),
        (error: unknown) => error instanceof MonthlyReportError && error.status === 409 && error.message === "Report has changed. Reload the latest revision.",
      );
    }
    const report = await getMonthlyReportBundle("finance", initial.period);
    assert.equal(report?.revision, 2);
    assert.deepEqual(report?.content, updated);
    const { results: revisions } = await env.DB.prepare("SELECT revision FROM monthly_report_revisions ORDER BY revision").all<{ revision: number }>();
    assert.deepEqual(revisions.map((row) => row.revision), [1, 2]);
    const { results: audit } = await env.DB.prepare("SELECT action, detail FROM audit_logs WHERE entity = 'monthly_report' ORDER BY id").all();
    assert.deepEqual(audit, [{ action: "create", detail: "Revision 1" }, { action: "update", detail: "Revision 2" }]);

    await env.DB.prepare(`CREATE TRIGGER reject_monthly_audit BEFORE INSERT ON audit_logs
      WHEN NEW.entity = 'monthly_report' BEGIN SELECT RAISE(ABORT, 'Audit blocked'); END`).run();
    await assert.rejects(() => saveMonthlyReport("finance", initial.period, initial.content, 2, { id: "admin" }), /Audit blocked/);
    const unchanged = await getMonthlyReportBundle("finance", initial.period);
    assert.equal(unchanged?.revision, 2);
    assert.deepEqual(unchanged?.content, updated);
    const revisionCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM monthly_report_revisions").first<{ count: number }>();
    const auditCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_logs").first<{ count: number }>();
    assert.equal(revisionCount?.count, 2);
    assert.equal(auditCount?.count, 2);
  } finally {
    await dispose();
  }
});

test("concurrent first saves and edits commit exactly one report revision and audit record", async () => {
  const { env, dispose } = await createTestD1();
  const binding = env.DB;
  let gate = Promise.withResolvers<void>();
  try {
    await binding.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')").run();
    const initial = await getMonthlyReportBundle("finance", "2026-04-01");
    assert.ok(initial);
    let pending = 0;
    // Hold both real D1 batches until both editors have read the same revision.
    env.DB = new Proxy(binding, {
      get(target, key) {
        if (key === "batch") return async (statements: D1PreparedStatement[]) => {
          if (++pending === 2) gate.resolve();
          await gate.promise;
          return target.batch(statements);
        };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    for (const expectedRevision of [0, 1]) {
      pending = 0;
      gate = Promise.withResolvers<void>();
      const results: PromiseSettledResult<MonthlyReportBundle>[] = await Promise.allSettled(Array.from({ length: 2 }, (): Promise<MonthlyReportBundle> =>
        saveMonthlyReport("finance", initial.period, initial.content, expectedRevision, { id: "admin" })
          .catch((error: unknown) => { gate.resolve(); throw error; }),
      ));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
      for (const result of results) if (result.status === "rejected") {
        assert.ok(result.reason instanceof MonthlyReportError);
        assert.equal(result.reason.status, 409);
      }
      const counts = await binding.prepare(`SELECT
        (SELECT COUNT(*) FROM monthly_reports) AS reports,
        (SELECT COUNT(*) FROM monthly_report_revisions) AS revisions,
        (SELECT COUNT(*) FROM audit_logs WHERE entity = 'monthly_report') AS audits`).first();
      assert.deepEqual(counts, { reports: 1, revisions: expectedRevision + 1, audits: expectedRevision + 1 });
      const saved = await getMonthlyReportBundle("finance", initial.period);
      assert.equal(saved?.revision, expectedRevision + 1);
    }
  } finally {
    gate.resolve();
    env.DB = binding;
    await dispose();
  }
});

test("monthly snapshots read entries and targets beyond D1's statement parameter limit", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')").run();
    const ids = Array.from({ length: 110 }, (_, index) => index + 1);
    await env.DB.batch(ids.map((id) => env.DB.prepare(
      "INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (?,1,?,'Rp',100,90,80,0)",
    ).bind(id, `Cash ${id}`)));
    await env.DB.batch(ids.flatMap((id) => [
      env.DB.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,created_at) VALUES (?,?,'2026-12-01',0)").bind(id, id),
      env.DB.prepare("INSERT INTO kpi_targets (kpi_id,period_date,target,threshold_green,threshold_yellow) VALUES (?,'2026-12-01',200,180,160)").bind(id),
    ]));
    const report = await getMonthlyReportBundle("finance", "2026-12-01");
    assert.equal(report?.content.metrics.length, ids.length);
    assert.ok(report?.content.metrics.every((metric) => {
      const current = metric.observations.find((row) => row.month === "2026-12-01");
      return current?.actual === metric.kpiId && current.target === 200;
    }));
  } finally {
    await dispose();
  }
});
