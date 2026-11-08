import assert from "node:assert/strict";
import test from "node:test";
import { createTestD1 } from "./test-d1";
import { getMonthlyReportBundle, getMonthlyReportBundles, getMonthlyReportImport, saveMonthlyReport, MonthlyReportError } from "./monthly-report-store";
import { markManualTarget, refreshFromEntries } from "./monthly-report-import";
import { formatDayShort } from "./date-utils";
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

test("new reports prefill from comments and action plans; saved reports flag stale entries until refreshed", async () => {
  const { env, dispose } = await createTestD1();
  try {
    const october = Math.floor(Date.UTC(2026, 9, 15) / 1000);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')"),
      env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (10,1,'Cash','Rp',100,90,80,0)"),
      env.DB.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,note,created_at) VALUES (10,60,'2026-10-01','Dari sheet',1)"),
      env.DB.prepare("INSERT INTO kpi_comments (kpi_id,period_date,content,created_at) VALUES (10,'2026-10-01','<p>lama</p>',1),(10,'2026-10-01','<p>Vendor <b>naik</b> &amp; telat bayar</p>',2),(10,'2026-09-01','<p>bulan lain</p>',3)"),
      env.DB.prepare("INSERT INTO kpi_action_plans (kpi_id,title,owner,due_date,status,created_at,updated_at) VALUES (10,'Renegosiasi vendor','Sari','2026-11-15','open',0,0),(10,'Sudah lewat','Sari','2026-10-20','open',0,0),(10,'Selesai','Sari','2026-12-01','done',0,0)"),
      env.DB.prepare("INSERT INTO timeline_projects (id,name,start_date,end_date,progress,created_at,updated_at) VALUES (3,'Rilis app','2026-09-01','2026-11-30',70,0,0),(4,'Proyek lama','2026-01-01','2026-03-01',100,0,0)"),
      env.DB.prepare("INSERT INTO timeline_project_logs (project_id,content,progress_before,progress_after,created_at) VALUES (3,'a',40,55,?),(3,'b',55,70,?),(3,'c',70,95,?)").bind(october, october + 60, Math.floor(Date.UTC(2026, 10, 3) / 1000)),
    ]);
    const fresh = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.ok(fresh);
    assert.equal(fresh.content.metrics[0].deviationCause, "Vendor naik & telat bayar");
    assert.equal(fresh.content.metrics[0].deviationEvidence, `Komentar KPI #2 (${formatDayShort(new Date(2000))})`);
    assert.deepEqual(fresh.content.actions, [{ action: "Renegosiasi vendor", pic: "Sari", deadline: "2026-11-15" }]);
    assert.equal(fresh.content.metrics[0].observations.find((o) => o.month === "2026-10-01")?.source, "Entri KPI Okt 2026: Dari sheet");
    assert.ok(!fresh.questions.some((q) => q.path.endsWith(".entry")));

    const saved = await saveMonthlyReport("finance", "2026-10-01", fresh.content, 0, { id: "admin" });
    await env.DB.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,created_at) VALUES (10,75,'2026-10-01',2)").run();
    const stale = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.ok(stale?.questions.some((q) => q.path === "metrics.0.observations.2026-10-01.entry"));

    const pulled = await getMonthlyReportImport("finance", "2026-10-01", "entries");
    assert.ok(pulled && "entries" in pulled);
    const refreshed = refreshFromEntries(saved.content, pulled.entries);
    assert.equal(refreshed.changes.length, 1);
    const resaved = await saveMonthlyReport("finance", "2026-10-01", refreshed.content, saved.revision, { id: "admin" });
    assert.equal(resaved.content.metrics[0].observations.find((o) => o.month === "2026-10-01")?.actual, 75);
    assert.ok(!resaved.questions.some((q) => q.path.endsWith(".entry")));

    const timeline = await getMonthlyReportImport("finance", "2026-10-01", "timeline");
    assert.deepEqual(timeline, { lines: [{ id: 3, text: "Rilis app: progress 40%→70%, tanpa status, selesai 2026-11-30 (sumber: Timeline project #3)" }] });

    await env.DB.prepare("DELETE FROM kpi_entries WHERE kpi_id = 10").run();
    const orphaned = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.deepEqual(orphaned?.questions.filter((q) => q.path.endsWith(".entry")).map((q) => q.path), ["metrics.0.observations.2026-10-01.entry"]);
    const emptied = await getMonthlyReportImport("finance", "2026-10-01", "entries");
    assert.ok(emptied && "entries" in emptied);
    const cleared = refreshFromEntries(resaved.content, emptied.entries, new Set(emptied.checkedKpiIds));
    assert.equal(cleared.changes.length, 1);
    const final = await saveMonthlyReport("finance", "2026-10-01", cleared.content, resaved.revision, { id: "admin" });
    assert.equal(final.content.metrics[0].observations.find((o) => o.month === "2026-10-01")?.state, "missing");
    assert.ok(!final.questions.some((q) => q.path.endsWith(".entry")));

    await env.DB.prepare("UPDATE kpis SET is_active = 0 WHERE id = 10").run();
    assert.deepEqual(await getMonthlyReportImport("finance", "2026-10-01", "entries"), { entries: [], checkedKpiIds: [], targets: [] });
  } finally {
    await dispose();
  }
});

