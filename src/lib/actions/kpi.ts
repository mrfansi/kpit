"use server";

import { db } from "@/lib/db";
import { kpis, type NewKPI } from "@/lib/db/schema";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";

export async function createKPI(data: Omit<NewKPI, "createdAt">) {
  const session = await requireAdmin();

  // Set sortOrder ke posisi terakhir dalam domain
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
    .from(kpis)
    .where(and(eq(kpis.domainId, data.domainId), eq(kpis.isActive, true)));
  const nextOrder = (maxRow?.max ?? -1) + 1;

  await db.insert(kpis).values({ ...data, sortOrder: nextOrder });
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi", detail: data.name });
  revalidatePath("/");
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil ditambahkan")}`);
}

export async function updateKPI(id: number, data: Partial<Omit<NewKPI, "id" | "createdAt">>) {
  const session = await requireAdmin();
  await db.update(kpis).set(data).where(eq(kpis.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: data.name });
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

  await db.transaction(async (tx) => {
    for (let i = 0; i < domainKpis.length; i++) {
      await tx.update(kpis).set({ sortOrder: i }).where(eq(kpis.id, domainKpis[i].id));
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

  // Re-fetch setelah normalize
  const [current] = await db.select().from(kpis).where(eq(kpis.id, id)).limit(1);
  if (!current) return;

  const sibling = direction === "up"
    ? await db.select().from(kpis)
        .where(and(eq(kpis.domainId, current.domainId), eq(kpis.isActive, true), lt(kpis.sortOrder, current.sortOrder)))
        .orderBy(sql`sort_order DESC`).limit(1)
    : await db.select().from(kpis)
        .where(and(eq(kpis.domainId, current.domainId), eq(kpis.isActive, true), gt(kpis.sortOrder, current.sortOrder)))
        .orderBy(sql`sort_order ASC`).limit(1);

  if (!sibling[0]) return;

  // Swap sortOrder
  await db.update(kpis).set({ sortOrder: sibling[0].sortOrder }).where(eq(kpis.id, current.id));
  await db.update(kpis).set({ sortOrder: current.sortOrder }).where(eq(kpis.id, sibling[0].id));

  revalidatePath("/");
  revalidatePath("/admin/kpi");
}

/** Bulk update sortOrder setelah drag-and-drop */
export async function bulkReorderKPIs(items: { id: number; sortOrder: number }[]) {
  await requireAdmin();

  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx.update(kpis).set({ sortOrder: item.sortOrder }).where(eq(kpis.id, item.id));
    }
  });

  revalidatePath("/");
  revalidatePath("/admin/kpi");
}
