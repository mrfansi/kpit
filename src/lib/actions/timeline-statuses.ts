"use server";

import { db } from "@/lib/db";
import { timelineProjectStatuses, timelineProjects } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
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

  // Get max sortOrder
  const existing = await db
    .select({ maxOrder: count() })
    .from(timelineProjectStatuses);
  const nextOrder = (existing[0]?.maxOrder ?? 0);

  await db.insert(timelineProjectStatuses).values({
    name: parsed.data.name,
    slug,
    color: parsed.data.color,
    sortOrder: nextOrder,
    createdAt: new Date(),
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "create",
    entity: "timeline_project_status",
    detail: parsed.data.name,
  });
  revalidateAll();
}

export async function updateStatus(id: number, formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const slug = slugify(parsed.data.name);

  await db
    .update(timelineProjectStatuses)
    .set({ name: parsed.data.name, slug, color: parsed.data.color })
    .where(eq(timelineProjectStatuses.id, id));

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "update",
    entity: "timeline_project_status",
    entityId: String(id),
    detail: parsed.data.name,
  });
  revalidateAll();
}

export async function deleteStatus(id: number) {
  const session = await requireAdmin();

  // Check if any project uses this status
  const usage = await db
    .select({ cnt: count() })
    .from(timelineProjects)
    .where(eq(timelineProjects.statusId, id));

  if (usage[0]?.cnt > 0) {
    throw new Error(
      `Status ini masih digunakan oleh ${usage[0].cnt} project. Ubah status project tersebut terlebih dahulu.`
    );
  }

  await db
    .delete(timelineProjectStatuses)
    .where(eq(timelineProjectStatuses.id, id));

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "delete",
    entity: "timeline_project_status",
    entityId: String(id),
  });
  revalidateAll();
}
