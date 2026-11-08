"use server";

import { db } from "@/lib/db";
import { domains, type NewDomain } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit, formatChanges } from "@/lib/db/audit";

const DomainSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().optional().nullable(),
});

async function slugTaken(slug: string) {
  return !!(await db.select({ id: domains.id }).from(domains).where(eq(domains.slug, slug)).get());
}

// Kegagalan validasi dikembalikan, bukan dilempar: produksi menyamarkan error
// server action yang dilempar menjadi "Minified React error #441".
export async function createDomain(data: Omit<NewDomain, "id">): Promise<{ error: string }> {
  const session = await requireAdmin();
  const result = DomainSchema.safeParse(data);
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Data domain tidak valid" };
  if (await slugTaken(data.slug)) return { error: "Slug sudah dipakai" };
  await db.insert(domains).values(data);
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "create", entity: "domain", detail: data.name });
  revalidatePath("/");
  redirect("/admin/domain?success=Domain+berhasil+ditambahkan");
}

export async function updateDomain(id: number, data: Partial<Omit<NewDomain, "id">>): Promise<{ error: string }> {
  const session = await requireAdmin();
  const result = DomainSchema.partial().safeParse(data);
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Data domain tidak valid" };
  const existing = await db.select().from(domains).where(eq(domains.id, id)).get();
  if (!existing) return { error: "Domain tidak ditemukan" };
  if (data.slug && data.slug !== existing.slug && (await slugTaken(data.slug))) return { error: "Slug sudah dipakai" };
  await db.update(domains).set(data).where(eq(domains.id, id));
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "update",
    entity: "domain",
    entityId: String(id),
    detail: [existing.name, formatChanges(existing, data)].filter(Boolean).join(": "),
  });
  revalidatePath("/");
  redirect("/admin/domain?success=Domain+berhasil+diperbarui");
}

export async function deleteDomain(id: number): Promise<{ error?: string }> {
  const session = await requireAdmin();
  const existing = await db.select({ name: domains.name }).from(domains).where(eq(domains.id, id)).get();
  if (!existing) return { error: "Domain tidak ditemukan" };
  await db.delete(domains).where(eq(domains.id, id));
  await logAudit({ userId: session.user.id, userEmail: session.user.email ?? undefined, action: "delete", entity: "domain", entityId: String(id), detail: existing.name });
  revalidatePath("/");
  return {};
}
