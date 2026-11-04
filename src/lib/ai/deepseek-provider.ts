import type { AIService, AIGenerateOptions, AIGenerateResult } from "./types";
import { AIServiceError } from "./types";

const ENDPOINT = "https://api.deepseek.com/chat/completions";

/**
 * Nama model resmi saat ini (https://api-docs.deepseek.com/quick_start/pricing).
 * `deepseek-v4-flash` hanya alias lama. Bisa ditimpa lewat DEEPSEEK_MODEL,
 * mis. `deepseek-v4-pro`, tanpa mengubah kode.
 */
const DEFAULT_MODEL = "deepseek-flash";

/**
 * Batas keras token keluaran per panggilan. Pemanggil boleh memperketat lewat
 * options, tapi tidak pernah membiarkannya tanpa batas, supaya biaya dan
 * latensi tidak lepas kendali.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

// Panggilan AI ada di jalur request pengguna. Tanpa batas waktu, satu panggilan
// yang menggantung akan menahan koneksi sampai batas platform.
const REQUEST_TIMEOUT_MS = 60_000;

interface ChatCompletionResponse {
  choices?: {
    finish_reason?: string | null;
    message?: { content?: string | null };
  }[];
  usage?: Record<string, unknown>;
}

/**
 * DeepSeek API lewat endpoint chat completions (format OpenAI).
 *
 * Sengaja memakai fetch biasa, bukan SDK: aplikasi hanya butuh satu chat
 * completion non-streaming (semua pemanggil `generateText` menunggu teks utuh).
 * SDK deepseek-harness tidak dipakai karena ia menjalankan subprocess `dsh`
 * lewat stdio, dan itu tidak bisa dilakukan dari Cloudflare Worker.
 */
export class DeepSeekProvider implements AIService {
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(apiKey: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel || DEFAULT_MODEL;
  }

  async generateText(
    prompt: string,
    options?: AIGenerateOptions
  ): Promise<AIGenerateResult> {
    const modelName = options?.model ?? this.defaultModel;
    const maxOutputTokens = options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          // Thinking mode (default DeepSeek) diabaikan temperature-nya, padahal
          // pemanggil menyetelnya, dan token penalarannya ikut dihitung
          // terhadap max_tokens sehingga jawaban bisa terpotong di 4096.
          thinking: { type: "disabled" },
          max_tokens: maxOutputTokens,
          stream: false,
          ...(options?.temperature !== undefined && {
            temperature: options.temperature,
          }),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Termasuk timeout dan kegagalan jaringan. Keduanya bukan kesalahan
      // pemanggil, jadi dilaporkan sebagai kegagalan provider.
      throw new AIServiceError("Gagal menghubungi DeepSeek.", "provider_error", error);
    }

    if (!response.ok) {
      // Isi body dibaca untuk log, bukan untuk ditampilkan ke pengguna: pesan
      // provider bisa memuat detail akun atau saldo.
      const detail = await response.text().catch(() => "");
      throw new AIServiceError(
        "Gagal menghasilkan teks dari DeepSeek.",
        "provider_error",
        `HTTP ${response.status}: ${detail.slice(0, 500)}`
      );
    }

    let payload: ChatCompletionResponse;
    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch (error) {
      throw new AIServiceError(
        "Respons DeepSeek bukan JSON yang valid.",
        "invalid_response",
        error
      );
    }

    const choice = payload.choices?.[0];
    const text = choice?.message?.content;
    const finishReason = choice?.finish_reason;

    // Selain "stop", setiap finish_reason (length, content_filter,
    // insufficient_system_resource, aborted) berarti jawaban terpotong.
    // Teks parsial jangan sampai tampil di laporan seolah sudah lengkap.
    if (finishReason && finishReason !== "stop") {
      throw new AIServiceError(
        finishReason === "length"
          ? `Batas ${maxOutputTokens} token habis sebelum model selesai menjawab.`
          : `DeepSeek menghentikan jawaban sebelum selesai (${finishReason}).`,
        "invalid_response",
        payload
      );
    }

    // Model bisa mengembalikan 200 dengan konten kosong. Itu bukan jawaban,
    // jadi jangan diteruskan sebagai string "".
    if (typeof text !== "string" || text.trim() === "") {
      throw new AIServiceError("DeepSeek mengembalikan respons kosong.", "invalid_response", payload);
    }

    return { text, metadata: { model: modelName, usage: payload.usage } };
  }
}
