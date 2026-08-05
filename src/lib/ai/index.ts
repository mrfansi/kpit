import { WorkersAIProvider } from "./workers-ai-provider";
import type { AIService } from "./types";
import { AIServiceError } from "./types";

export type { AIService, AIGenerateOptions, AIGenerateResult } from "./types";
export { AIServiceError } from "./types";
export { sanitizeInput, cleanAIOutput } from "./sanitize";

let instance: AIService | null = null;

/**
 * Get the AI service singleton.
 * @throws AIServiceError with code "no_api_key" if Workers AI credentials are missing.
 */
export function getAIService(): AIService {
  if (instance) return instance;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  // Keduanya wajib, dan yang hilang disebutkan namanya: pesan "kredensial belum
  // lengkap" mengirim orang membaca ulang seluruh .env untuk menemukan satu
  // baris yang salah.
  const missing = [
    !accountId && "CLOUDFLARE_ACCOUNT_ID",
    !apiToken && "CLOUDFLARE_API_TOKEN",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new AIServiceError(
      `AI tidak tersedia. ${missing.join(" dan ")} belum dikonfigurasi.`,
      "no_api_key"
    );
  }

  instance = new WorkersAIProvider(
    accountId!,
    apiToken!,
    process.env.CLOUDFLARE_AI_MODEL
  );
  return instance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetAIService(): void {
  instance = null;
}
