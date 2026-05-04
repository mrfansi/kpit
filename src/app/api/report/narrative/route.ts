import { NextRequest, NextResponse } from "next/server";
import { getAIService, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { createAICacheKey, getCachedAIResponse, setCachedAIResponse } from "@/lib/ai/cache";

interface KPIDataItem {
  name: string;
  description: string;
  domain: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  momDelta: string;
  prevValue: string;
  direction: string;
}

interface NarrativeRequest {
  period: string;
  healthScore: number;
  healthDelta: number | null;
  improved: number;
  declined: number;
  stable: number;
  avgAchievement: number | null;
  domains: { name: string; description: string }[];
  kpis: KPIDataItem[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  const body: NarrativeRequest = await request.json();
  const cacheKey = createAICacheKey("report-narrative", body);
  const cachedNarrative = getCachedAIResponse(cacheKey);
  if (cachedNarrative) {
    return NextResponse.json({ narrative: cachedNarrative, cached: true });
  }

  const kpiSummary = body.kpis
    .map(
      (k) =>
        `- ${k.name} [${k.domain}]${k.description ? ` (${k.description})` : ""}: aktual ${k.actual}, target ${k.target}, pencapaian ${k.achievement}, status ${k.status}, perubahan ${k.momDelta} (sebelumnya ${k.prevValue}), arah: ${k.direction}`
    )
    .join("\n");

  const healthDeltaText =
    body.healthDelta !== null
      ? ` (perubahan ${body.healthDelta > 0 ? "+" : ""}${body.healthDelta}% dari bulan lalu)`
      : "";

  const prompt = `Kamu adalah analis KPI senior. Tulis narasi ringkasan eksekutif dalam Bahasa Indonesia untuk laporan KPI periode ${body.period}.

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
