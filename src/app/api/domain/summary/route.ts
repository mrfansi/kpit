import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

interface DomainKPIItem {
  name: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  trend: string;
}

interface DomainSummaryRequest {
  domainName: string;
  domainDescription: string;
  period: string;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  noDataCount: number;
  kpis: DomainKPIItem[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  let body: DomainSummaryRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!body.domainName || typeof body.domainName !== "string") {
    return NextResponse.json(
      { error: "Nama domain harus diisi." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.kpis) || body.kpis.length === 0) {
    return NextResponse.json(
      { error: "Data KPI tidak boleh kosong." },
      { status: 400 }
    );
  }

  const domainName = sanitizeInput(body.domainName, 100);
  const domainDesc = sanitizeInput(body.domainDescription || "", 200);

  const kpiList = body.kpis
    .map(
      (k) =>
        `- ${k.name}: aktual ${k.actual}, target ${k.target}, pencapaian ${k.achievement}, status ${k.status}, tren ${k.trend}`
    )
    .join("\n");

  const prompt = `Kamu adalah analis KPI senior. Tulis ringkasan performa domain "${domainName}" periode ${body.period} dalam Bahasa Indonesia.

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

    return NextResponse.json({ summary: text });
  } catch (error) {
    return handleAIError(error);
  }
}
