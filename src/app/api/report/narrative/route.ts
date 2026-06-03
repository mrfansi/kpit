import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";
import { createAICacheKey, getCachedAIResponse, setCachedAIResponse } from "@/lib/ai/cache";

const narrativeSchema = z.object({
  period: z.string().max(20),
  healthScore: z.number(),
  healthDelta: z.number().nullable().optional().default(null),
  improved: z.number().optional().default(0),
  declined: z.number().optional().default(0),
  stable: z.number().optional().default(0),
  avgAchievement: z.number().nullable().optional().default(null),
  domains: z
    .array(z.object({ name: z.string().max(200), description: z.string().max(500).optional().default("") }))
    .optional()
    .default([]),
  kpis: z
    .array(
      z.object({
        name: z.string().max(200),
        description: z.string().max(500).optional().default(""),
        domain: z.string().max(200).optional().default(""),
        actual: z.string().max(50),
        target: z.string().max(50),
        achievement: z.string().max(50),
        status: z.string().max(50),
        momDelta: z.string().max(50),
        prevValue: z.string().max(50),
        direction: z.string().max(50),
      })
    )
    .max(500),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const limited = enforceAIRateLimit(authResult.session.user.id, "narrative");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = narrativeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data laporan tidak valid." }, { status: 400 });
  }
  const body = parsed.data;

  // Cache scoped to the authenticated user to avoid serving/poisoning across users.
  const cacheKey = createAICacheKey("report-narrative", { userId: authResult.session.user.id, body });
  const cachedNarrative = getCachedAIResponse(cacheKey);
  if (cachedNarrative) {
    return NextResponse.json({ narrative: cachedNarrative, cached: true });
  }

  const kpiSummary = body.kpis
    .map((k) => {
      const name = sanitizeInput(k.name, 200);
      const domain = sanitizeInput(k.domain, 200);
      const description = sanitizeInput(k.description, 300);
      return `- ${name} [${domain}]${description ? ` (${description})` : ""}: aktual ${k.actual}, target ${k.target}, pencapaian ${k.achievement}, status ${k.status}, perubahan ${k.momDelta} (sebelumnya ${k.prevValue}), arah: ${k.direction}`;
    })
    .join("\n");

  const healthDeltaText =
    body.healthDelta !== null
      ? ` (perubahan ${body.healthDelta > 0 ? "+" : ""}${body.healthDelta}% dari bulan lalu)`
      : "";

  const prompt = `Kamu adalah analis KPI senior. Tulis narasi ringkasan eksekutif dalam Bahasa Indonesia untuk laporan KPI periode ${sanitizeInput(body.period, 20)}.

Data:
- Health Score: ${body.healthScore}%${healthDeltaText}
- Pergerakan status: ${body.improved} naik, ${body.declined} turun, ${body.stable} tetap
- Rata-rata pencapaian: ${body.avgAchievement ?? "N/A"}%

Detail KPI:
${kpiSummary}

Instruksi:
- Langsung tulis narasinya, JANGAN buka dengan kalimat pengantar seperti "Berikut adalah..."
- Tulis tepat 3 paragraf pendek (masing-masing 2-3 kalimat saja)
- Paragraf 1: Gambaran umum performa bulan ini
- Paragraf 2: Sorot KPI yang memburuk dan jelaskan dampaknya
- Paragraf 3: Satu rekomendasi tindakan prioritas
- Gunakan bahasa yang mudah dipahami oleh eksekutif non-teknis
- Jangan mengulang angka mentah, fokus pada insight dan konteks
- Jangan gunakan markdown formatting (bold, italic, asterisks)
- Jangan gunakan bullet points, tulis dalam paragraf naratif`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text);
    setCachedAIResponse(cacheKey, text);

    return NextResponse.json({ narrative: text });
  } catch (error) {
    return handleAIError(error);
  }
}
