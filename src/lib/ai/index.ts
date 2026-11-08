import { DeepSeekProvider } from "./deepseek-provider";
import type { AIService } from "./types";
import { AIServiceError } from "./types";

export type { AIService, AIGenerateOptions, AIGenerateResult } from "./types";
export { AIServiceError } from "./types";
export { sanitizeInput, cleanAIOutput } from "./sanitize";

let instance: AIService | null = null;

/**
 * Get the AI service singleton.
 * @throws AIServiceError with code "no_api_key" if DEEPSEEK_API_KEY is missing.
 */
export function getAIService(): AIService {
  if (instance) return instance;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new AIServiceError("AI tidak tersedia. DEEPSEEK_API_KEY belum dikonfigurasi.", "no_api_key");
  }

  instance = new DeepSeekProvider(apiKey, process.env.DEEPSEEK_MODEL);
  return instance;
}
