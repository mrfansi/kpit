import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { presentationBrandStyles } from "@/lib/db/schema";
import { brandStyleSchema, contrastProblems, type BrandStyle } from "./brand";

export interface ActivePresentationBrand {
  revision: number;
  style: BrandStyle;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
}

export class PresentationBrandConflict extends Error {
  readonly status = 409;
  constructor(public active: ActivePresentationBrand | null) {
    super("Gaya presentasi sudah diubah admin lain. Muat ulang revisi terbaru sebelum menyimpan.");
  }
}

export async function getActivePresentationBrand(): Promise<ActivePresentationBrand | null> {
  const [row] = await db.select().from(presentationBrandStyles).orderBy(desc(presentationBrandStyles.revision)).limit(1);
  return row ? { ...row, style: brandStyleSchema.parse(row.style), updatedAt: row.updatedAt.toISOString() } : null;
}

export async function savePresentationBrand(input: { style: BrandStyle; description: string; expectedRevision: number }, userId: string): Promise<{ revision: number }> {
  const style = brandStyleSchema.parse(input.style);
  const description = z.string().trim().max(2000).parse(input.description);
  const expectedRevision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1).parse(input.expectedRevision);
  const problems = contrastProblems(style);
  if (problems.length) throw new Error(`Gaya tidak cukup terbaca: ${problems.join("; ")}`);
  const revision = expectedRevision + 1;
  // The guard and insert run in one statement, so concurrent admins cannot overwrite a revision.
  const rows = await db.all<{ revision: number }>(sql`
    insert into ${presentationBrandStyles} (revision, style, description, updated_by, updated_at)
    select ${revision}, ${JSON.stringify(style)}, ${description}, ${userId}, ${Math.floor(Date.now() / 1000)}
    where coalesce((select max(revision) from ${presentationBrandStyles}), 0) = ${expectedRevision}
    returning revision
  `);
  if (!rows.length) throw new PresentationBrandConflict(await getActivePresentationBrand());
  return { revision: rows[0].revision };
}
