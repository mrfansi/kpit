import { GeminiProvider } from "./gemini-provider";
import type { AIService } from "./types";
import { AIServiceError } from "./types";

export type { AIService, AIGenerateOptions, AIGenerateResult } from "./types";
export { AIServiceError } from "./types";
export { sanitizeInput, cleanAIOutput } from "./sanitize";

let instance: AIService | null = null;

/**
 * Get the AI service singleton.
 * @throws AIServiceError with code "no_api_key" if GOOGLE_AI_API_KEY is not set.
 */
export function getAIService(): AIService {
  if (instance) return instance;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new AIServiceError(
      "AI tidak tersedia. GOOGLE_AI_API_KEY belum dikonfigurasi.",
      "no_api_key"
    );
  }

  instance = new GeminiProvider(apiKey);
  return instance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetAIService(): void {
  instance = null;
}
