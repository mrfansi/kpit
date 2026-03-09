import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";

interface KPIDataItem {
  name: string;
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
  kpis: KPIDataItem[];
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI tidak tersedia. GOOGLE_AI_API_KEY belum dikonfigurasi." },
      { status: 503 }
    );
  }

  const body: NarrativeRequest = await request.json();

  const kpiSummary = body.kpis
    .map(
      (k) =>
        `- ${k.name}: aktual ${k.actual}, target ${k.target}, pencapaian ${k.achievement}, status ${k.status}, perubahan ${k.momDelta} (sebelumnya ${k.prevValue}), arah: ${k.direction}`
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
- Tulis 2-3 paragraf ringkas
- Paragraf 1: Gambaran umum performa bulan ini
- Paragraf 2: Sorot KPI yang memburuk dan jelaskan dampaknya
- Paragraf 3: Rekomendasi tindakan yang perlu diambil
- Gunakan bahasa yang mudah dipahami oleh eksekutif non-teknis
- Jangan mengulang angka mentah, fokus pada insight dan konteks
- Jangan gunakan bullet points, tulis dalam paragraf naratif`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ narrative: text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Gagal menghasilkan narasi. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
