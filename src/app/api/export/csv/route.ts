import { NextRequest, NextResponse } from "next/server";
import { getDomainBySlug, getKPIsByDomain, getAllKPIs, getAllKPIEntriesBatch } from "@/lib/queries";
import { formatPeriodDate, formatValue } from "@/lib/period";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const domainSlug = searchParams.get("domain");
  const fromDate = searchParams.get("from") ?? undefined;
  const toDate = searchParams.get("to") ?? undefined;

  let kpis;
  if (domainSlug) {
    const domain = await getDomainBySlug(domainSlug);
    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    kpis = await getKPIsByDomain(domain.id);
  } else {
    kpis = await getAllKPIs();
  }

  const rows: string[] = ["KPI,Periode,Nilai Aktual,Target,Unit"];

  const kpiIds = kpis.map((k) => k.id);
  const allEntries = await getAllKPIEntriesBatch(kpiIds, fromDate ?? undefined, toDate ?? undefined);
  const entriesByKpi = new Map<number, typeof allEntries>();
  for (const e of allEntries) {
    if (!entriesByKpi.has(e.kpiId)) entriesByKpi.set(e.kpiId, []);
    entriesByKpi.get(e.kpiId)!.push(e);
  }

  for (const kpi of kpis) {
    const entries = entriesByKpi.get(kpi.id) ?? [];
    for (const entry of entries) {
      rows.push(`"${kpi.name}","${formatPeriodDate(entry.periodDate, "MMMM yyyy")}",${entry.value},${kpi.target},"${kpi.unit}"`);
    }
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kpi-report.csv"`,
    },
  });
}
