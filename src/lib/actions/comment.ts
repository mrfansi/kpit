"use server";

import { db } from "@/lib/db";
import { kpiComments, kpis, type KPIComment } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { isValidCalendarDate } from "@/lib/date-utils";
import { isEmptyHtml } from "@/lib/html-utils";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "s", "u",
    "h2", "h3",
    "ul", "ol", "li",
    "a", "img",
    "blockquote", "code", "pre",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
  allowedSchemes: ["http", "https"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

function sanitize(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

export async function createComment(
  kpiId: number,
  periodDate: string,
  content: string
): Promise<KPIComment | null> {
  const session = await requireAdmin();

  // Validate identifiers before any write (no orphan comments).
  if (!Number.isInteger(kpiId) || kpiId <= 0 || !isValidCalendarDate(periodDate)) {
    return null;
  }
  const kpi = await db.select({ id: kpis.id }).from(kpis).where(eq(kpis.id, kpiId)).get();
  if (!kpi) return null;

  const author = session.user.name ?? session.user.email ?? "Admin";
  const clean = sanitize(content);
  if (isEmptyHtml(clean) || clean.length > 50000) return null;

  const [inserted] = await db
    .insert(kpiComments)
    .values({ kpiId, periodDate, content: clean, author })
    .returning();

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "create",
    entity: "kpi_comment",
    entityId: String(kpiId),
    detail: `periode ${periodDate}`,
  });
  revalidatePath(`/kpi/${kpiId}`);
  return inserted ?? null;
}

export async function deleteComment(id: number, kpiId: number) {
  const session = await requireAdmin();
  await db.delete(kpiComments).where(eq(kpiComments.id, id));
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "delete",
    entity: "kpi_comment",
    entityId: String(id),
  });
  revalidatePath(`/kpi/${kpiId}`);
}
