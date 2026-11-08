import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { db } from "../db";
import { domains, kpis } from "../db/schema";
import { createTestD1 } from "../test-d1";
import type * as TargetImportActions from "./import-target-csv";

const load = createRequire(resolve("src/lib/actions/import-target-csv.test.ts"));

test("target CSV import applies direction-aware defaults and rejects duplicates", async (t) => {
  const session = { user: { id: "target-admin", email: "admin@example.test", name: "Admin" } };
  const stubs: [string, object][] = [
    [load.resolve("../auth-utils"), { requireAdmin: async () => session, requireAuth: async () => session }],
    [load.resolve("next/cache"), { revalidatePath() {} }],
  ];
  const originals = stubs.map(([path]) => [path, load.cache[path]] as const);
  for (const [path, exports] of stubs) {
    load.cache[path] = Object.assign(new Module(path), { filename: path, exports, loaded: true });
  }
  const action = load.resolve("./import-target-csv");
  t.after(() => {
    delete load.cache[action];
    for (const [path, original] of originals) {
      if (original) load.cache[path] = original;
      else delete load.cache[path];
    }
  });
  const { resolveTargetCSVRows } = load("./import-target-csv") as typeof TargetImportActions;
  const environment = await createTestD1();
  t.after(() => environment.dispose());

  const [domain] = await db.insert(domains).values({ name: "Target", slug: "target" }).returning();
  await db.insert(kpis).values({
    domainId: domain.id, name: "Biaya", unit: "jt", period: "monthly", direction: "lower_better",
    target: 100, thresholdGreen: 110, thresholdYellow: 130,
  });

  await t.test("lower_better defaults put green at or above target", async () => {
    const { resolved, errors } = await resolveTargetCSVRows("kpi_name,period_date,target\nBiaya,2026-10-01,100\n");
    assert.deepEqual(errors, []);
    assert.ok(resolved[0].thresholdGreen >= resolved[0].target);
    assert.ok(resolved[0].thresholdYellow > resolved[0].thresholdGreen);
  });

  await t.test("rejects a duplicate KPI and period", async () => {
    const { resolved, errors } = await resolveTargetCSVRows([
      "kpi_name,period_date,target",
      "Biaya,2026-10-01,100",
      "Biaya,2026-10-01,120",
    ].join("\n"));
    assert.equal(resolved.length, 1);
    assert.deepEqual(errors.map((e) => e.row), [3]);
    assert.match(errors[0].message, /Duplikat/);
  });

  await t.test("accepts a zero target", async () => {
    const { resolved, errors } = await resolveTargetCSVRows("kpi_name,period_date,target\nBiaya,2026-11-01,0\n");
    assert.deepEqual(errors, []);
    assert.equal(resolved[0].target, 0);
  });
});
