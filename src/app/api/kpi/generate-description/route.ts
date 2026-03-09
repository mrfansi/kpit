import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";

const MAX_DESCRIPTION_LENGTH = 200;

const VALID_DIRECTIONS = ["higher_better", "lower_better"] as const;

interface GenerateDescriptionRequest {
  name: string;
  unit: string;
  target: number;
  direction: string;
  domain: string;
}

function sanitize(input: string, maxLength: number): string {
  return input.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
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

  let body: GenerateDescriptionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (
    typeof body.name !== "string" ||
    typeof body.unit !== "string" ||
    typeof body.direction !== "string" ||
    typeof body.domain !== "string"
  ) {
    return NextResponse.json(
      { error: "Field name, unit, direction, dan domain harus berupa string." },
      { status: 400 }
    );
  }

  if (!body.name || body.name.trim().length < 3) {
    return NextResponse.json(
      { error: "Nama KPI harus minimal 3 karakter." },
      { status: 400 }
    );
  }

  if (!VALID_DIRECTIONS.includes(body.direction as (typeof VALID_DIRECTIONS)[number])) {
    return NextResponse.json(
      { error: "Direction harus 'higher_better' atau 'lower_better'." },
      { status: 400 }
    );
  }

  if (!body.unit.trim() || !body.domain.trim()) {
    return NextResponse.json(
      { error: "Field unit dan domain tidak boleh kosong." },
      { status: 400 }
    );
  }

  if (typeof body.target !== "number" || !isFinite(body.target)) {
    return NextResponse.json(
      { error: "Target harus berupa angka yang valid." },
      { status: 400 }
    );
  }

  const name = sanitize(body.name, 100);
  const unit = sanitize(body.unit, 50);
  const domain = sanitize(body.domain, 100);

  const directionText =
    body.direction === "lower_better"
      ? "semakin rendah semakin baik"
      : "semakin tinggi semakin baik";

  const prompt = `Tulis 1 kalimat deskripsi singkat dalam Bahasa Indonesia untuk KPI berikut. Maksimal ${MAX_DESCRIPTION_LENGTH} karakter.

Nama KPI: ${name}
Domain: ${domain}
Satuan: ${unit}
Target: ${body.target}
Arah: ${directionText}

Instruksi:
- Langsung tulis deskripsinya, JANGAN buka dengan label seperti "Deskripsi:" atau "KPI ini"
- Hanya 1 kalimat, padat dan jelas
- Jangan gunakan markdown formatting (bold, italic, asterisks)
- Maksimal ${MAX_DESCRIPTION_LENGTH} karakter`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });
    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // Strip markdown formatting (bold/italic asterisks)
    text = text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");

    // Remove common prefix patterns the model might add
    text = text.replace(
      /^(Deskripsi\s*:\s*|KPI ini\s+|Indikator ini\s+)/i,
      ""
    );

    // Trim whitespace and enforce max length
    text = text.trim().slice(0, MAX_DESCRIPTION_LENGTH);

    return NextResponse.json({ description: text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Gagal menghasilkan deskripsi. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
