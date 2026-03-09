import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

interface HistoryEntry {
  periodDate: string;
  value: number;
  target: number;
  achievement: string;
}

interface SiblingKPI {
  name: string;
  status: string;
  achievement: string;
  trend: string;
}

interface AnalyzeRequest {
  name: string;
  description: string;
  domain: string;
  unit: string;
  direction: string;
  history: HistoryEntry[];
  siblings: SiblingKPI[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  let body: AnalyzeRequest;
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

  if (!Array.isArray(body.history) || body.history.length < 2) {
    return NextResponse.json(
      { error: "Minimal 2 periode data historis diperlukan untuk analisis." },
      { status: 400 }
    );
  }

  const name = sanitizeInput(body.name, 100);
  const domain = sanitizeInput(body.domain || "Umum", 100);
  const description = sanitizeInput(body.description || "", 200);
  const unit = sanitizeInput(body.unit || "", 50);

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
              `- ${s.name}: status ${s.status}, pencapaian ${s.achievement}, tren ${s.trend}`
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
