import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/ai/api-helpers";
import { isValidCalendarDate } from "@/lib/date-utils";
import { getMonthlyReportBundle, MonthlyReportError } from "@/lib/monthly-report-store";
import { getRevisionBundle } from "@/lib/monthly-report-revisions";
import { renderMonthlyReportPresentation } from "@/lib/monthly-report-export";
import { getActivePresentationBrand } from "@/lib/presentation/brand-store";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const period = searchParams.get("period");
  if (!domain || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(domain) || !period || !isValidCalendarDate(period) || !/^\d{4}-\d{2}-01$/.test(period)) {
    return NextResponse.json({ error: "Pilih domain dan periode bulanan yang valid (YYYY-MM-01)." }, { status: 400 });
  }
  const revisionParam = searchParams.get("revision");
  let bundle;
  if (revisionParam === null) {
    bundle = await getMonthlyReportBundle(domain, period);
  } else {
    // Old revisions can hold unfinished drafts; keep them with the admins who can list them.
    if (authResult.session.user.role !== "admin") return NextResponse.json({ error: "Hanya admin yang dapat membuka revisi lama." }, { status: 403 });
    if (!/^[1-9]\d{0,8}$/.test(revisionParam)) return NextResponse.json({ error: "Nomor revisi tidak valid." }, { status: 400 });
    try { bundle = await getRevisionBundle(domain, period, Number(revisionParam)); }
    catch (error) { if (error instanceof MonthlyReportError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  }
  if (!bundle) return NextResponse.json({ error: "Domain tidak ditemukan." }, { status: 404 });
  if (!bundle.ready) return NextResponse.json({ error: "Laporan belum siap dipresentasikan.", questions: bundle.questions }, { status: 409 });

  const brand = await getActivePresentationBrand();
  return new NextResponse(renderMonthlyReportPresentation(bundle, brand?.style), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'" },
  });
}
