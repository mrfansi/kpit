import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/ai/api-helpers";
import { isValidCalendarDate } from "@/lib/date-utils";
import { getMonthlyReportBundle, MonthlyReportError } from "@/lib/monthly-report-store";
import { formatRevisionTime, getRevisionBundle } from "@/lib/monthly-report-revisions";
import { renderMonthlyReportPresentation } from "@/lib/monthly-report-export";
import { getActivePresentationBrand } from "@/lib/presentation/brand-store";

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function draftPage(bundle: { domain: { name: string; slug: string }; period: string; questions: { question: string }[] }) {
  const back = `/admin/reports/monthly/${encodeURIComponent(bundle.domain.slug)}?period=${bundle.period}`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laporan belum siap</title></head><body style="font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1 style="font-size:1.5rem">Laporan ${esc(bundle.domain.name)} belum siap dipresentasikan</h1><p>Selesaikan pertanyaan berikut di editor:</p><ol>${bundle.questions.map((q) => `<li>${esc(q.question)}</li>`).join("")}</ol><p><a href="${esc(back)}">Kembali ke editor laporan</a></p></body></html>`;
}

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
  let archivedAt: string | null = null;
  if (revisionParam === null) {
    bundle = await getMonthlyReportBundle(domain, period);
  } else {
    // Old revisions can hold unfinished drafts; keep them with the admins who can list them.
    if (authResult.session.user.role !== "admin") return NextResponse.json({ error: "Hanya admin yang dapat membuka revisi lama." }, { status: 403 });
    if (!/^[1-9]\d{0,8}$/.test(revisionParam)) return NextResponse.json({ error: "Nomor revisi tidak valid." }, { status: 400 });
    try { bundle = await getRevisionBundle(domain, period, Number(revisionParam)); archivedAt = bundle.archivedAt; }
    catch (error) { if (error instanceof MonthlyReportError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
  }
  if (!bundle) return NextResponse.json({ error: "Domain tidak ditemukan." }, { status: 404 });
  if (!archivedAt && !bundle.ready) {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("application/json") && !accept.includes("text/html")) return NextResponse.json({ error: "Laporan belum siap dipresentasikan.", questions: bundle.questions }, { status: 409 });
    return new NextResponse(draftPage(bundle), { status: 409, headers: { ...HTML_HEADERS, "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
  }

  const brand = await getActivePresentationBrand();
  let page = renderMonthlyReportPresentation(bundle, brand?.style);
  if (archivedAt) {
    const banner = `<div style="position:fixed;top:0;left:0;right:0;z-index:99999;padding:6px 12px;background:#fef3c7;color:#000;font:14px system-ui,sans-serif;text-align:center">Revisi ${bundle.revision} (arsip, ${esc(formatRevisionTime(archivedAt))})</div>`;
    page = page.replace("<body>", `<body>${banner}`);
  }
  return new NextResponse(page, {
    headers: { ...HTML_HEADERS, "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'" },
  });
}
