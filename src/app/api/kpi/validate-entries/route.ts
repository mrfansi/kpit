import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";

const validateEntriesSchema = z.object({
  period: z.string().max(50).optional().default(""),
  entries: z
    .array(
      z.object({
        kpiId: z.union([z.string(), z.number()]).optional(),
        kpiName: z.string().max(200),
        unit: z.string().max(50).optional().default(""),
        inputValue: z.number(),
        recentValues: z.array(z.number().finite()).optional().default([]),
        target: z.number(),
        direction: z.string().max(50).optional().default(""),
      })
    )
    .min(1),
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

  const limited = enforceAIRateLimit(authResult.session.user.id, "validate-entries");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = validateEntriesSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data entry tidak valid." }, { status: 400 });
  }
  const body = parsed.data;

  const period = sanitizeInput(body.period, 50);

  const entriesText = body.entries
    .map((e) => {
      const avg =
        e.recentValues.length > 0
          ? (e.recentValues.reduce((a, b) => a + b, 0) / e.recentValues.length).toFixed(2)
          : "N/A";
      const min = e.recentValues.length > 0 ? Math.min(...e.recentValues) : "N/A";
      const max = e.recentValues.length > 0 ? Math.max(...e.recentValues) : "N/A";
      const direction =
        e.direction === "lower_better" ? "rendah lebih baik" : "tinggi lebih baik";
      return `- ${sanitizeInput(e.kpiName, 200)} (${sanitizeInput(e.unit, 50)}, ${direction}): input ${e.inputValue}, target ${e.target}, rata-rata 3 bulan ${avg}, range [${min}-${max}]`;
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

    const parsedFlags = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsedFlags)) {
      return NextResponse.json({ flags: [] });
    }

    const flags = parsedFlags
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
