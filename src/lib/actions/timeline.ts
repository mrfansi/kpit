"use server";

import { db } from "@/lib/db";
import { timelineProjects, timelineProjectLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logAudit } from "@/lib/db/audit";
import { projectSchema } from "@/lib/validations/timeline";

function revalidateTimeline() {
  revalidatePath("/timeline");
  revalidatePath("/admin/timeline");
}

export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const raw = Object.fromEntries(formData);
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await db.insert(timelineProjects).values({
    ...parsed.data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "create",
    entity: "timeline_project",
    detail: parsed.data.name,
  });
  revalidateTimeline();
}

export async function updateProject(id: number, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const raw = Object.fromEntries(formData);
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await db
    .update(timelineProjects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(timelineProjects.id, id));
  revalidateTimeline();
}

export async function updateProjectDates(
  id: number,
  startDate: string,
  endDate: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (endDate < startDate) return;

  await db
    .update(timelineProjects)
    .set({ startDate, endDate, updatedAt: new Date() })
    .where(eq(timelineProjects.id, id));
  revalidateTimeline();
}

// --- Progress Log Actions ---

export async function createProgressLog(
  projectId: number,
  content: string,
  progressBefore?: number | null,
  progressAfter?: number | null
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const clean = content.trim();
  if (!clean || clean.length > 50000) return;

  const author = session.user.name ?? session.user.email ?? "Admin";

  await db.insert(timelineProjectLogs).values({
    projectId,
    content: clean,
    progressBefore: progressBefore ?? null,
    progressAfter: progressAfter ?? null,
    author,
    createdAt: new Date(),
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "create",
    entity: "timeline_project_log",
    entityId: String(projectId),
  });

  revalidateTimeline();
}

export async function deleteProgressLog(id: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.delete(timelineProjectLogs).where(eq(timelineProjectLogs.id, id));
  revalidateTimeline();
}

export async function fetchProjectLogs(projectId: number) {
  const { getProjectLogs } = await import("@/lib/queries/timeline");
  return getProjectLogs(projectId);
}

export async function deleteProject(id: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.delete(timelineProjects).where(eq(timelineProjects.id, id));
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "delete",
    entity: "timeline_project",
    entityId: String(id),
  });
  revalidateTimeline();
}
