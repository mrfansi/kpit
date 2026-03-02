import { NextResponse } from "next/server";
import { getKPIsWithLatestEntry } from "@/lib/queries";
import { getKPIStatus } from "@/lib/kpi-status";

export async function GET() {
  const kpisWithEntries = await getKPIsWithLatestEntry();
  const data = kpisWithEntries.map(({ kpi, latestEntry }) => ({
    id: kpi.id,
    name: kpi.name,
    unit: kpi.unit,
    target: kpi.target,
    latestValue: latestEntry?.value ?? null,
    latestPeriod: latestEntry?.periodDate ?? null,
    status: getKPIStatus(latestEntry?.value, kpi),
    refreshType: kpi.refreshType,
  }));
  return NextResponse.json(data);
}
