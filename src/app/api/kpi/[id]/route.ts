import { NextRequest, NextResponse } from "next/server";
import { getKPIById } from "@/lib/queries";
import { createEntry } from "@/lib/actions/entry";
import { auth } from "@/auth";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const entryRequestSchema = z.object({
  value: z.number().finite(),
  period_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(50000).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const kpiId = Number(id);
  if (isNaN(kpiId)) return NextResponse.json({ error: "Invalid KPI id" }, { status: 400 });

  const kpi = await getKPIById(kpiId);
  if (!kpi) return NextResponse.json({ error: "KPI not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = entryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const { value, period_date: periodDate, note } = parsed.data;
  await createEntry({ kpiId, value, periodDate, note });
  return NextResponse.json({ success: true });
}
