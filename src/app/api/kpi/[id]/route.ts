import { NextRequest, NextResponse } from "next/server";
import { getKPIById } from "@/lib/queries";
import { createEntry } from "@/lib/actions/entry";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const kpiId = Number(id);
  if (isNaN(kpiId)) return NextResponse.json({ error: "Invalid KPI id" }, { status: 400 });

  const kpi = await getKPIById(kpiId);
  if (!kpi) return NextResponse.json({ error: "KPI not found" }, { status: 404 });

  const body = await req.json();
  const { value, period_date, note } = body;

  if (typeof value !== "number" || !period_date) {
    return NextResponse.json({ error: "value (number) and period_date (YYYY-MM-DD) are required" }, { status: 400 });
  }

  await createEntry({ kpiId, value, periodDate: period_date, note });
  return NextResponse.json({ success: true });
}
