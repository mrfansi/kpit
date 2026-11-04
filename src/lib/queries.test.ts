import assert from "node:assert/strict";
import test from "node:test";
import { createTestD1 } from "./test-d1";
import * as queries from "./queries";
import { getKPIsWithLatestEntry } from "./queries";

const month = (index: number) => {
  const date = new Date(Date.UTC(2025, index, 1));
  return date.toISOString().slice(0, 10);
};

// Query the same isolated D1 runtime binding used by the deployed application.
test("sparkline holds the 12 newest entries per KPI in chronological order, respecting the period cutoff", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Sales','sales')"),
      env.DB.prepare(`INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES
        (10,1,'Revenue','%',100,90,80,0),(20,1,'Leads','%',100,90,80,0)`),
    ]);
    const insert = "INSERT INTO kpi_entries (kpi_id,value,period_date,created_at) VALUES (?,?,?,0)";
    // KPI 10: 15 monthly entries (Jan 2025 .. Mar 2026) with value = month index; inserted out of order.
    await env.DB.batch([
      ...[14, 0, 7, 3, 12, 1, 9, 5, 13, 2, 11, 6, 10, 4, 8].map((index) => env.DB.prepare(insert).bind(10, index, month(index))),
      env.DB.prepare(insert).bind(20, 50, month(0)),
      env.DB.prepare(insert).bind(20, 60, month(1)),
    ]);

    const all = await getKPIsWithLatestEntry(1);
    const revenue = all.find((row) => row.kpi.id === 10);
    const leads = all.find((row) => row.kpi.id === 20);
    assert.ok(revenue && leads);
    assert.deepEqual(revenue.sparklineEntries.map((e) => e.value), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    assert.equal(revenue.latestEntry?.value, 14);
    assert.equal(revenue.sparklineEntries.at(-1)?.periodDate, revenue.latestEntry?.periodDate);
    assert.deepEqual(leads.sparklineEntries.map((e) => e.value), [50, 60]);

    const cutoff = (await getKPIsWithLatestEntry(1, month(9))).find((row) => row.kpi.id === 10);
    assert.deepEqual(cutoff?.sparklineEntries.map((e) => e.value), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  } finally {
    await dispose();
  }
});

test("batch queries preserve results and global date order above D1's parameter limit", async () => {
  const { env, dispose } = await createTestD1();
  try {
    await env.DB.prepare("INSERT INTO domains (id,name,slug) VALUES (1,'Sales','sales')").run();
    const ids = Array.from({ length: 120 }, (_, index) => index + 1);
    await env.DB.batch(ids.map((id) => env.DB.prepare(
      "INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES (?,1,?,'%',100,90,80,0)"
    ).bind(id, `KPI ${id}`)));
    await env.DB.batch(ids.flatMap((id) => [
      env.DB.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,created_at) VALUES (?,?,'2026-02-01',0)").bind(id, id),
      env.DB.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,created_at) VALUES (?,?,'2026-01-01',0)").bind(id, id - 1),
      env.DB.prepare("INSERT INTO kpi_targets (kpi_id,period_date,target,threshold_green,threshold_yellow) VALUES (?,'2026-02-01',200,180,160)").bind(id),
      env.DB.prepare("INSERT INTO kpi_action_plans (kpi_id,title,owner,due_date,status,created_at,updated_at) VALUES (?,'Plan','Admin','2026-03-01','open',0,0)").bind(id),
    ]));
    const latest = await queries.getKPIsWithLatestEntry(1, "2026-02-01");
    assert.equal(latest.length, ids.length);
    assert.ok(latest.every((row) => row.latestEntry?.value === row.kpi.id && row.effectiveTarget.target === 200));
    const comparisons = await queries.getBatchPeriodComparison([...ids, 1], "2026-02-01");
    assert.equal(comparisons.size, ids.length);
    assert.ok(ids.every((id) => comparisons.get(id)?.prevMonth?.value === id - 1));
    const counts = await queries.getActionPlanCountsByKPIIds([...ids, 1]);
    assert.ok(ids.every((id) => counts.get(id) === 1));
    const entries = await queries.getAllKPIEntriesBatch([...ids, 1], "2026-01-01", "2026-02-01");
    assert.equal(entries.length, ids.length * 2);
    assert.deepEqual(entries.map((entry) => entry.periodDate), [
      ...ids.map(() => "2026-01-01"),
      ...ids.map(() => "2026-02-01"),
    ]);
  } finally {
    await dispose();
  }
});
