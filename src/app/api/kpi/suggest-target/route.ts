import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { auth } from "@/auth";

interface HistoricalData {
  periodDate: string;
  value: number;
  target: number;
  achievementPct: number;
}

interface SuggestTargetRequest {
  name: string;
  unit: string;
  direction: string;
  currentTarget: number;
  thresholdGreen: number;
  thresholdYellow: number;
  history: HistoricalData[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  const fullSession = await auth();
  if (fullSession?.user?.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa menggunakan fitur ini." },
      { status: 403 }
    );
  }

  let body: SuggestTargetRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json(
      { error: "Nama KPI harus diisi." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.history) || body.history.length < 3) {
    return NextResponse.json(
      {
        error:
          "Minimal 3 periode data historis diperlukan untuk saran target.",
      },
      { status: 400 }
    );
  }

  const name = sanitizeInput(body.name, 100);
  const unit = sanitizeInput(body.unit || "", 50);

  const directionText =
    body.direction === "lower_better"
      ? "semakin rendah semakin baik"
      : "semakin tinggi semakin baik";

  const historyText = body.history
    .slice(-12)
    .map(
      (h) =>
        `- ${h.periodDate}: aktual ${h.value}, target ${h.target}, pencapaian ${h.achievementPct}%`
    )
    .join("\n");

  const avgAchievement =
    body.history.reduce((sum, h) => sum + h.achievementPct, 0) /
    body.history.length;

  const prompt = `Kamu adalah analis KPI senior. Berikan saran target untuk periode berikutnya.

KPI: ${name}
Satuan: ${unit}
Arah: ${directionText}
Target saat ini: ${body.currentTarget} ${unit}
Threshold hijau: ${body.thresholdGreen}
Threshold kuning: ${body.thresholdYellow}
Rata-rata pencapaian: ${avgAchievement.toFixed(1)}%

Data historis:
${historyText}

Instruksi:
- Jawab HANYA dalam format JSON berikut, tanpa teks lain:
{
  "suggestedTarget": <angka target yang disarankan>,
  "reasoning": "<1-2 kalimat penjelasan dalam Bahasa Indonesia>",
  "confidence": "<low|medium|high>"
}

Aturan penentuan target:
- Jika rata-rata pencapaian >110%, target bisa dinaikkan
- Jika rata-rata pencapaian <80%, target mungkin terlalu ambisius
- Pertimbangkan tren (naik/turun/stabil) dalam 3-6 bulan terakhir
- Target harus realistis tapi menantang (achievable stretch)
- Confidence "high" jika data >6 bulan dan tren konsisten
- Confidence "medium" jika data 3-6 bulan
- Confidence "low" jika data <3 bulan atau tren tidak konsisten`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt, { temperature: 0.3 });
    const cleaned = cleanAIOutput(result.text);

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI tidak menghasilkan format yang valid. Coba lagi." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (
      typeof parsed.suggestedTarget !== "number" ||
      typeof parsed.reasoning !== "string" ||
      !["low", "medium", "high"].includes(parsed.confidence)
    ) {
      return NextResponse.json(
        { error: "AI response format tidak valid. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      suggestedTarget: parsed.suggestedTarget,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI response tidak bisa diparse. Coba lagi." },
        { status: 500 }
      );
    }
    return handleAIError(error);
  }
}
