import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIService } from "@/lib/ai";
import { requireApiSession, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";
import { checkMonthlyMutationRequest } from "@/lib/monthly-report-request";
import { brandStyleSchema } from "@/lib/presentation/brand";
import { BrandGenerationError, generatePresentationBrand } from "@/lib/presentation/brand-generate";

export const runtime = "nodejs";

const generateSchema = z.object({
  instruction: z.string().trim().min(1).max(1000),
  base: brandStyleSchema.optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireApiSession();
  if (authResult.error) return authResult.error;
  if (authResult.session.user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  const rejection = checkMonthlyMutationRequest(request);
  if (rejection) return NextResponse.json({ error: rejection.error }, { status: rejection.status });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Instruksi harus berisi 1–1000 karakter dan gaya dasar harus valid." }, { status: 400 });
  }
  const limited = await enforceAIRateLimit(authResult.session.user.id, "presentation-brand");
  if (limited) return limited;
  try {
    return NextResponse.json(await generatePresentationBrand(getAIService(), parsed.data));
  } catch (error) {
    if (error instanceof BrandGenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleAIError(error);
  }
}
