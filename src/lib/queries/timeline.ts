import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { timelineProjects, timelineProjectLogs } from "@/lib/db/schema";

export async function getAllTimelineProjects() {
  return db
    .select()
    .from(timelineProjects)
    .orderBy(asc(timelineProjects.sortOrder), asc(timelineProjects.startDate));
}

export async function getTimelineProjectById(id: number) {
  const rows = await db
    .select()
    .from(timelineProjects)
    .where(eq(timelineProjects.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProjectLogs(projectId: number) {
  return db
    .select()
    .from(timelineProjectLogs)
    .where(eq(timelineProjectLogs.projectId, projectId))
    .orderBy(desc(timelineProjectLogs.createdAt));
}
