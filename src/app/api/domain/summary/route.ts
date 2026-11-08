import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { createAICacheKey, getCachedAIResponse, setCachedAIResponse } from "@/lib/ai/cache";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";

const summarySchema = z.object({
  domainName: z.string().min(1).max(200),
  domainDescription: z.string().max(500).optional().default(""),
  period: z.string().max(50),
  healthyCount: z.number().int().min(0),
  warningCount: z.number().int().min(0),
  criticalCount: z.number().int().min(0),
  noDataCount: z.number().int().min(0),
  kpis: z
    .array(
      z.object({
        name: z.string().max(200),
        actual: z.string().max(50),
        target: z.string().max(50),
        achievement: z.string().max(50),
        status: z.string().max(50),
        trend: z.string().max(50),
      })
    )
    .min(1)
    .max(500),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const limited = await enforceAIRateLimit(authResult.session.user.id, "domain-summary");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = summarySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data domain atau KPI tidak valid." }, { status: 400 });
  }
  const body = parsed.data;

  const domainName = sanitizeInput(body.domainName, 100);
  const domainDesc = sanitizeInput(body.domainDescription, 200);
  const cacheKey = createAICacheKey("domain-summary", {
    userId: authResult.session.user.id,
    ...body,
    domainName,
    domainDescription: domainDesc,
  });
  const cachedSummary = getCachedAIResponse(cacheKey);
  if (cachedSummary) {
    return NextResponse.json({ summary: cachedSummary, cached: true });
  }

  const kpiList = body.kpis
    .map(
      (k) =>
        `- ${sanitizeInput(k.name, 200)}: aktual ${k.actual}, target ${k.target}, pencapaian ${k.achievement}, status ${k.status}, tren ${k.trend}`
    )
    .join("\n");

  const prompt = `Kamu adalah analis KPI senior. Tulis ringkasan performa domain "${domainName}" periode ${sanitizeInput(body.period, 50)} dalam Bahasa Indonesia.

${domainDesc ? `Deskripsi domain: ${domainDesc}\n` : ""}Statistik:
- KPI sehat (hijau): ${body.healthyCount}
- KPI perlu perhatian (kuning): ${body.warningCount}
- KPI kritis (merah): ${body.criticalCount}
- KPI belum ada data: ${body.noDataCount}

Detail KPI:
${kpiList}

Instruksi:
- Langsung tulis narasinya, tanpa kalimat pengantar
- Tulis tepat 2 paragraf pendek (masing-masing 2-3 kalimat)
- Paragraf 1: Performa keseluruhan domain ini
- Paragraf 2: KPI yang perlu perhatian dan saran spesifik
- Bahasa mudah dipahami eksekutif non-teknis
- Fokus pada insight, bukan mengulang angka
- Jangan gunakan markdown formatting atau bullet points`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text);
    setCachedAIResponse(cacheKey, text);

    return NextResponse.json({ summary: text });
  } catch (error) {
    return handleAIError(error);
  }
}
