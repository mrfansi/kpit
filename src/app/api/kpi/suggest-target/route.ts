import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";

const suggestTargetSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().max(50).optional().default(""),
  direction: z.string().max(50).optional().default(""),
  currentTarget: z.number().optional().default(0),
  thresholdGreen: z.number().optional().default(0),
  thresholdYellow: z.number().optional().default(0),
  history: z
    .array(
      z.object({
        periodDate: z.string().max(20),
        value: z.number(),
        target: z.number(),
        achievementPct: z.number().finite(),
      })
    )
    .min(3),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  if (authResult.session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa menggunakan fitur ini." },
      { status: 403 }
    );
  }

  const limited = enforceAIRateLimit(authResult.session.user.id, "suggest-target");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = suggestTargetSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data tidak valid. Minimal 3 periode data historis diperlukan." },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const name = sanitizeInput(body.name, 100);
  const unit = sanitizeInput(body.unit, 50);

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
    body.history.reduce((sum, h) => sum + h.achievementPct, 0) / body.history.length;

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

    const parsedResult = JSON.parse(jsonMatch[0]);

    if (
      typeof parsedResult.suggestedTarget !== "number" ||
      typeof parsedResult.reasoning !== "string" ||
      !["low", "medium", "high"].includes(parsedResult.confidence)
    ) {
      return NextResponse.json(
        { error: "AI response format tidak valid. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      suggestedTarget: parsedResult.suggestedTarget,
      reasoning: parsedResult.reasoning,
      confidence: parsedResult.confidence,
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
