import type { AIService, AIGenerateOptions, AIGenerateResult } from "./types";
import { AIServiceError } from "./types";

/**
 * Model default. Semua prompt di aplikasi ini menuntut jawaban Bahasa Indonesia
 * dan penalaran atas tabel angka, jadi model kelas kecil (mis. llama-3.1-8b)
 * terlalu sering menjawab dalam bahasa Inggris atau mengarang angka. Bisa
 * ditimpa lewat CLOUDFLARE_AI_MODEL tanpa mengubah kode.
 */
const DEFAULT_MODEL = "@cf/openai/gpt-oss-120b";

/**
 * Batas keras token keluaran per panggilan. Pemanggil boleh memperketat lewat
 * options, tapi tidak pernah membiarkannya tanpa batas — melindungi dari biaya
 * dan latensi yang lepas kendali.
 *
 * 4096, bukan 1024 seperti era Gemini: pada model reasoning (glm, gpt-oss)
 * token penalaran ikut dihitung terhadap max_tokens dan dikeluarkan LEBIH DULU
 * daripada jawaban. Diukur pada prompt narasi executive report — glm-5.2
 * menghabiskan seluruh 1024 token untuk bernalar dan mengembalikan content
 * kosong dengan finish_reason "length"; pada 4096 ia selesai di ~1473 token.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

// Panggilan AI ada di jalur request pengguna. Tanpa batas waktu, satu panggilan
// yang menggantung akan menahan koneksi sampai batas platform.
//
// 60 detik karena model reasoning memang lambat: diukur pada prompt narasi
// executive report, glm-5.2 butuh 18-23 detik sementara gpt-oss-120b 6 detik.
// Batas 30 detik akan memutus glm di tengah jalan pada prompt yang lebih besar
// (mis. chat yang membawa seluruh snapshot data).
const REQUEST_TIMEOUT_MS = 60_000;

interface ChatCompletionResponse {
  choices?: {
    finish_reason?: string | null;
    message?: { content?: string | null };
  }[];
  usage?: Record<string, unknown>;
}

/**
 * Workers AI lewat endpoint yang kompatibel dengan OpenAI.
 *
 * Sengaja memakai fetch biasa, bukan SDK openai: seluruh aplikasi hanya butuh
 * satu chat completion non-streaming (kesembilan pemanggil `generateText`
 * menunggu teks utuh), jadi satu POST sudah cukup dan tidak perlu dependensi
 * tambahan.
 */
export class WorkersAIProvider implements AIService {
  private readonly endpoint: string;
  private readonly apiToken: string;
  private readonly defaultModel: string;

  constructor(accountId: string, apiToken: string, defaultModel?: string) {
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    this.apiToken = apiToken;
    this.defaultModel = defaultModel ?? DEFAULT_MODEL;
  }

  async generateText(
    prompt: string,
    options?: AIGenerateOptions
  ): Promise<AIGenerateResult> {
    const modelName = options?.model ?? this.defaultModel;
    const maxOutputTokens = options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          // max_completion_tokens, bukan max_tokens: yang terakhir sudah
          // deprecated di skema Workers AI.
          max_completion_tokens: maxOutputTokens,
          ...(options?.temperature !== undefined && {
            temperature: options.temperature,
          }),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Termasuk timeout dan kegagalan jaringan — keduanya bukan kesalahan
      // pemanggil, jadi dilaporkan sebagai kegagalan provider.
      throw new AIServiceError(
        "Gagal menghubungi Workers AI.",
        "provider_error",
        error
      );
    }

    if (!response.ok) {
      // Isi body dibaca untuk log, bukan untuk ditampilkan ke pengguna: pesan
      // dari Cloudflare bisa memuat detail akun.
      const detail = await response.text().catch(() => "");
      throw new AIServiceError(
        "Gagal menghasilkan teks dari Workers AI.",
        "provider_error",
        `HTTP ${response.status}: ${detail.slice(0, 500)}`
      );
    }

    let payload: ChatCompletionResponse;
    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch (error) {
      throw new AIServiceError(
        "Respons Workers AI bukan JSON yang valid.",
        "invalid_response",
        error
      );
    }

    const choice = payload.choices?.[0];
    const text = choice?.message?.content;

    // Model bisa mengembalikan 200 dengan konten kosong. Itu bukan jawaban,
    // jadi jangan diteruskan sebagai string "".
    if (typeof text !== "string" || text.trim() === "") {
      // finish_reason "length" + konten kosong punya satu sebab spesifik pada
      // model reasoning: token penalaran menghabiskan max_tokens sebelum
      // jawaban mulai ditulis. Sebutkan itu — "respons kosong" saja membuat
      // orang mencari kesalahan di prompt atau kredensial, bukan di batas token.
      const exhausted = choice?.finish_reason === "length";
      throw new AIServiceError(
        exhausted
          ? `Batas ${maxOutputTokens} token habis sebelum model mulai menjawab. ` +
            `Ini khas model reasoning: token penalaran ikut dihitung. ` +
            `Naikkan batasnya, atau pakai model non-reasoning lewat CLOUDFLARE_AI_MODEL.`
          : "Workers AI mengembalikan respons kosong.",
        "invalid_response",
        payload
      );
    }

    return {
      text,
      metadata: {
        model: modelName,
        usage: payload.usage,
      },
    };
  }
}
