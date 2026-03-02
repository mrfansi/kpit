"use server";

import { db } from "@/lib/db";
import { kpiComments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createComment(kpiId: number, periodDate: string, content: string, author = "Admin") {
  if (!content.trim()) return;
  await db.insert(kpiComments).values({ kpiId, periodDate, content: content.trim(), author });
  revalidatePath(`/kpi/${kpiId}`);
}

export async function deleteComment(id: number, kpiId: number) {
  await db.delete(kpiComments).where(eq(kpiComments.id, id));
  revalidatePath(`/kpi/${kpiId}`);
}
