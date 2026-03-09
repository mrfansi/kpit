import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

interface ProgressLog {
  date: string;
  progressBefore: number;
  progressAfter: number;
  content: string;
}

interface RiskAnalysisRequest {
  projectName: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  estimatedLaunchDate: string | null;
  launchBufferDays: number;
  progress: number;
  logs: ProgressLog[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  let body: RiskAnalysisRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!body.projectName || typeof body.projectName !== "string") {
    return NextResponse.json(
      { error: "Nama project harus diisi." },
      { status: 400 }
    );
  }

  if (!body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: "Tanggal mulai dan selesai harus diisi." },
      { status: 400 }
    );
  }

  const projectName = sanitizeInput(body.projectName, 100);
  const description = sanitizeInput(body.description || "", 200);
  const status = sanitizeInput(body.status || "", 50);

  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  const now = new Date();
  const totalDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const elapsedDays = Math.ceil(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const remainingDays = Math.ceil(
    (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const timeElapsedPct =
    totalDays > 0 ? ((elapsedDays / totalDays) * 100).toFixed(1) : "0";

  const logsText =
    body.logs.length > 0
      ? body.logs
          .slice(-15)
          .map(
            (l) =>
              `- ${l.date}: progress ${l.progressBefore}% → ${l.progressAfter}% | ${l.content}`
          )
          .join("\n")
      : "Belum ada log aktivitas.";

  const prompt = `Kamu adalah project manager senior. Analisis risiko keterlambatan project berikut.

Project: ${projectName}
${description ? `Deskripsi: ${description}\n` : ""}Status: ${status}
Mulai: ${body.startDate}
Deadline: ${body.endDate}
${body.estimatedLaunchDate ? `Estimasi launch: ${body.estimatedLaunchDate}\n` : ""}Buffer: ${body.launchBufferDays} hari

Progress: ${body.progress}%
Waktu berlalu: ${elapsedDays} dari ${totalDays} hari (${timeElapsedPct}%)
Sisa waktu: ${remainingDays} hari

Log aktivitas terakhir:
${logsText}

Instruksi:
- Jawab dalam format JSON berikut, dengan field "analysis" berisi 2 paragraf narasi:
{
  "riskLevel": "<low|medium|high|critical>",
  "estimatedCompletion": "<YYYY-MM-DD perkiraan selesai berdasarkan velocity>",
  "onTrack": <true|false>,
  "analysis": "<2 paragraf: paragraf 1 tentang situasi saat ini, paragraf 2 tentang rekomendasi. Pisahkan paragraf dengan \\n\\n>"
}

Aturan penilaian risiko:
- "low": progress >= waktu berlalu, velocity konsisten
- "medium": progress sedikit tertinggal (<15% gap), atau velocity menurun
- "high": progress tertinggal signifikan (15-30% gap), atau tidak ada update terbaru
- "critical": progress tertinggal >30%, atau deadline sangat dekat dengan progress rendah
- estimatedCompletion: hitung dari velocity rata-rata (progress/hari dari log)
- Jika tidak ada log, gunakan progress/elapsedDays sebagai velocity`;

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
      !["low", "medium", "high", "critical"].includes(parsed.riskLevel) ||
      typeof parsed.onTrack !== "boolean" ||
      typeof parsed.analysis !== "string"
    ) {
      return NextResponse.json(
        { error: "AI response format tidak valid. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      riskLevel: parsed.riskLevel,
      estimatedCompletion: parsed.estimatedCompletion || null,
      onTrack: parsed.onTrack,
      analysis: parsed.analysis,
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
