import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/ai/api-helpers";
import { isValidCalendarDate } from "@/lib/date-utils";
import { getMonthlyReportBundle } from "@/lib/monthly-report-store";
import { renderMonthlyReportPresentation } from "@/lib/monthly-report-export";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const period = searchParams.get("period");
  if (!domain || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(domain) || !period || !isValidCalendarDate(period) || !/^\d{4}-\d{2}-01$/.test(period)) {
    return NextResponse.json({ error: "Pilih domain dan periode bulanan yang valid (YYYY-MM-01)." }, { status: 400 });
  }
  const bundle = await getMonthlyReportBundle(domain, period);
  if (!bundle) return NextResponse.json({ error: "Domain tidak ditemukan." }, { status: 404 });
  if (!bundle.ready) return NextResponse.json({ error: "Laporan belum siap dipresentasikan.", questions: bundle.questions }, { status: 409 });

  return new NextResponse(renderMonthlyReportPresentation(bundle), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'" },
  });
}
