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

/**
 * Simpan banyak komentar sekaligus (hasil draf batch yang sudah disunting).
 *
 * Bukan sekadar perulangan createComment: itu berarti N round-trip server, N
 * revalidatePath, dan N baris audit untuk satu tindakan pengguna. Di sini satu
 * tindakan menghasilkan satu jejak audit yang mencerminkan apa yang benar-benar
 * terjadi.
 *
 * Item yang tidak lolos validasi dilewati, bukan menggagalkan sisanya — admin
 * yang mengosongkan satu draf dari sepuluh tetap harus bisa menyimpan sembilan.
 */
export async function createCommentsBatch(
  items: { kpiId: number; content: string }[],
  periodDate: string
): Promise<{ saved: number; skipped: number }> {
  const session = await requireAdmin();

  if (!isValidCalendarDate(periodDate) || items.length === 0) {
    return { saved: 0, skipped: items.length };
  }

  const author = session.user.name ?? session.user.email ?? "Admin";
  const validIds = new Set((await db.select({ id: kpis.id }).from(kpis)).map((k) => k.id));

  const rows = items.flatMap((item) => {
    if (!Number.isInteger(item.kpiId) || !validIds.has(item.kpiId)) return [];
    const clean = sanitize(item.content);
    if (isEmptyHtml(clean) || clean.length > 50000) return [];
    return [{ kpiId: item.kpiId, periodDate, content: clean, author }];
  });

  if (rows.length > 0) {
    await db.insert(kpiComments).values(rows);
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: "create",
      entity: "kpi_comment",
      detail: `batch ${rows.length} catatan periode ${periodDate}`,
    });
    for (const row of rows) revalidatePath(`/kpi/${row.kpiId}`);
  }

  return { saved: rows.length, skipped: items.length - rows.length };
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
