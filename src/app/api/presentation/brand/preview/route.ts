import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/ai/api-helpers";
import { checkMonthlyMutationRequest } from "@/lib/monthly-report-request";
import { renderMonthlyReportPresentation } from "@/lib/monthly-report-export";
import { brandStyleSchema, contrastProblems } from "@/lib/presentation/brand";
import { presentationBrandSample } from "@/lib/presentation/brand-preview";

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  if (result.session.user.role !== "admin") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const rejection = checkMonthlyMutationRequest(request);
  if (rejection) return NextResponse.json({ error: rejection.error }, { status: rejection.status });
  const input = z.object({ style: brandStyleSchema }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Gaya presentasi tidak valid." }, { status: 400 });
  const problems = contrastProblems(input.data.style);
  if (problems.length) return NextResponse.json({ error: `Gaya tidak cukup terbaca: ${problems.join("; ")}` }, { status: 400 });
  return new NextResponse(renderMonthlyReportPresentation(presentationBrandSample(), input.data.style), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'" },
  });
}