test("a new report carries last month's actions with empty status, and the YTD start month", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')"),
      env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (10,1,'Cash','Rp',100,90,80,0)"),
    ]);
    const october = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.ok(october);
    assert.deepEqual(october.content.previousActions, []);
    const draft = structuredClone(october.content);
    draft.actions = [{ action: "Renegosiasi vendor", pic: "Sari", deadline: "2026-11-15" }];
    draft.metrics[0].ytdStartMonth = "2026-03-01";
    await saveMonthlyReport("finance", "2026-10-01", draft, 0, { id: "admin" });

    const november = await getMonthlyReportBundle("finance", "2026-11-01");
    assert.ok(november);
    assert.deepEqual(november.content.previousActions, [{ action: "Renegosiasi vendor", pic: "Sari", deadline: "2026-11-15", status: "", note: "" }]);
    assert.equal(november.questions.filter((q) => q.path.startsWith("previousActions")).length, 1);
    assert.equal(november.content.metrics[0].ytdStartMonth, "2026-03-01");
    assert.equal(november.metrics[0].ytd.label, "YTD Mar–Nov");

    const notes = await getMonthlyReportImport("finance", "2026-11-01", "notes");
    assert.deepEqual(notes && "previousActions" in notes ? notes.previousActions : null, draft.actions.map((a) => ({ ...a, status: "", note: "" })));
  } finally {
    await dispose();
  }
});

test("a new report copies numerator and denominator from the KPI entry", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')"),
      env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (10,1,'Bug completion','%',90,90,80,0)"),
      env.DB.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,numerator,denominator,created_at) VALUES (10,75,'2026-10-01',3,4,1)"),
    ]);
    const report = await getMonthlyReportBundle("finance", "2026-10-01");
    const row = report?.content.metrics[0].observations.find((o) => o.month === "2026-10-01");
    assert.deepEqual([row?.numerator, row?.denominator], [3, 4]);
    const pulled = await getMonthlyReportImport("finance", "2026-10-01", "entries");
    assert.ok(pulled && "entries" in pulled);
    assert.deepEqual(pulled.entries.map((e) => [e.numerator, e.denominator]), [[3, 4]]);
  } finally {
    await dispose();
  }
});

