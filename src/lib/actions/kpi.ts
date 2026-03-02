"use server";

import { db } from "@/lib/db";
import { kpis, type NewKPI } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

export async function deleteKPI(id: number) {
  await db.update(kpis).set({ isActive: false }).where(eq(kpis.id, id));
  revalidatePath("/");
  revalidatePath("/admin/kpi");
}
