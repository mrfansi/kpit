import { NextRequest, NextResponse } from "next/server";
import {
  getAIService,
  sanitizeInput,
  cleanAIOutput,
} from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

const MAX_DESCRIPTION_LENGTH = 200;

const VALID_DIRECTIONS = ["higher_better", "lower_better"] as const;

interface GenerateDescriptionRequest {
  name: string;
  unit: string;
  target: number;
  direction: string;
  domain: string;
}

export async function POST(request: NextRequest) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

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

  if (
    !VALID_DIRECTIONS.includes(
      body.direction as (typeof VALID_DIRECTIONS)[number]
    )
  ) {
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

  const name = sanitizeInput(body.name, 100);
  const unit = sanitizeInput(body.unit, 50);
  const domain = sanitizeInput(body.domain, 100);

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
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text).slice(0, MAX_DESCRIPTION_LENGTH);

    return NextResponse.json({ description: text });
  } catch (error) {
    return handleAIError(error);
  }
}