test("a KPI created after a saved report's month leaves that report alone, while new reports include it", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')"),
      env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (10,1,'Cash','Rp',100,90,80,0)"),
    ]);
    const october = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.ok(october);
    const saved = await saveMonthlyReport("finance", "2026-10-01", october.content, 0, { id: "admin" });
    const created = (month: number, day: number) => Math.floor(Date.UTC(2026, month, day) / 1000);
    await env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (11,1,'Bugs','x',5,4,3,?)").bind(created(10, 15)).run();
    const after = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.ok(after);
    assert.deepEqual(after.content.metrics.map((m) => m.kpiId), [10]);
    assert.deepEqual(after.questions, saved.questions);
    assert.equal(after.ready, saved.ready);

    // The same rule applies when saving: the November KPI is not required in October's snapshot.
    await saveMonthlyReport("finance", "2026-10-01", after.content, saved.revision, { id: "admin" });

    const november = await getMonthlyReportBundle("finance", "2026-11-01");
    assert.deepEqual(november?.content.metrics.map((m) => m.kpiId).sort(), [10, 11]);

    // A KPI created inside the report month still joins that month's report, with the KPI-set question.
    await env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (12,1,'Churn','x',5,4,3,?)").bind(created(9, 20)).run();
    const joined = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.deepEqual(joined?.content.metrics.map((m) => m.kpiId), [10, 12]);
    assert.ok(joined?.questions.some((q) => q.path === "kpiSetChangeNote"));
  } finally {
    await dispose();
  }
});

test("report targets from the KPI registry go stale and refresh; hand-typed targets are never touched", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')"),
      env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (10,1,'Cash','Rp',100,90,80,0)"),
      env.DB.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,created_at) VALUES (10,60,'2026-10-01',1)"),
      env.DB.prepare("INSERT INTO kpi_targets (id,kpi_id,period_date,target,threshold_green,threshold_yellow) VALUES (5,10,'2026-10-01',99.5,90,80)"),
    ]);
    const initial = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.ok(initial);
    const saved = await saveMonthlyReport("finance", "2026-10-01", initial.content, 0, { id: "admin" });
    const octoberRow = (bundle: MonthlyReportBundle) => bundle.content.metrics[0].observations.find((o) => o.month === "2026-10-01")!;
    assert.deepEqual([octoberRow(saved).target, octoberRow(saved).targetSource], [99.5, "KPI target override #5 (2026-10-01)"]);
    const staleTarget = (bundle: MonthlyReportBundle | null) => bundle?.questions.filter((q) => q.path === "metrics.0.observations.2026-10-01.target") ?? [];
    assert.equal(staleTarget(saved).length, 0);

    await env.DB.prepare("UPDATE kpi_targets SET target = 98 WHERE id = 5").run();
    const stale = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.equal(staleTarget(stale).length, 1);
    assert.match(staleTarget(stale)[0].question, /berbeda dari target KPI terbaru \(98\)/);

    const pulled = await getMonthlyReportImport("finance", "2026-10-01", "entries");
    assert.ok(pulled && "targets" in pulled);
    assert.deepEqual(pulled.targets.find((t) => t.periodDate === "2026-10-01"), { kpiId: 10, periodDate: "2026-10-01", target: 98, source: "KPI target override #5 (2026-10-01)" });
    const refreshed = refreshFromEntries(saved.content, pulled.entries, new Set(pulled.checkedKpiIds), pulled.targets);
    assert.equal(refreshed.changes.length, 1);
    assert.match(refreshed.changes[0], /target 99\.5 → 98/);
    const resaved = await saveMonthlyReport("finance", "2026-10-01", refreshed.content, saved.revision, { id: "admin" });
    assert.equal(octoberRow(resaved).target, 98);
    assert.equal(staleTarget(resaved).length, 0);

    // A target typed by hand stays, and the registry changing again raises nothing for it.
    const typed = structuredClone(resaved.content);
    const row = typed.metrics[0].observations.find((o) => o.month === "2026-10-01")!;
    Object.assign(row, markManualTarget({ ...row, target: 90 }));
    const manual = await saveMonthlyReport("finance", "2026-10-01", typed, resaved.revision, { id: "admin" });
    await env.DB.prepare("UPDATE kpi_targets SET target = 70 WHERE id = 5").run();
    const after = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.equal(staleTarget(after).length, 0);
    const again = await getMonthlyReportImport("finance", "2026-10-01", "entries");
    assert.ok(again && "targets" in again);
    assert.equal(refreshFromEntries(manual.content, again.entries, new Set(again.checkedKpiIds), again.targets).changes.length, 0);
  } finally {
    await dispose();
  }
});

