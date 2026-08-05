import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/ai/api-helpers";
import { checkAIRateLimit } from "@/lib/ai/rate-limit";
import { draftCommentForKPI, type DraftResult } from "@/lib/ai/comment-draft";
import { getKPIsWithLatestEntry } from "@/lib/queries";

const batchSchema = z.object({
  domainId: z.number().int().positive().optional(),
  periodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format periode harus YYYY-MM-DD"),
});

/**
 * Batas jumlah KPI per klik. Bukan soal performa — panggilannya paralel — tapi
 * soal biaya: satu klik yang memicu 200 panggilan model adalah kecelakaan yang
 * menunggu terjadi.
 */
const MAX_BATCH = 25;

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  if (authResult.session.user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  const userId = authResult.session.user.id;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Domain atau periode tidak valid." }, { status: 400 });
  }
  const { domainId, periodDate } = parsed.data;

  const rows = await getKPIsWithLatestEntry(domainId, periodDate);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada KPI untuk diproses." }, { status: 404 });
  }

  const selected = rows.slice(0, MAX_BATCH);
  const skippedForCap = rows.length - selected.length;

  // Kuota dihitung PER KPI, bukan per klik. Satu batch = N panggilan model, jadi
  // menagihnya sebagai satu akan membuat plafon harian di rate-limit.ts tidak
  // ada artinya — 300 batch bisa berarti ribuan panggilan.
  const allowed: typeof selected = [];
  const rateLimited: { kpiId: number; kpiName: string }[] = [];
  for (const row of selected) {
    if (checkAIRateLimit(userId, "draft-comment").allowed) {
      allowed.push(row);
    } else {
      rateLimited.push({ kpiId: row.kpi.id, kpiName: row.kpi.name });
    }
  }

  // Paralel: dengan model cepat, sembilan KPI selesai dalam sekali tunggu
  // alih-alih sembilan kali berturut-turut. Kegagalan per KPI dikembalikan
  // sebagai nilai, jadi satu KPI bermasalah tidak menjatuhkan seluruh batch.
  const results: DraftResult[] = await Promise.all(
    allowed.map((row) => draftCommentForKPI(row.kpi.id, periodDate))
  );

  const drafts = results.filter((r) => r.ok);
  const skipped = results.filter((r) => !r.ok);

  return NextResponse.json({
    drafts: drafts.map((d) => ({ kpiId: d.kpiId, kpiName: d.kpiName, draft: d.draft })),
    skipped: [
      ...skipped.map((s) => ({
        kpiId: s.kpiId,
        kpiName: s.kpiName,
        reason: s.reason,
        message: s.message,
      })),
      ...rateLimited.map((r) => ({
        kpiId: r.kpiId,
        kpiName: r.kpiName,
        reason: "rate_limited" as const,
        message: "Kuota AI tercapai, coba lagi sebentar.",
      })),
    ],
    // Pemotongan diam-diam terbaca sebagai "semua sudah diproses" padahal tidak.
    skippedForCap,
  });
}
