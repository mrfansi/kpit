"use server";

import { db } from "@/lib/db";
import { kpiComments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function createComment(kpiId: number, periodDate: string, content: string) {
  const session = await auth();
  if (!session?.user) return;
  const author = session.user.name ?? session.user.email ?? "Admin";
  if (!content.trim() || content.trim().length > 2000) return;
  if (!kpiId || !periodDate) return;
  await db.insert(kpiComments).values({ kpiId, periodDate, content: content.trim(), author });
  revalidatePath(`/kpi/${kpiId}`);
}

export async function deleteComment(id: number, kpiId: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await db.delete(kpiComments).where(eq(kpiComments.id, id));
  revalidatePath(`/kpi/${kpiId}`);
}
