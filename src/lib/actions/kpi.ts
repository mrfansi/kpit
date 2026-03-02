"use server";

import { db } from "@/lib/db";
import { kpis, type NewKPI } from "@/lib/db/schema";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createKPI(data: Omit<NewKPI, "createdAt">) {
  await db.insert(kpis).values(data);
  revalidatePath("/");
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil ditambahkan")}`);
}

export async function updateKPI(id: number, data: Partial<Omit<NewKPI, "id" | "createdAt">>) {
  await db.update(kpis).set(data).where(eq(kpis.id, id));
  revalidatePath("/");
  revalidatePath(`/kpi/${id}`);
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil diperbarui")}`);
}

export async function archiveKPI(id: number) {
  await db.update(kpis).set({ isActive: false }).where(eq(kpis.id, id));
  revalidatePath("/");
  revalidatePath("/admin/kpi");
}

export async function restoreKPI(id: number) {
  await db.update(kpis).set({ isActive: true }).where(eq(kpis.id, id));
  revalidatePath("/");
  revalidatePath("/admin/kpi");
  revalidatePath("/admin/kpi/archived");
}

export async function hardDeleteKPI(id: number) {
  await db.delete(kpis).where(eq(kpis.id, id));
  revalidatePath("/");
  revalidatePath("/admin/kpi/archived");
}

/** Geser sortOrder KPI ke atas atau bawah dalam domain yang sama */
export async function reorderKPI(id: number, direction: "up" | "down") {
  const [kpi] = await db.select().from(kpis).where(eq(kpis.id, id)).limit(1);
  if (!kpi) return;

  const sibling = direction === "up"
    ? await db.select().from(kpis)
        .where(and(eq(kpis.domainId, kpi.domainId), eq(kpis.isActive, true), lt(kpis.sortOrder, kpi.sortOrder)))
        .orderBy(sql`sort_order DESC`).limit(1)
    : await db.select().from(kpis)
        .where(and(eq(kpis.domainId, kpi.domainId), eq(kpis.isActive, true), gt(kpis.sortOrder, kpi.sortOrder)))
        .orderBy(sql`sort_order ASC`).limit(1);

  if (!sibling[0]) return;

  // Swap sortOrder
  await db.update(kpis).set({ sortOrder: sibling[0].sortOrder }).where(eq(kpis.id, kpi.id));
  await db.update(kpis).set({ sortOrder: kpi.sortOrder }).where(eq(kpis.id, sibling[0].id));

  revalidatePath("/");
  revalidatePath("/admin/kpi");
}

/** @deprecated gunakan archiveKPI */
export async function deleteKPI(id: number) {
  return archiveKPI(id);
}