test("a new report carries last month's risks for review and the plan status of last month's actions", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance')"),
      env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (10,1,'Cash','Rp',100,90,80,0)"),
      env.DB.prepare("INSERT INTO kpi_action_plans (kpi_id,title,owner,due_date,status,created_at,updated_at) VALUES (10,'Renegosiasi vendor','Sari','2026-11-15','done',0,0),(10,'Audit stok','Budi','2026-11-20','cancelled',0,0)"),
    ]);
    const october = await getMonthlyReportBundle("finance", "2026-10-01");
    assert.ok(october);
    const draft = structuredClone(october.content);
    draft.risksReviewed = true;
    draft.risks = [{ issue: "Vendor naik", impact: "Biaya", escalationOwner: "CFO" }];
    draft.actions = [
      { action: "Renegosiasi vendor", pic: "Sari", deadline: "2026-11-15" },
      { action: "Audit stok", pic: "Budi", deadline: "2026-11-20" },
      { action: "Tanpa plan", pic: "Sari", deadline: "2026-11-25" },
    ];
    await saveMonthlyReport("finance", "2026-10-01", draft, 0, { id: "admin" });

    const november = await getMonthlyReportBundle("finance", "2026-11-01");
    assert.ok(november);
    assert.deepEqual(november.content.previousActions.map((a) => a.status), ["done", "dropped", ""]);
    assert.deepEqual(november.content.risks, draft.risks);
    assert.equal(november.content.risksReviewed, false);
    assert.ok(november.questions.some((q) => q.path === "risksReviewed"));
    const notes = await getMonthlyReportImport("finance", "2026-11-01", "notes");
    assert.deepEqual(notes && "previousActions" in notes ? notes.previousActions?.map((a) => a.status) : null, ["done", "dropped", ""]);

    // December skips November: October is not "last month", so nothing is carried.
    const december = await getMonthlyReportBundle("finance", "2026-12-01");
    assert.deepEqual([december?.content.previousActions, december?.content.risks], [[], []]);
    const skipped = await getMonthlyReportImport("finance", "2026-12-01", "notes");
    assert.deepEqual(skipped && "previousActions" in skipped ? skipped.previousActions : null, []);
  } finally {
    await dispose();
  }
});

test("bundles for several domains match the single-domain bundles with a constant number of queries", async () => {
  const { env, dispose } = await createTestD1();
  const binding = env.DB;
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance'),(2,'Sales','sales'),(3,'Ops','ops')"),
      env.DB.prepare(`INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES
        (10,1,'Cash','Rp',100,90,80,0),(11,1,'Margin','%',50,40,30,0),(20,2,'Orders','n',100,90,80,0),(30,3,'Uptime','%',99,95,90,0)`),
      env.DB.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,created_at) VALUES (10,60,'2026-10-01',1),(20,70,'2026-10-01',1),(30,99,'2026-10-01',1)"),
    ]);
    for (const slug of ["finance", "sales"]) {
      const draft = await getMonthlyReportBundle(slug, "2026-10-01");
      assert.ok(draft);
      await saveMonthlyReport(slug, "2026-10-01", draft.content, 0, { id: "admin" });
    }
    // A KPI added after saving makes one saved report merge it in, the heaviest path.
    await env.DB.prepare("INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (21,2,'Refunds','n',1,1,1,?)").bind(Math.floor(Date.UTC(2026, 9, 20) / 1000)).run();
    const singles = await Promise.all([1, 2, 3].map((id) => getMonthlyReportBundle(["finance", "sales", "ops"][id - 1], "2026-10-01")));

    let prepares = 0;
    env.DB = new Proxy(binding, {
      get(target, key) {
        if (key === "prepare") return (sql: string) => { prepares++; return target.prepare(sql); };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const bundles = await getMonthlyReportBundles("2026-10-01", [1, 2, 3, 99]);
    env.DB = binding;
    assert.deepEqual([...bundles.keys()], [1, 2, 3]);
    assert.deepEqual([...bundles.values()], singles);
    assert.ok(prepares <= 8, `expected at most 8 queries, got ${prepares}`);
  } finally {
    env.DB = binding;
    await dispose();
  }
});
