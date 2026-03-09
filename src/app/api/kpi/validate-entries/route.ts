import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { auth } from "@/auth";

interface EntryToValidate {
  kpiId: string;
  kpiName: string;
  unit: string;
  inputValue: number;
  recentValues: number[];
  target: number;
  direction: string;
}

interface ValidateEntriesRequest {
  period: string;
  entries: EntryToValidate[];
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

  let body: ValidateEntriesRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json(
      { error: "Data entry tidak boleh kosong." },
      { status: 400 }
    );
  }

  const period = sanitizeInput(body.period || "", 50);

  const entriesText = body.entries
    .map((e) => {
      const avg =
        e.recentValues.length > 0
          ? (
              e.recentValues.reduce((a, b) => a + b, 0) /
              e.recentValues.length
            ).toFixed(2)
          : "N/A";
      const min =
        e.recentValues.length > 0 ? Math.min(...e.recentValues) : "N/A";
      const max =
        e.recentValues.length > 0 ? Math.max(...e.recentValues) : "N/A";
      const direction =
        e.direction === "lower_better"
          ? "rendah lebih baik"
          : "tinggi lebih baik";
      return `- ${e.kpiName} (${e.unit}, ${direction}): input ${e.inputValue}, target ${e.target}, rata-rata 3 bulan ${avg}, range [${min}-${max}]`;
    })
    .join("\n");

  const prompt = `Kamu adalah validator data KPI. Periksa apakah nilai input berikut masuk akal berdasarkan data historis.

Periode: ${period}

Data entry:
${entriesText}

Instruksi:
- Jawab HANYA dalam format JSON array, tanpa teks lain:
[
  {
    "kpiName": "<nama KPI>",
    "concern": "<penjelasan singkat dalam Bahasa Indonesia kenapa nilai ini mencurigakan>",
    "severity": "warning" atau "info"
  }
]
- Hanya masukkan KPI yang mencurigakan, JANGAN masukkan yang normal
- Flag "warning" jika: nilai >50% lebih tinggi/rendah dari rata-rata historis, atau nilai di luar range historis secara signifikan
- Flag "info" jika: nilai berbeda dari tren tapi masih bisa masuk akal
- Jika semua nilai wajar, jawab dengan array kosong: []
- Jangan flag KPI yang belum punya data historis (rata-rata N/A)`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt, { temperature: 0.2 });
    const cleaned = cleanAIOutput(result.text);

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ flags: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ flags: [] });
    }

    const flags = parsed
      .filter(
        (f: Record<string, unknown>) =>
          typeof f.kpiName === "string" &&
          typeof f.concern === "string" &&
          (f.severity === "warning" || f.severity === "info")
      )
      .map((f: Record<string, unknown>) => ({
        kpiName: String(f.kpiName),
        concern: String(f.concern),
        severity: f.severity as "warning" | "info",
      }));

    return NextResponse.json({ flags });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ flags: [] });
    }
    return handleAIError(error);
  }
}
