"use server";

import { db } from "@/lib/db";
import { domains, type NewDomain } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createDomain(data: Omit<NewDomain, "id">) {
  await db.insert(domains).values(data);
  revalidatePath("/");
  redirect("/admin/domain?success=Domain+berhasil+ditambahkan");
}

export async function updateDomain(id: number, data: Partial<Omit<NewDomain, "id">>) {
  await db.update(domains).set(data).where(eq(domains.id, id));
  revalidatePath("/");
  redirect("/admin/domain?success=Domain+berhasil+diperbarui");
}

export async function deleteDomain(id: number) {
  await db.delete(domains).where(eq(domains.id, id));
  revalidatePath("/");
}

