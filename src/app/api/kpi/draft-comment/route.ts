import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";
import { draftCommentForKPI } from "@/lib/ai/comment-draft";
import { AIServiceError } from "@/lib/ai";

/**
 * Klien hanya menyebut KPI dan periodenya; seluruh angka diambil di server.
 *
 * Route AI lain di aplikasi ini menerima riwayat lengkap dari body request,
 * yang berarti pemanggilnya dapat menyuntikkan angka palsu ke dalam prompt.
 * Draf ini masuk ke komentar resmi periode, jadi datanya harus berasal dari DB.
 */
const draftSchema = z.object({
  kpiId: z.number().int().positive(),
  periodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format periode harus YYYY-MM-DD"),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  // Hanya admin yang bisa memposting komentar, jadi tidak ada gunanya membakar
  // kuota AI untuk viewer yang tidak akan bisa memakai hasilnya.
  if (authResult.session.user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const limited = enforceAIRateLimit(authResult.session.user.id, "draft-comment");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "KPI atau periode tidak valid." }, { status: 400 });
  }

  const result = await draftCommentForKPI(parsed.data.kpiId, parsed.data.periodDate);

  if (result.ok) {
    return NextResponse.json({ draft: result.draft });
  }

  if (result.reason === "not_found") {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }
  if (result.reason === "no_data") {
    return NextResponse.json(
      { error: `${result.message} Isi nilainya dulu sebelum membuat draf.` },
      { status: 422 }
    );
  }
  // Kegagalan AI melewati handleAIError supaya kode status dan pesannya sama
  // dengan seluruh endpoint AI lain (mis. 503 saat kredensial belum diisi).
  return handleAIError(new AIServiceError(result.message, "provider_error"));
}
