import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { enforceAIRateLimit } from "@/lib/ai/rate-limit";
import { buildDataSnapshot, formatDataContext } from "@/lib/ai/data-context";

const MAX_HISTORY = 20;

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(MAX_HISTORY)
    .optional()
    .default([]),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const limited = enforceAIRateLimit(authResult.session.user.id, "chat");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
  }

  const parsed = chatSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });
  }

  const message = sanitizeInput(parsed.data.message, 500);
  const history = parsed.data.history.slice(-MAX_HISTORY);

  const snapshot = await buildDataSnapshot();
  const dataContext = formatDataContext(snapshot);

  // Sanitize each history entry to prevent prompt injection via fake turns.
  const conversationHistory = history
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${sanitizeInput(m.content, 2000)}`)
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
