"use server";

import { db } from "@/lib/db";
import { kpis, type NewKPI } from "@/lib/db/schema";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logAudit } from "@/lib/db/audit";

export async function createKPI(data: Omit<NewKPI, "createdAt">) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.insert(kpis).values(data);
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi", detail: data.name });
  revalidatePath("/");
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil ditambahkan")}`);
}

export async function updateKPI(id: number, data: Partial<Omit<NewKPI, "id" | "createdAt">>) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.update(kpis).set(data).where(eq(kpis.id, id));
  revalidatePath("/");
  revalidatePath(`/kpi/${id}`);
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil diperbarui")}`);
}

export async function archiveKPI(id: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.update(kpis).set({ isActive: false }).where(eq(kpis.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: "archived" });
  revalidatePath("/");
  revalidatePath("/admin/kpi");
}

export async function restoreKPI(id: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.update(kpis).set({ isActive: true }).where(eq(kpis.id, id));
  revalidatePath("/");
  revalidatePath("/admin/kpi");
  revalidatePath("/admin/kpi/archived");
}

export async function hardDeleteKPI(id: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.delete(kpis).where(eq(kpis.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "delete", entity: "kpi", entityId: String(id) });
  revalidatePath("/");
  revalidatePath("/admin/kpi/archived");
}

export async function togglePinKPI(id: number, isPinned: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.update(kpis).set({ isPinned }).where(eq(kpis.id, id));
  revalidatePath("/");
}

/** Geser sortOrder KPI ke atas atau bawah dalam domain yang sama */
export async function reorderKPI(id: number, direction: "up" | "down") {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
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


