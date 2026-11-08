import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import {
  getAIService,
  sanitizeInput,
  cleanAIOutput,
} from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";

const MAX_DESCRIPTION_LENGTH = 200;

const VALID_DIRECTIONS = ["higher_better", "lower_better"] as const;

const generateSchema = z.object({
  name: z.string().trim().min(3).max(200),
  unit: z.string().trim().min(1).max(50),
  target: z.number().finite(),
  direction: z.enum(VALID_DIRECTIONS),
  domain: z.string().trim().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  if (authResult.session.user.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  const limited = enforceAIRateLimit(authResult.session.user.id, "generate-description");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = generateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data KPI tidak valid: nama minimal 3 karakter, satuan, domain, target, dan arah harus diisi." },
      { status: 400 }
    );
  }
  const body = parsed.data;

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
