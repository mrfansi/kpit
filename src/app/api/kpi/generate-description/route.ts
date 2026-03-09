import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";

interface GenerateDescriptionRequest {
  name: string;
  unit: string;
  target: number;
  direction: string;
  domain: string;
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

  const body: GenerateDescriptionRequest = await request.json();

  if (!body.name || body.name.trim().length < 3) {
    return NextResponse.json(
      { error: "Nama KPI harus minimal 3 karakter." },
      { status: 400 }
    );
  }

  const directionText =
    body.direction === "lower_better"
      ? "semakin rendah semakin baik"
      : "semakin tinggi semakin baik";

  const prompt = `Tulis 1 kalimat deskripsi singkat dalam Bahasa Indonesia untuk KPI berikut. Maksimal 200 karakter.

Nama KPI: ${body.name}
Domain: ${body.domain}
Satuan: ${body.unit}
Target: ${body.target}
Arah: ${directionText}

Instruksi:
- Langsung tulis deskripsinya, JANGAN buka dengan label seperti "Deskripsi:" atau "KPI ini"
- Hanya 1 kalimat, padat dan jelas
- Jangan gunakan markdown formatting (bold, italic, asterisks)
- Maksimal 200 karakter`;

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
    text = text.trim().slice(0, 255);

    return NextResponse.json({ description: text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Gagal menghasilkan deskripsi. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
