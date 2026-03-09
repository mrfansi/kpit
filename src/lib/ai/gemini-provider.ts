import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIService, AIGenerateOptions, AIGenerateResult } from "./types";
import { AIServiceError } from "./types";

const DEFAULT_MODEL = "gemini-3.1-flash-lite-preview";

export class GeminiProvider implements AIService {
  private readonly client: GoogleGenerativeAI;
  private readonly defaultModel: string;

  constructor(apiKey: string, defaultModel?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.defaultModel = defaultModel ?? DEFAULT_MODEL;
  }

  async generateText(
    prompt: string,
    options?: AIGenerateOptions
  ): Promise<AIGenerateResult> {
    const modelName = options?.model ?? this.defaultModel;

    try {
      const model = this.client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: options?.maxOutputTokens,
          temperature: options?.temperature,
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return {
        text,
        metadata: {
          model: modelName,
        },
      };
    } catch (error) {
      throw new AIServiceError(
        "Gagal menghasilkan teks dari Gemini.",
        "provider_error",
        error
      );
    }
  }
}
