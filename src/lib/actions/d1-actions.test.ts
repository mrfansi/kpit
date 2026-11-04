import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, domains, kpis, timelineProjects, timelineProjectStatuses } from "../db/schema";
import { createTestD1 } from "../test-d1";
import type * as KPIActions from "./kpi";
import type * as TimelineStatusActions from "./timeline-statuses";

const load = createRequire(resolve("src/lib/actions/d1-actions.test.ts"));

test("server actions persist atomically against local D1", async (t) => {
  const session = { user: { id: "d1-action-admin", email: "admin@example.test", name: "Admin" } };
  const stubs: [string, object][] = [
    [load.resolve("../auth-utils"), { requireAdmin: async () => session, requireAuth: async () => session }],
    [load.resolve("next/cache"), { revalidatePath() {} }],
    [load.resolve("next/navigation"), { redirect(path: string) { throw new Error(`NEXT_REDIRECT:${path}`); } }],
  ];
  const originals = stubs.map(([path]) => [path, load.cache[path]] as const);
  for (const [path, exports] of stubs) {
    load.cache[path] = Object.assign(new Module(path), { filename: path, exports, loaded: true });
  }
  const actions = [load.resolve("./kpi"), load.resolve("./timeline-statuses")];
  t.after(() => {
    for (const path of actions) delete load.cache[path];
    for (const [path, original] of originals) {
      if (original) load.cache[path] = original;
      else delete load.cache[path];
    }
  });
  // tsx loads these CommonJS actions after their request-only auth/cache imports are stubbed.
  const { createKPI, reorderKPI, bulkReorderKPIs } = load("./kpi") as typeof KPIActions;
  const { createStatus, deleteStatus } = load("./timeline-statuses") as typeof TimelineStatusActions;
  const environment = await createTestD1();
  t.after(() => environment.dispose());

  await t.test("createKPI increments active-domain sort order, including concurrent creates", async () => {
    const [domain] = await db.insert(domains).values({ name: "D1 create", slug: "d1-create" }).returning();
    const [other] = await db.insert(domains).values({ name: "D1 other", slug: "d1-other" }).returning();
    const values = {
      domainId: domain.id,
      name: "First KPI",
      unit: "%",
      target: 100,
      thresholdGreen: 90,
      thresholdYellow: 70,
      direction: "higher_better" as const,
      refreshType: "periodic" as const,
      period: "monthly" as const,
    };
    await db.batch([
      db.insert(kpis).values({ ...values, name: "Archived KPI", isActive: false, sortOrder: 99 }),
      db.insert(kpis).values({ ...values, domainId: other.id, name: "Other domain KPI", sortOrder: 500 }),
    ]);
    await assert.rejects(createKPI(values), /NEXT_REDIRECT:/);
    await assert.rejects(createKPI({ ...values, name: "Second KPI" }), /NEXT_REDIRECT:/);
    assert.deepEqual(
      (await db.select({ sortOrder: kpis.sortOrder }).from(kpis)
        .where(and(eq(kpis.domainId, domain.id), eq(kpis.isActive, true))).orderBy(kpis.sortOrder))
        .map((row) => row.sortOrder),
      [0, 1],
    );
    await db.update(kpis).set({ sortOrder: 7 }).where(eq(kpis.name, "Second KPI"));
    await Promise.all([
      assert.rejects(createKPI({ ...values, name: "Concurrent A" }), /NEXT_REDIRECT:/),
      assert.rejects(createKPI({ ...values, name: "Concurrent B" }), /NEXT_REDIRECT:/),
    ]);
    assert.deepEqual(
      (await db.select({ sortOrder: kpis.sortOrder }).from(kpis)
        .where(and(eq(kpis.domainId, domain.id), eq(kpis.isActive, true))).orderBy(kpis.sortOrder))
        .map((row) => row.sortOrder),
      [0, 7, 8, 9],
    );
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.entity, "kpi"));
    assert.equal(audits.length, 4);
  });

  await t.test("reorder normalizes and swaps once; bulk reorder handles more than 100 IDs", async () => {
    const [domain] = await db.insert(domains).values({ name: "D1 reorder", slug: "d1-reorder" }).returning();
    const inserts = Array.from({ length: 105 }, (_, index) => db.insert(kpis).values({
      domainId: domain.id,
      name: `Reorder ${index}`,
      target: 100,
      thresholdGreen: 90,
      thresholdYellow: 70,
      sortOrder: index * 2,
    }).returning({ id: kpis.id }));
    const inserted = await db.batch([inserts[0], ...inserts.slice(1)]);
    const ids = inserted.map((rows) => rows[0].id);
    await reorderKPI(ids[1], "up");
    const moved = await db.select({ id: kpis.id, sortOrder: kpis.sortOrder }).from(kpis)
      .where(eq(kpis.domainId, domain.id)).orderBy(kpis.sortOrder);
    assert.deepEqual(moved.map((row) => row.id), [ids[1], ids[0], ...ids.slice(2)]);
    assert.deepEqual(moved.map((row) => row.sortOrder), ids.map((_, index) => index));
    const reversed = [...ids].reverse();
    await bulkReorderKPIs(reversed.map((id, sortOrder) => ({ id, sortOrder })));
    assert.deepEqual(
      (await db.select({ id: kpis.id }).from(kpis).where(eq(kpis.domainId, domain.id))
        .orderBy(kpis.sortOrder)).map((row) => row.id),
      reversed,
    );
    await bulkReorderKPIs([]);
  });

  await t.test("in-use status survives deletion and only an actual deletion is audited", async () => {
    const form = new FormData();
    form.set("name", "D1 Active");
    form.set("color", "#123456");
    await createStatus(form);
    const status = await db.select().from(timelineProjectStatuses)
      .where(eq(timelineProjectStatuses.slug, "d1_active")).get();
    assert.ok(status);
    const [project] = await db.insert(timelineProjects).values({
      name: "Uses D1 status",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      statusId: status.id,
    }).returning();
    const deletionAudits = () => db.select().from(auditLogs).where(and(
      eq(auditLogs.entity, "timeline_project_status"),
      eq(auditLogs.entityId, String(status.id)),
      eq(auditLogs.action, "delete"),
    ));
    await assert.rejects(deleteStatus(status.id), {
      message: "Status ini masih digunakan oleh 1 project. Ubah status project tersebut terlebih dahulu.",
    });
    assert.ok(await db.select().from(timelineProjectStatuses).where(eq(timelineProjectStatuses.id, status.id)).get());
    assert.equal((await db.select().from(timelineProjects).where(eq(timelineProjects.id, project.id)).get())?.statusId, status.id);
    assert.equal((await deletionAudits()).length, 0);
    await db.update(timelineProjects).set({ statusId: null }).where(eq(timelineProjects.id, project.id));
    await deleteStatus(status.id);
    assert.equal(await db.select().from(timelineProjectStatuses).where(eq(timelineProjectStatuses.id, status.id)).get(), undefined);
    assert.equal((await deletionAudits()).length, 1);
    await deleteStatus(status.id);
    assert.equal((await deletionAudits()).length, 1);
  });
});
