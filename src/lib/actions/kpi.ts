"use server";

import { db } from "@/lib/db";
import { inChunks } from "@/lib/db/chunks";
import { kpis, kpiTargets, domains, type NewKPI } from "@/lib/db/schema";
import { count, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-utils";
import { auditInsert, formatChanges } from "@/lib/db/audit";
import {
  kpiSchema,
  kpiFieldsSchema,
  checkBoundsOrder,
  checkTargetWithinBounds,
} from "@/lib/validations/kpi";
import { checkThresholdCoherence } from "@/lib/kpi-coherence";

async function domainExists(domainId: number) {
  const domain = await db.select({ id: domains.id }).from(domains).where(eq(domains.id, domainId)).get();
  return !!domain;
}

export async function createKPI(data: Omit<NewKPI, "createdAt">): Promise<{ error: string }> {
  const session = await requireAdmin();

  // Server-side validation: kpiSchema is otherwise only enforced client-side.
  // Kegagalan validasi dikembalikan, bukan dilempar: produksi menyamarkan error
  // server action yang dilempar menjadi "Minified React error #441".
  const result = kpiSchema.safeParse(data);
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Data KPI tidak valid" };
  const parsed = result.data;
  const orderError = checkThresholdCoherence(parsed).find((issue) => issue.level === "error");
  if (orderError) return { error: orderError.message };
  if (!(await domainExists(parsed.domainId))) return { error: "Domain tidak ditemukan" };

  await db.batch([
    db.insert(kpis).values({
      ...parsed,
      // Keep MAX+1 in the INSERT so concurrent creates cannot share a position.
      sortOrder: sql`(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM kpis WHERE domain_id = ${parsed.domainId} AND is_active = 1)`,
    }),
    auditInsert({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "kpi", detail: parsed.name }),
  ]);

  revalidatePath("/");
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil ditambahkan")}`);
}

export async function updateKPI(id: number, data: Partial<Omit<NewKPI, "id" | "createdAt">>): Promise<{ error: string }> {
  const session = await requireAdmin();

  // Server-side validation (partial: only provided fields are checked/written).
  // kpiFieldsSchema, bukan kpiSchema: .partial() tidak bisa dipakai pada skema
  // yang punya .refine(). Aturan lintas-field dijalankan di bawah, terhadap
  // hasil gabungan.
  const result = kpiFieldsSchema.partial().safeParse(data);
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Data KPI tidak valid" };
  const parsed = result.data;
  if (parsed.domainId !== undefined && !(await domainExists(parsed.domainId))) {
    return { error: "Domain tidak ditemukan" };
  }

  // Diperiksa terhadap baris yang tersimpan digabung dengan perubahannya.
  // Menaikkan minValue sendirian bisa membuatnya melewati maxValue lama, dan
  // memeriksa hanya field yang dikirim tidak akan pernah melihat itu.
  const existing = await db.select().from(kpis).where(eq(kpis.id, id)).get();
  if (!existing) return { error: "KPI tidak ditemukan" };

  const merged = {
    target: parsed.target ?? existing.target,
    minValue: parsed.minValue !== undefined ? parsed.minValue : existing.minValue,
    maxValue: parsed.maxValue !== undefined ? parsed.maxValue : existing.maxValue,
    direction: parsed.direction ?? existing.direction,
    thresholdGreen: parsed.thresholdGreen ?? existing.thresholdGreen,
    thresholdYellow: parsed.thresholdYellow ?? existing.thresholdYellow,
  };
  const coherenceError = checkBoundsOrder(merged)
    ?? checkTargetWithinBounds(merged)
    ?? checkThresholdCoherence(merged).find((issue) => issue.level === "error")?.message;
  if (coherenceError) return { error: coherenceError };

  // Mengubah arah membalik makna semua target per periode yang sudah ada;
  // tolak daripada diam-diam membuat statusnya terbalik.
  if (parsed.direction !== undefined && parsed.direction !== existing.direction) {
    const overrides = await db.select({ n: count() }).from(kpiTargets).where(eq(kpiTargets.kpiId, id)).get();
    if (overrides && overrides.n > 0) {
      return { error: "Arah KPI tidak bisa diubah selama masih ada target per periode. Hapus target periodenya dulu." };
    }
  }

  await db.batch([
    db.update(kpis).set(parsed).where(eq(kpis.id, id)),
    auditInsert({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: "update",
      entity: "kpi",
      entityId: String(id),
      detail: [existing.name, formatChanges(existing, parsed)].filter(Boolean).join(": "),
    }),
  ]);

  revalidatePath("/");
  revalidatePath(`/kpi/${id}`);
  redirect(`/admin/kpi?success=${encodeURIComponent("KPI berhasil diperbarui")}`);
}

export async function archiveKPI(id: number) {
  const session = await requireAdmin();
  await db.batch([
    db.update(kpis).set({ isActive: false }).where(eq(kpis.id, id)),
    auditInsert({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: "archived" }),
  ]);
  revalidatePath("/");
  revalidatePath("/admin/kpi");
}

export async function restoreKPI(id: number) {
  const session = await requireAdmin();
  await db.batch([
    db.update(kpis).set({ isActive: true }).where(eq(kpis.id, id)),
    auditInsert({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: "restored" }),
  ]);
  revalidatePath("/");
  revalidatePath("/admin/kpi");
  revalidatePath("/admin/kpi/archived");
}

export async function togglePinKPI(id: number, isPinned: boolean) {
  const session = await requireAdmin();
  await db.batch([
    db.update(kpis).set({ isPinned }).where(eq(kpis.id, id)),
    auditInsert({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "update", entity: "kpi", entityId: String(id), detail: isPinned ? "pinned" : "unpinned" }),
  ]);
  revalidatePath("/");
}

async function updateSortOrders(items: {
  id: number; sortOrder: number; previousSortOrder: number; domainId: number; isActive: boolean;
}[]) {
  if (!items.length) return;
  const positions = JSON.stringify(items);
  // One statement checks the whole snapshot: stale reads cannot cause half-swaps.
  // JSON keeps the parameter count constant even for large drag-and-drop lists.
  await db.batch([
    db.update(kpis).set({
      sortOrder: sql`(SELECT json_extract(value, '$.sortOrder') FROM json_each(${positions})
        WHERE json_extract(value, '$.id') = ${kpis.id})`,
    }).where(sql`${kpis.id} IN (SELECT json_extract(value, '$.id') FROM json_each(${positions}))
      AND NOT EXISTS (
        SELECT 1 FROM json_each(${positions}) AS expected
        LEFT JOIN kpis AS current ON current.id = json_extract(expected.value, '$.id')
        WHERE current.id IS NULL
          OR current.sort_order != json_extract(expected.value, '$.previousSortOrder')
          OR current.domain_id != json_extract(expected.value, '$.domainId')
          OR current.is_active != json_extract(expected.value, '$.isActive')
      )`),
  ]);
}

/** Bulk update sortOrder setelah drag-and-drop */
export async function bulkReorderKPIs(items: { id: number; sortOrder: number }[]) {
  await requireAdmin();

  const currentOrders = new Map<number, { sortOrder: number; domainId: number; isActive: boolean }>();
  const rows = await inChunks(items, 0, (chunk) => db.select({ id: kpis.id, sortOrder: kpis.sortOrder, domainId: kpis.domainId, isActive: kpis.isActive })
    .from(kpis).where(inArray(kpis.id, chunk.map((item) => item.id))));
  for (const row of rows) currentOrders.set(row.id, row);
  await updateSortOrders(items.filter((item) => currentOrders.has(item.id)).map((item) => {
    const current = currentOrders.get(item.id)!;
    return {
      ...item,
      previousSortOrder: current.sortOrder,
      domainId: current.domainId,
      isActive: current.isActive,
    };
  }));

  revalidatePath("/");
  revalidatePath("/admin/kpi");
}
