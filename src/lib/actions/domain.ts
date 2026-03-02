"use server";

import { db } from "@/lib/db";
import { domains, type NewDomain } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const DomainSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().optional().nullable(),
});

export async function createDomain(data: Omit<NewDomain, "id">) {
  DomainSchema.parse(data);
  await db.insert(domains).values(data);
  revalidatePath("/");
  redirect("/admin/domain?success=Domain+berhasil+ditambahkan");
}

export async function updateDomain(id: number, data: Partial<Omit<NewDomain, "id">>) {
  DomainSchema.partial().parse(data);
  await db.update(domains).set(data).where(eq(domains.id, id));
  revalidatePath("/");
  redirect("/admin/domain?success=Domain+berhasil+diperbarui");
}

export async function deleteDomain(id: number) {
  await db.delete(domains).where(eq(domains.id, id));
  revalidatePath("/");
}

