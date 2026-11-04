"use server";

import { db } from "@/lib/db";
import { auditLogs, timelineProjectStatuses, timelineProjects } from "@/lib/db/schema";
import { and, eq, count, notExists, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { auditInsert } from "@/lib/db/audit";
import { statusSchema } from "@/lib/validations/timeline-status";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function revalidateAll() {
  revalidatePath("/timeline");
  revalidatePath("/admin/timeline");
}

export async function createStatus(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const slug = slugify(parsed.data.name);

  await db.batch([
    db.insert(timelineProjectStatuses).values({
      name: parsed.data.name,
      slug,
      color: parsed.data.color,
      sortOrder: sql`(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM timeline_project_statuses)`,
      createdAt: new Date(),
    }),
    auditInsert({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: "create",
      entity: "timeline_project_status",
      detail: parsed.data.name,
    }),
  ]);
  revalidateAll();
}

export async function updateStatus(id: number, formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const slug = slugify(parsed.data.name);

  await db.batch([
    db.update(timelineProjectStatuses)
      .set({ name: parsed.data.name, slug, color: parsed.data.color })
      .where(eq(timelineProjectStatuses.id, id)),
    auditInsert({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: "update",
      entity: "timeline_project_status",
      entityId: String(id),
      detail: parsed.data.name,
    }),
  ]);
  revalidateAll();
}

export async function deleteStatus(id: number) {
  const session = await requireAdmin();

  const [deleted, , usage] = await db.batch([
    db.delete(timelineProjectStatuses)
      .where(and(
        eq(timelineProjectStatuses.id, id),
        notExists(db.select({ id: timelineProjects.id }).from(timelineProjects)
          .where(eq(timelineProjects.statusId, id))),
      ))
      .returning({ id: timelineProjectStatuses.id }),
    // changes() refers to the guarded DELETE immediately above in this batch.
    db.insert(auditLogs).select(db.select({
      id: sql<number>`NULL`.as("id"),
      userId: sql<string>`${session.user.id}`.as("user_id"),
      userEmail: sql<string | null>`${session.user.email ?? null}`.as("user_email"),
      action: sql<string>`'delete'`.as("action"),
      entity: sql<string>`'timeline_project_status'`.as("entity"),
      entityId: sql<string>`${String(id)}`.as("entity_id"),
      detail: sql<string | null>`NULL`.as("detail"),
      createdAt: sql<Date>`${Math.floor(Date.now() / 1000)}`.as("created_at"),
    }).from(sql`(SELECT 1)`).where(sql`changes() > 0`)),
    db.select({ cnt: count() }).from(timelineProjects)
      .where(eq(timelineProjects.statusId, id)),
  ]);
  if (!deleted.length && (usage[0]?.cnt ?? 0) > 0) {
    throw new Error(
      `Status ini masih digunakan oleh ${usage[0].cnt} project. Ubah status project tersebut terlebih dahulu.`
    );
  }
  revalidateAll();
}
