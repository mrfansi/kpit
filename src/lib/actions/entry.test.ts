import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, domains, kpiEntries, kpis } from "../db/schema";
import { createTestD1 } from "../test-d1";
import type * as EntryActions from "./entry";

const load = createRequire(resolve("src/lib/actions/entry.test.ts"));

test("entry actions validate like the form and audit old to new values", async (t) => {
  const session = { user: { id: "entry-admin", email: "admin@example.test", name: "Admin" } };
  const stubs: [string, object][] = [
    [load.resolve("../auth-utils"), { requireAdmin: async () => session, requireAuth: async () => session }],
    [load.resolve("next/cache"), { revalidatePath() {} }],
  ];
  const originals = stubs.map(([path]) => [path, load.cache[path]] as const);
  for (const [path, exports] of stubs) {
    load.cache[path] = Object.assign(new Module(path), { filename: path, exports, loaded: true });
  }
  const action = load.resolve("./entry");
  t.after(() => {
    delete load.cache[action];
    for (const [path, original] of originals) {
      if (original) load.cache[path] = original;
      else delete load.cache[path];
    }
  });
  const { createEntry, updateEntry, bulkCreateEntries } = load("./entry") as typeof EntryActions;
  const environment = await createTestD1();
  t.after(() => environment.dispose());

  const [domain] = await db.insert(domains).values({ name: "Entry", slug: "entry" }).returning();
  const base = { domainId: domain.id, target: 90, thresholdGreen: 80, thresholdYellow: 60, period: "monthly" as const, unit: "%" };
  const [scaled, free] = await db.insert(kpis).values([
    { ...base, name: "Skor", minValue: 0, maxValue: 100 },
    { ...base, name: "Bebas" },
  ]).returning();

  await t.test("bulk with one out-of-bounds row returns an error and writes nothing", async () => {
    const result = await bulkCreateEntries([
      { kpiId: free.id, periodDate: "2026-10-01", value: 5 },
      { kpiId: scaled.id, periodDate: "2026-10-01", value: 1000 },
    ]);
    assert.ok("error" in result);
    assert.equal((await db.select().from(kpiEntries)).length, 0);
  });

  await t.test("bulk rejects mixed periods, duplicate KPIs, impossible dates and non-first-of-month", async () => {
    const mixed = await bulkCreateEntries([
      { kpiId: free.id, periodDate: "2026-10-01", value: 1 },
      { kpiId: scaled.id, periodDate: "2026-11-01", value: 1 },
    ]);
    assert.ok("error" in mixed);
    const duplicate = await bulkCreateEntries([
      { kpiId: free.id, periodDate: "2026-10-01", value: 1 },
      { kpiId: free.id, periodDate: "2026-10-01", value: 2 },
    ]);
    assert.ok("error" in duplicate);
    assert.ok("error" in await bulkCreateEntries([{ kpiId: free.id, periodDate: "2026-02-30", value: 1 }]));
    assert.ok("error" in await bulkCreateEntries([{ kpiId: free.id, periodDate: "2026-10-15", value: 1 }]));
    assert.ok("error" in await createEntry({ kpiId: free.id, periodDate: "2026-10-15", value: 1 }));
    assert.equal((await db.select().from(kpiEntries)).length, 0);
  });

  await t.test("updateEntry out of bounds leaves the entry unchanged; a valid edit audits old to new", async () => {
    assert.deepEqual(await createEntry({ kpiId: scaled.id, periodDate: "2026-09-01", value: 92 }), { success: true });
    const [entry] = await db.select().from(kpiEntries).where(eq(kpiEntries.kpiId, scaled.id));

    assert.ok("error" in await updateEntry(entry.id, 1000));
    assert.equal((await db.select().from(kpiEntries).where(eq(kpiEntries.id, entry.id)))[0].value, 92);

    assert.deepEqual(await updateEntry(entry.id, 45), { success: true });
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "update"));
    const log = logs.find((l) => l.entity === "kpi_entry");
    assert.equal(log?.entityId, `${scaled.id}:2026-09-01`);
    assert.match(log?.detail ?? "", /value: 92 → 45/);
  });

  await t.test("overwriting a period through createEntry audits old to new", async () => {
    assert.deepEqual(await createEntry({ kpiId: scaled.id, periodDate: "2026-09-01", value: 50 }), { success: true });
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, `${scaled.id}:2026-09-01`));
    assert.ok(logs.some((l) => /value: 45 → 50/.test(l.detail ?? "")));
    assert.equal((await db.select().from(kpiEntries).where(eq(kpiEntries.kpiId, scaled.id))).length, 1);
  });

  await t.test("pembilang/penyebut compute the value server-side and are stored; one part or zero denominator is rejected", async () => {
    const periodDate = "2026-08-01";
    const stored = async () => (await db.select().from(kpiEntries).where(eq(kpiEntries.kpiId, free.id))).map((e) => [e.value, e.numerator, e.denominator]);

    // Nilai kiriman klien (1) diabaikan; server menghitung 45 / 50 x 100.
    assert.deepEqual(await createEntry({ kpiId: free.id, periodDate, value: 1, numerator: 45, denominator: 50 }), { success: true });
    assert.deepEqual(await stored(), [[90, 45, 50]]);

    assert.ok("error" in await createEntry({ kpiId: free.id, periodDate, value: 10, numerator: 5 }));
    assert.ok("error" in await createEntry({ kpiId: free.id, periodDate, value: 10, denominator: 5 }));
    assert.ok("error" in await createEntry({ kpiId: free.id, periodDate, value: 10, numerator: 5, denominator: 0 }));
    assert.ok("error" in await bulkCreateEntries([{ kpiId: free.id, periodDate, value: 10, numerator: 5, denominator: 0 }]));
    assert.deepEqual(await stored(), [[90, 45, 50]]);

    assert.deepEqual(await bulkCreateEntries([{ kpiId: free.id, periodDate, value: 0, numerator: 9, denominator: 10 }]), { saved: 1 });
    assert.deepEqual(await stored(), [[90, 9, 10]]);
  });
});
