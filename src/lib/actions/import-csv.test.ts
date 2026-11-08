import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { domains, kpiEntries, kpis } from "../db/schema";
import { createTestD1 } from "../test-d1";
import { installTestEnv } from "../../testing/cloudflare-workers";
import type * as ImportActions from "./import-csv";

const load = createRequire(resolve("src/lib/actions/import-csv.test.ts"));

test("CSV entry import enforces the same rules as the manual form", async (t) => {
  const session = { user: { id: "csv-admin", email: "admin@example.test", name: "Admin" } };
  const stubs: [string, object][] = [
    [load.resolve("../auth-utils"), { requireAdmin: async () => session, requireAuth: async () => session }],
    [load.resolve("next/cache"), { revalidatePath() {} }],
  ];
  const originals = stubs.map(([path]) => [path, load.cache[path]] as const);
  for (const [path, exports] of stubs) {
    load.cache[path] = Object.assign(new Module(path), { filename: path, exports, loaded: true });
  }
  const action = load.resolve("./import-csv");
  t.after(() => {
    delete load.cache[action];
    for (const [path, original] of originals) {
      if (original) load.cache[path] = original;
      else delete load.cache[path];
    }
  });
  const { resolveCSVRows, importCSVRows } = load("./import-csv") as typeof ImportActions;
  const environment = await createTestD1();
  t.after(() => environment.dispose());

  const [domainA, domainB] = await db.insert(domains).values([
    { name: "CSV A", slug: "csv-a" },
    { name: "CSV B", slug: "csv-b" },
  ]).returning();
  const base = { target: 90, thresholdGreen: 80, thresholdYellow: 60, period: "monthly" as const };
  const [scale, other] = await db.insert(kpis).values([
    { ...base, domainId: domainA.id, name: "Skor", unit: "%", minValue: 0, maxValue: 100 },
    { ...base, domainId: domainA.id, name: "Bebas", unit: "%" },
  ]).returning();
  await db.insert(kpis).values([
    { ...base, domainId: domainA.id, name: "Kembar" },
    { ...base, domainId: domainB.id, name: "Kembar" },
  ]);

  await t.test("rejects values outside KPI bounds in preview and on direct import", async () => {
    const { resolved, errors } = await resolveCSVRows("kpi_name,period_date,value\nSkor,2026-10-01,1000\n");
    assert.equal(resolved.length, 0);
    assert.match(errors[0].message, /melebihi batas maksimum/);

    const result = await importCSVRows([{ kpiName: "Skor", kpiId: scale.id, periodDate: "2026-10-01", value: 1000 }]);
    assert.equal(result.imported, 0);
    assert.equal(result.skipped, 1);
    assert.equal((await db.select().from(kpiEntries).where(eq(kpiEntries.kpiId, scale.id))).length, 0);
  });

  await t.test("rejects comma decimals and thousand separators instead of truncating", async () => {
    const { resolved, errors } = await resolveCSVRows(
      'kpi_name,period_date,value\nBebas,2026-10-01,"75,5"\nBebas,2026-11-01,"1.500.000"\nBebas,2026-12-01,12abc\n',
    );
    assert.equal(resolved.length, 0);
    assert.equal(errors.length, 3);
    assert.ok(errors.every((e) => /value tidak valid/.test(e.message)));
  });

  await t.test("rejects non-first-of-month dates, ambiguous names and duplicate rows", async () => {
    const { resolved, errors } = await resolveCSVRows([
      "kpi_name,period_date,value",
      "Bebas,2026-10-31,5",
      "Kembar,2026-10-01,5",
      "Bebas,2026-09-01,5",
      "Bebas,2026-09-01,6",
    ].join("\n"));
    assert.deepEqual(resolved.map((r) => r.rowIndex), [4]);
    assert.deepEqual(errors.map((e) => e.row), [2, 3, 5]);
    assert.match(errors[0].message, /tanggal 01/);
    assert.match(errors[1].message, /ambigu/);
    assert.match(errors[2].message, /Duplikat/);
  });

  await t.test("overwrites an existing period and flags it in the preview", async () => {
    await db.insert(kpiEntries).values({ kpiId: other.id, periodDate: "2026-08-01", value: 10 });
    const { resolved, errors } = await resolveCSVRows("kpi_name,period_date,value\nBebas,2026-08-01,42.5\n");
    assert.deepEqual(errors, []);
    assert.equal(resolved[0].existingValue, 10);

    const result = await importCSVRows(resolved);
    assert.equal(result.imported, 1);
    const rows = await db.select().from(kpiEntries)
      .where(and(eq(kpiEntries.kpiId, other.id), eq(kpiEntries.periodDate, "2026-08-01")));
    assert.deepEqual(rows.map((r) => r.value), [42.5]);
  });

  await t.test("preview of 5000 rows runs one existence query, and overwrite keeps parts of an unchanged value", async () => {
    const bulk = await db.insert(kpis).values(
      Array.from({ length: 5 }, (_, i) => ({ ...base, domainId: domainA.id, name: `Massal ${i}`, unit: "jt" })),
    ).returning();
    await db.insert(kpiEntries).values([
      { kpiId: bulk[0].id, periodDate: "2040-03-01", value: 90, numerator: 45, denominator: 50 },
      { kpiId: bulk[1].id, periodDate: "2040-03-01", value: 7, numerator: 7, denominator: 1 },
    ]);

    const lines = ["kpi_id,period_date,value"];
    for (const kpi of bulk) {
      for (let m = 0; m < 1000; m++) {
        const periodDate = `${2000 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`;
        lines.push(`${kpi.id},${periodDate},${periodDate === "2040-03-01" && kpi.id === bulk[0].id ? 90 : 1}`);
      }
    }

    const real = environment.env.DB;
    let queries = 0;
    const counting = new Proxy(real, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== "function") return value;
        return key === "prepare" ? (sql: string) => { queries++; return target.prepare(sql); } : value.bind(target);
      },
    });
    const previous = installTestEnv({ ...environment.env, DB: counting });
    let resolvedRows: ImportActions.ImportRow[] = [];
    try {
      const preview = await resolveCSVRows(lines.join("\n"));
      assert.deepEqual(preview.errors, []);
      assert.equal(preview.resolved.length, 5000);
      // Satu query untuk daftar KPI dan satu untuk entri yang ada.
      assert.ok(queries <= 2, `expected <= 2 queries, got ${queries}`);
      assert.deepEqual(
        preview.resolved.filter((r) => r.existingValue !== undefined).map((r) => [r.kpiId, r.existingValue]),
        [[bulk[0].id, 90], [bulk[1].id, 7]],
      );
      resolvedRows = preview.resolved.filter((r) => r.periodDate === "2040-03-01" && r.kpiId !== bulk[2].id);
    } finally {
      installTestEnv(previous);
    }

    // Baris pertama bernilai sama (parts tetap), baris kedua nilainya berubah (parts dibuang).
    const result = await importCSVRows(resolvedRows.slice(0, 2));
    assert.equal(result.imported, 2);
    const stored = await db.select().from(kpiEntries).where(and(eq(kpiEntries.periodDate, "2040-03-01")));
    const byKpi = new Map(stored.map((e) => [e.kpiId, [e.value, e.numerator, e.denominator]]));
    assert.deepEqual(byKpi.get(bulk[0].id), [90, 45, 50]);
    assert.deepEqual(byKpi.get(bulk[1].id), [1, null, null]);
  });
});
