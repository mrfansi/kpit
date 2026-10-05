import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { migrateDatabase } from "../scripts/migrate-db";

const month = (index: number) => {
  const date = new Date(Date.UTC(2025, index, 1));
  return date.toISOString().slice(0, 10);
};

// The runtime DB singleton is imported only after pointing it at this isolated migrated file.
test("sparkline holds the 12 newest entries per KPI in chronological order, respecting the period cutoff", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kpit-queries-"));
  const former = process.env.DATABASE_URL;
  const path = join(directory, "queries.sqlite");
  process.env.DATABASE_URL = path;
  try {
    migrateDatabase(path, resolve("drizzle"));
    const sqlite = new Database(path);
    sqlite.exec(`INSERT INTO domains (id,name,slug) VALUES (1,'Sales','sales');
      INSERT INTO kpis (id,domain_id,name,unit,target,threshold_green,threshold_yellow,created_at) VALUES
      (10,1,'Revenue','%',100,90,80,0),(20,1,'Leads','%',100,90,80,0);`);
    const insert = sqlite.prepare("INSERT INTO kpi_entries (kpi_id,value,period_date,created_at) VALUES (?,?,?,0)");
    // KPI 10: 15 monthly entries (Jan 2025 .. Mar 2026) with value = month index; inserted out of order.
    for (const index of [14, 0, 7, 3, 12, 1, 9, 5, 13, 2, 11, 6, 10, 4, 8]) insert.run(10, index, month(index));
    insert.run(20, 50, month(0));
    insert.run(20, 60, month(1));
    sqlite.close();

    const { getKPIsWithLatestEntry } = await import("./queries");

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
    if (former === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = former;
    rmSync(directory, { recursive: true, force: true });
  }
});
