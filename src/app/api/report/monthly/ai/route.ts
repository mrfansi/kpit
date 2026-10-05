import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAIService } from "@/lib/ai";
import { handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";
import { getMonthlyReportBundle, MonthlyReportError, saveMonthlyReport } from "@/lib/monthly-report-store";
import { checkMonthlyMutationRequest } from "@/lib/monthly-report-request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rejection = checkMonthlyMutationRequest(request);
  if (rejection) return NextResponse.json({ error: rejection.error }, { status: rejection.status });
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const domain = request.nextUrl.searchParams.get("domain") ?? "";
  const period = request.nextUrl.searchParams.get("period") ?? "";
  if (!domain || !period) return NextResponse.json({ error: "Domain and period are required" }, { status: 400 });
  try {
    const bundle = await getMonthlyReportBundle(domain, period);
    if (!bundle) return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    if (bundle.questions.length) return NextResponse.json({ phase: "clarification", questions: bundle.questions, bundle });
    if (bundle.revision === 0) return NextResponse.json({ error: "Save the report before generating assisted notes" }, { status: 409 });
    const body: unknown = await request.json().catch(() => ({}));
    const expectedRevision = body && typeof body === "object" && "revision" in body ? body.revision : null;
    if (expectedRevision !== bundle.revision) return NextResponse.json({ error: "Report has changed. Reload the latest revision.", bundle }, { status: 409 });
    const limited = enforceAIRateLimit(session.user.id, "monthly-report");
    if (limited) return limited;
    const snapshot = {
      domain: bundle.domain.name, period: bundle.period, division: bundle.content.division,
      summary: bundle.content.summary, worstOutcome: bundle.content.worstOutcome, narrativeSource: bundle.content.narrativeSource,
      metrics: bundle.content.metrics.map((m, i) => ({ name: m.name, definition: m.definition, unit: m.unit, aggregation: m.aggregation, aggregationNote: m.aggregationNote, ...bundle.metrics[i], deviationCause: m.deviationCause, deviationEvidence: m.deviationEvidence })),
      risks: bundle.content.risks, actions: bundle.content.actions, decisions: bundle.content.decisions,
      finance: bundle.content.division === "finance" ? bundle.content.finance : undefined,
      channelBreakdowns: bundle.content.channelBreakdowns, activities: bundle.content.activities,
      reconciliations: bundle.reconciliations,
    };
    const result = await getAIService().generateText(`Anda menyusun draf catatan pembicara laporan bulanan berbahasa Indonesia. Gunakan HANYA fakta berikut. Jangan membuat angka, penyebab, bukti, prediksi, sumber, atau keputusan baru. Jelaskan perbedaan MoM/YTD dengan tepat; tandai data untracked sebagai "belum dilacak". Pertahankan rujukan sumber dan jangan mengganti isi laporan. Fakta JSON:\n${JSON.stringify(snapshot)}`, { temperature: 0.2 });
    const notes = result.text.trim();
    if (!notes) return NextResponse.json({ error: "AI returned empty speaker notes" }, { status: 502 });
    const saved = await saveMonthlyReport(domain, period, { ...bundle.content, aiNotes: notes }, bundle.revision, { id: session.user.id, email: session.user.email });
    return NextResponse.json({ phase: "draft", notes, bundle: saved });
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      if (error.status === 409) return NextResponse.json({ error: error.message, bundle: await getMonthlyReportBundle(domain, period) }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleAIError(error);
  }
}
