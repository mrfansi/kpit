"use server";

import { db } from "@/lib/db";
import { kpis, domains, type NewKPI } from "@/lib/db/schema";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { kpiSchema } from "@/lib/validations/kpi";

async function assertDomainExists(domainId: number) {
  const domain = await db.select({ id: domains.id }).from(domains).where(eq(domains.id, domainId)).get();
  if (!domain) throw new Error("Domain tidak ditemukan");
}

export async function createKPI(data: Omit<NewKPI, "createdAt">) {
  const session = await requireAdmin();

  // Server-side validation: kpiSchema is otherwise only enforced client-side.
  const parsed = kpiSchema.parse(data);
  await assertDomainExists(parsed.domainId);

  // MAX(sort_order)+1 read and insert atomic to avoid duplicate sort positions.
  db.transaction((tx) => {
    const [maxRow] = tx
      .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(kpis)
      .where(and(eq(kpis.domainId, parsed.domainId), eq(kpis.isActive, true)))
      .all();
    const nextOrder = (maxRow?.max ?? -1) + 1;

    tx.insert(kpis).values({ ...parsed, sortOrder: nextOrder }).run();
    logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi", detail: parsed.name }, tx);
  });

  revalidatePath("/");
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil ditambahkan")}`);
}

export async function updateKPI(id: number, data: Partial<Omit<NewKPI, "id" | "createdAt">>) {
  const session = await requireAdmin();

  // Server-side validation (partial: only provided fields are checked/written).
  const parsed = kpiSchema.partial().parse(data);
  if (parsed.domainId !== undefined) await assertDomainExists(parsed.domainId);

  db.transaction((tx) => {
    tx.update(kpis).set(parsed).where(eq(kpis.id, id)).run();
    logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: parsed.name }, tx);
  });

  revalidatePath("/");
  revalidatePath(`/kpi/${id}`);
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil diperbarui")}`);
}

export async function archiveKPI(id: number) {
  const session = await requireAdmin();
  await db.update(kpis).set({ isActive: false }).where(eq(kpis.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: "archived" });
  revalidatePath("/");
  revalidatePath("/admin/kpi");
}

export async function restoreKPI(id: number) {
  const session = await requireAdmin();
  await db.update(kpis).set({ isActive: true }).where(eq(kpis.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: "restored" });
  revalidatePath("/");
  revalidatePath("/admin/kpi");
  revalidatePath("/admin/kpi/archived");
}

export async function hardDeleteKPI(id: number) {
  const session = await requireAdmin();
  await db.delete(kpis).where(eq(kpis.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "delete", entity: "kpi", entityId: String(id) });
  revalidatePath("/");
  revalidatePath("/admin/kpi/archived");
}

export async function togglePinKPI(id: number, isPinned: boolean) {
  const session = await requireAdmin();
  await db.update(kpis).set({ isPinned }).where(eq(kpis.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: isPinned ? "pinned" : "unpinned" });
  revalidatePath("/");
}

/** Normalize sortOrder untuk domain tertentu agar urut 0, 1, 2, ... */
async function normalizeSortOrder(domainId: number) {
  const domainKpis = await db
    .select({ id: kpis.id })
    .from(kpis)
    .where(and(eq(kpis.domainId, domainId), eq(kpis.isActive, true)))
    .orderBy(kpis.sortOrder, kpis.name);

  db.transaction((tx) => {
    for (let i = 0; i < domainKpis.length; i++) {
      tx.update(kpis).set({ sortOrder: i }).where(eq(kpis.id, domainKpis[i].id)).run();
    }
  });
}

/** Geser sortOrder KPI ke atas atau bawah dalam domain yang sama */
export async function reorderKPI(id: number, direction: "up" | "down") {
  await requireAdmin();
  const [kpi] = await db.select().from(kpis).where(eq(kpis.id, id)).limit(1);
  if (!kpi) return;

  // Normalize dulu agar setiap KPI punya sortOrder unik
  await normalizeSortOrder(kpi.domainId);

  // Re-fetch + sibling lookup + swap atomic so a concurrent reorder cannot
  // interleave and clobber the swap or leave duplicate sortOrder.
  db.transaction((tx) => {
    const [current] = tx.select().from(kpis).where(eq(kpis.id, id)).limit(1).all();
    if (!current) return;

    const sibling = direction === "up"
      ? tx.select().from(kpis)
          .where(and(eq(kpis.domainId, current.domainId), eq(kpis.isActive, true), lt(kpis.sortOrder, current.sortOrder)))
          .orderBy(sql`sort_order DESC`).limit(1).all()
      : tx.select().from(kpis)
          .where(and(eq(kpis.domainId, current.domainId), eq(kpis.isActive, true), gt(kpis.sortOrder, current.sortOrder)))
          .orderBy(sql`sort_order ASC`).limit(1).all();

    if (!sibling[0]) return;

    tx.update(kpis).set({ sortOrder: sibling[0].sortOrder }).where(eq(kpis.id, current.id)).run();
    tx.update(kpis).set({ sortOrder: current.sortOrder }).where(eq(kpis.id, sibling[0].id)).run();
  });

  revalidatePath("/");
  revalidatePath("/admin/kpi");
}

/** Bulk update sortOrder setelah drag-and-drop */
export async function bulkReorderKPIs(items: { id: number; sortOrder: number }[]) {
  await requireAdmin();

  db.transaction((tx) => {
    for (const item of items) {
      tx.update(kpis).set({ sortOrder: item.sortOrder }).where(eq(kpis.id, item.id)).run();
    }
  });

  revalidatePath("/");
  revalidatePath("/admin/kpi");
}
