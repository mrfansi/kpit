"use server";

import { db } from "@/lib/db";
import { timelineProjectStatuses, timelineProjects } from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
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

  db.transaction((tx) => {
    // Next position = MAX(sort_order) + 1 (NOT count(), which collides with
    // existing rows after any deletion). Read + insert atomic.
    const [row] = tx
      .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(timelineProjectStatuses)
      .all();
    const nextOrder = (row?.max ?? -1) + 1;

    tx.insert(timelineProjectStatuses).values({
      name: parsed.data.name,
      slug,
      color: parsed.data.color,
      sortOrder: nextOrder,
      createdAt: new Date(),
    }).run();

    logAudit(
      {
        userId: session.user.id,
        userEmail: session.user.email ?? undefined,
        action: "create",
        entity: "timeline_project_status",
        detail: parsed.data.name,
      },
      tx
    );
  });
  revalidateAll();
}

export async function updateStatus(id: number, formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const slug = slugify(parsed.data.name);

  db.transaction((tx) => {
    tx
      .update(timelineProjectStatuses)
      .set({ name: parsed.data.name, slug, color: parsed.data.color })
      .where(eq(timelineProjectStatuses.id, id))
      .run();

    logAudit(
      {
        userId: session.user.id,
        userEmail: session.user.email ?? undefined,
        action: "update",
        entity: "timeline_project_status",
        entityId: String(id),
        detail: parsed.data.name,
      },
      tx
    );
  });
  revalidateAll();
}

export async function deleteStatus(id: number) {
  const session = await requireAdmin();

  db.transaction((tx) => {
    // Usage check and delete must be atomic, else a project assigned between
    // the two statements is left pointing at a deleted status.
    const usage = tx
      .select({ cnt: count() })
      .from(timelineProjects)
      .where(eq(timelineProjects.statusId, id))
      .all();

    if ((usage[0]?.cnt ?? 0) > 0) {
      throw new Error(
        `Status ini masih digunakan oleh ${usage[0].cnt} project. Ubah status project tersebut terlebih dahulu.`
      );
    }

    tx
      .delete(timelineProjectStatuses)
      .where(eq(timelineProjectStatuses.id, id))
      .run();

    logAudit(
      {
        userId: session.user.id,
        userEmail: session.user.email ?? undefined,
        action: "delete",
        entity: "timeline_project_status",
        entityId: String(id),
      },
      tx
    );
  });
  revalidateAll();
}
