import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { buildDataSnapshot, formatDataContext } from "@/lib/ai/data-context";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

const MAX_HISTORY = 20;

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json(
      { error: "Pesan tidak boleh kosong." },
      { status: 400 }
    );
  }

  const message = sanitizeInput(body.message, 500);
  const history = (body.history || []).slice(-MAX_HISTORY);

  const snapshot = await buildDataSnapshot();
  const dataContext = formatDataContext(snapshot);

  const conversationHistory = history
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
    .join("\n");

  const prompt = `Kamu adalah asisten AI untuk platform KPI Dashboard. Jawab pertanyaan user berdasarkan data berikut.

${dataContext}

${conversationHistory ? `Percakapan sebelumnya:\n${conversationHistory}\n` : ""}
User: ${message}

Instruksi:
- Jawab dalam Bahasa Indonesia
- Jawab HANYA berdasarkan data di atas, jangan mengarang data
- Jika data tidak tersedia untuk menjawab, katakan "Maaf, data yang diperlukan tidak tersedia."
- Jawab ringkas dan langsung, 2-4 kalimat
- Jangan gunakan markdown formatting
- Jika user bertanya di luar konteks KPI/timeline, katakan "Saya hanya bisa menjawab pertanyaan tentang data KPI dan timeline project."
- Sertakan angka spesifik dari data saat relevan`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text);

    return NextResponse.json({
      reply: text,
      dataDate: snapshot.generatedAt,
    });
  } catch (error) {
    return handleAIError(error);
  }
}
