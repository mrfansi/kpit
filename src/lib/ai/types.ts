export interface AIGenerateOptions {
  /** Max tokens in response. Provider maps this to their own param. */
  maxOutputTokens?: number;
  /** Temperature 0-1. Lower = more deterministic. */
  temperature?: number;
  /** Model override. If not set, provider uses its default. */
  model?: string;
}

export interface AIGenerateResult {
  text: string;
  /** Provider-specific metadata (token counts, etc.) */
  metadata?: Record<string, unknown>;
}

export interface AIService {
  /**
   * Generate text from a prompt.
   * @throws AIServiceError on failure
   */
  generateText(
    prompt: string,
    options?: AIGenerateOptions
  ): Promise<AIGenerateResult>;
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "no_api_key" | "provider_error" | "invalid_response",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}
