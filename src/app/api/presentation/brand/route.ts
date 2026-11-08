import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/ai/api-helpers";
import { checkMonthlyMutationRequest } from "@/lib/monthly-report-request";
import { brandStyleSchema, contrastProblems, DEFAULT_BRAND_STYLE } from "@/lib/presentation/brand";
import { getActivePresentationBrand, PresentationBrandConflict, savePresentationBrand } from "@/lib/presentation/brand-store";

const saveSchema = z.object({
  style: brandStyleSchema,
  description: z.string().trim().max(2000),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
}).strict();

export async function GET() {
  const result = await requireApiSession();
  if (result.error) return result.error;
  if (result.session.user.role !== "admin") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  return NextResponse.json({ active: await getActivePresentationBrand(), default: DEFAULT_BRAND_STYLE }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const result = await requireApiSession();
  if (result.error) return result.error;
  if (result.session.user.role !== "admin") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const rejection = checkMonthlyMutationRequest(request);
  if (rejection) return NextResponse.json({ error: rejection.error }, { status: rejection.status });
  const input = saveSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Gaya, deskripsi, atau revisi presentasi tidak valid." }, { status: 400 });
  const problems = contrastProblems(input.data.style);
  if (problems.length) return NextResponse.json({ error: `Gaya tidak cukup terbaca: ${problems.join("; ")}` }, { status: 400 });
  try {
    return NextResponse.json(await savePresentationBrand(input.data, result.session.user.id));
  } catch (error) {
    if (error instanceof PresentationBrandConflict) return NextResponse.json({ error: error.message, active: error.active }, { status: 409 });
    console.error("Unable to save presentation brand:", error);
    return NextResponse.json({ error: "Gagal menyimpan gaya presentasi." }, { status: 500 });
  }
}
