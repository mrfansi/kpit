"use server";

import { db } from "@/lib/db";
import { timelineProjects, timelineProjectLogs, timelineProjectStatuses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { projectSchema } from "@/lib/validations/timeline";

function revalidateTimeline() {
  revalidatePath("/timeline");
  revalidatePath("/admin/timeline");
}

export async function createProject(formData: FormData) {
  const session = await requireAdmin();

  const raw = Object.fromEntries(formData);
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const launchDate = parsed.data.estimatedLaunchDate || null;

  await db.insert(timelineProjects).values({
    name: parsed.data.name,
    color: parsed.data.color,
    description: parsed.data.description,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    progress: parsed.data.progress,
    sortOrder: parsed.data.sortOrder,
    launchBufferDays: parsed.data.launchBufferDays,
    estimatedLaunchDate: launchDate,
    statusId: parsed.data.statusId ?? null,
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
  const session = await requireAdmin();

  const raw = Object.fromEntries(formData);
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const launchDate = parsed.data.estimatedLaunchDate || null;

  // Fetch old values for change detection
  const oldProject = await db.query.timelineProjects.findFirst({
    where: eq(timelineProjects.id, id),
    columns: { progress: true, statusId: true, startDate: true, endDate: true, estimatedLaunchDate: true },
  });

  await db
    .update(timelineProjects)
    .set({
      name: parsed.data.name,
      color: parsed.data.color,
      description: parsed.data.description,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      progress: parsed.data.progress,
      sortOrder: parsed.data.sortOrder,
      launchBufferDays: parsed.data.launchBufferDays,
      estimatedLaunchDate: launchDate,
      statusId: parsed.data.statusId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(timelineProjects.id, id));

  // Auto-log progress and status changes
  if (oldProject) {
    const author = session.user.name ?? session.user.email ?? "Admin";
    const newProgress = parsed.data.progress;
    const newStatusId = parsed.data.statusId ?? null;
    const logParts: string[] = [];

    if (oldProject.startDate !== parsed.data.startDate) {
      logParts.push(`Start: ${oldProject.startDate} → ${parsed.data.startDate}`);
    }

    if (oldProject.endDate !== parsed.data.endDate) {
      logParts.push(`End: ${oldProject.endDate} → ${parsed.data.endDate}`);
    }

    if ((oldProject.estimatedLaunchDate ?? null) !== (launchDate ?? null)) {
      logParts.push(`Est. Launch: ${oldProject.estimatedLaunchDate ?? "—"} → ${launchDate ?? "auto"}`);
    }

    if (oldProject.progress !== newProgress) {
      logParts.push(`Progress: ${oldProject.progress}% → ${newProgress}%`);
    }

    if (oldProject.statusId !== newStatusId) {
      const [oldStatus, newStatus] = await Promise.all([
        oldProject.statusId
          ? db.query.timelineProjectStatuses.findFirst({
              where: eq(timelineProjectStatuses.id, oldProject.statusId),
              columns: { name: true },
            })
          : null,
        newStatusId
          ? db.query.timelineProjectStatuses.findFirst({
              where: eq(timelineProjectStatuses.id, newStatusId),
              columns: { name: true },
            })
          : null,
      ]);
      logParts.push(`Status: ${oldStatus?.name ?? "—"} → ${newStatus?.name ?? "—"}`);
    }

    if (logParts.length > 0) {
      await db.insert(timelineProjectLogs).values({
        projectId: id,
        content: logParts.join(", "),
        progressBefore: oldProject.progress,
        progressAfter: newProgress,
        author,
        createdAt: new Date(),
      });
    }
  }

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "update",
    entity: "timeline_project",
    entityId: String(id),
    detail: parsed.data.name,
  });
  revalidateTimeline();
}

export async function updateProjectDates(
  id: number,
  startDate: string,
  endDate: string
) {
  const session = await requireAdmin();

  if (endDate < startDate) return;

  // Fetch old values for change detection
  const existing = await db.query.timelineProjects.findFirst({
    where: eq(timelineProjects.id, id),
    columns: { startDate: true, endDate: true, estimatedLaunchDate: true, progress: true },
  });
  if (!existing) return;

  const clearLaunch =
    existing.estimatedLaunchDate && existing.estimatedLaunchDate < endDate;

  await db
    .update(timelineProjects)
    .set({
      startDate,
      endDate,
      ...(clearLaunch ? { estimatedLaunchDate: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(timelineProjects.id, id));

  // Auto-log date changes from drag
  const logParts: string[] = [];
  if (existing.startDate !== startDate) {
    logParts.push(`Start: ${existing.startDate} → ${startDate}`);
  }
  if (existing.endDate !== endDate) {
    logParts.push(`End: ${existing.endDate} → ${endDate}`);
  }
  if (logParts.length > 0) {
    const author = session.user.name ?? session.user.email ?? "Admin";
    await db.insert(timelineProjectLogs).values({
      projectId: id,
      content: logParts.join(", "),
      progressBefore: existing.progress,
      progressAfter: existing.progress,
      author,
      createdAt: new Date(),
    });
  }

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "update",
    entity: "timeline_project",
    entityId: String(id),
    detail: `dates ${startDate} - ${endDate}`,
  });
  revalidateTimeline();
}

// --- Progress Log Actions ---

export async function createProgressLog(
  projectId: number,
  content: string,
  progressBefore?: number | null,
  progressAfter?: number | null
) {
  const session = await requireAdmin();

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
  const session = await requireAdmin();

  await db.delete(timelineProjectLogs).where(eq(timelineProjectLogs.id, id));
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "delete",
    entity: "timeline_project_log",
    entityId: String(id),
  });
  revalidateTimeline();
}

export async function fetchProjectLogs(projectId: number) {
  await requireAuth();
  const { getProjectLogs } = await import("@/lib/queries/timeline");
  return getProjectLogs(projectId);
}

export async function deleteProject(id: number) {
  const session = await requireAdmin();

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
