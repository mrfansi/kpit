import assert from "node:assert/strict";
import test from "node:test";
import { createTestD1 } from "./test-d1";
import { getMonthlyReportBundle, MonthlyReportError, saveMonthlyReport } from "./monthly-report-store";
import { getReportSummaries, getRevisionBundle, listRevisions, reportStatus } from "./monthly-report-revisions";

test("reportStatus labels not created, draft with question count, and ready", () => {
  const question = { id: "a", path: "a", question: "?" };
  assert.deepEqual(reportStatus({ revision: 0, questions: [question] }), { kind: "none", label: "Belum dibuat" });
  assert.deepEqual(reportStatus({ revision: 2, questions: [question, question] }), { kind: "draft", label: "Draf, 2 pertanyaan" });
  assert.deepEqual(reportStatus({ revision: 1, questions: [] }), { kind: "ready", label: "Siap" });
});

test("summaries match the editor's question count and old revisions keep their own content", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Finance','finance'),(2,'Sales','sales')"),
      env.DB.prepare("INSERT INTO kpis (id,domain_id,name,description,unit,target,threshold_green,threshold_yellow,created_at) VALUES (10,1,'Cash','Month-end cash','Rp',100,90,80,0)"),
      env.DB.prepare("INSERT INTO users (id,email,name,password_hash,role,created_at,updated_at) VALUES ('u1','a@x.id','Ani','h','admin',0,0)"),
    ]);
    const period = "2026-04-01";
    const initial = await getMonthlyReportBundle("finance", period);
    assert.ok(initial);
    const first = await saveMonthlyReport("finance", period, { ...initial.content, worstOutcome: "revisi satu" }, 0, { id: "u1" });
    await saveMonthlyReport("finance", period, { ...first.content, worstOutcome: "revisi dua" }, 1, { id: "u1" });

    const summaries = await getReportSummaries([{ id: 1, slug: "finance" }, { id: 2, slug: "sales" }], period);
    const finance = summaries.get(1)!;
    const editor = await getMonthlyReportBundle("finance", period);
    assert.equal(finance.revision, 2);
    assert.equal(finance.updatedBy, "Ani");
    assert.equal(finance.status.label, `Draf, ${editor!.questions.length} pertanyaan`);
    assert.equal(summaries.get(2)!.status.label, "Belum dibuat");

    const oldRev = await getRevisionBundle("finance", period, 1);
    assert.equal(oldRev.content.worstOutcome, "revisi satu");
    assert.ok(oldRev.archivedAt);
    const currentRev = await getRevisionBundle("finance", period, 2);
    const { archivedAt, ...rest } = currentRev;
    assert.equal(archivedAt, null);
    assert.deepEqual(rest, editor);
    const listed = await listRevisions("finance", period);
    assert.deepEqual(listed?.revisions.map((r) => [r.revision, r.author]), [[2, "Ani"], [1, "Ani"]]);
    await assert.rejects(() => getRevisionBundle("finance", period, 3), (e: unknown) => e instanceof MonthlyReportError && e.status === 404);
    await assert.rejects(() => getRevisionBundle("missing", period, 1), (e: unknown) => e instanceof MonthlyReportError && e.status === 404);
    assert.equal(await listRevisions("missing", period), null);
  } finally {
    await dispose();
  }
});
