import { NextRequest, NextResponse } from "next/server";
import { getDomainBySlug, getKPIsByDomain, getAllKPIs, getAllKPIEntriesBatch } from "@/lib/queries";
import { formatPeriodDate } from "@/lib/period";
import { auth } from "@/auth";

function csvCell(value: string | number) {
  const raw = String(value);
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replaceAll('"', '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
      rows.push([
        csvCell(kpi.name),
        csvCell(formatPeriodDate(entry.periodDate, "MMMM yyyy")),
        csvCell(entry.value),
        csvCell(kpi.target),
        csvCell(kpi.unit),
      ].join(","));
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
