import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";

const analyzeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(""),
  domain: z.string().max(200).optional().default("Umum"),
  unit: z.string().max(100).optional().default(""),
  direction: z.string().max(50).optional().default(""),
  history: z
    .array(
      z.object({
        periodDate: z.string().max(20),
        value: z.number(),
        target: z.number(),
        achievement: z.string().max(50),
      })
    )
    .min(2),
  siblings: z
    .array(
      z.object({
        name: z.string().max(200),
        status: z.string().max(50),
        achievement: z.string().max(50),
        trend: z.string().max(50),
      })
    )
    .optional()
    .default([]),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const limited = enforceAIRateLimit(authResult.session.user.id, "analyze");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = analyzeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data tidak valid. Minimal 2 periode data historis diperlukan." },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const name = sanitizeInput(body.name, 100);
  const domain = sanitizeInput(body.domain, 100);
  const description = sanitizeInput(body.description, 200);
  const unit = sanitizeInput(body.unit, 50);

  const directionText =
    body.direction === "lower_better"
      ? "semakin rendah semakin baik"
      : "semakin tinggi semakin baik";

  const historyText = body.history
    .slice(-12)
    .map(
      (h) =>
        `- ${h.periodDate}: aktual ${h.value} ${unit}, target ${h.target} ${unit}, pencapaian ${h.achievement}`
    )
    .join("\n");

  const siblingsText =
    body.siblings.length > 0
      ? body.siblings
          .map(
            (s) =>
              `- ${sanitizeInput(s.name, 200)}: status ${s.status}, pencapaian ${s.achievement}, tren ${s.trend}`
          )
          .join("\n")
      : "Tidak ada KPI lain di domain ini.";

  const prompt = `Kamu adalah analis KPI senior. Analisis KPI berikut dan jelaskan penyebab tren yang terlihat.

KPI: ${name}
${description ? `Deskripsi: ${description}\n` : ""}Domain: ${domain}
Satuan: ${unit}
Arah: ${directionText}

Data historis (terbaru di bawah):
${historyText}

KPI lain di domain ${domain}:
${siblingsText}

Instruksi:
- Langsung tulis analisisnya, tanpa kalimat pengantar
- Tulis tepat 3 paragraf pendek (masing-masing 2-3 kalimat)
- Paragraf 1: Apa tren utama yang terlihat dari data
- Paragraf 2: Kemungkinan penyebab berdasarkan pola data dan konteks domain
- Paragraf 3: Satu rekomendasi tindakan yang spesifik dan actionable
- Jika ada korelasi dengan KPI lain di domain, sebutkan
- Bahasa mudah dipahami, fokus insight bukan angka mentah
- Jangan gunakan markdown formatting atau bullet points`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text);

    return NextResponse.json({ analysis: text });
  } catch (error) {
    return handleAIError(error);
  }
}
