# AI Service Abstraction Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a shared AI service abstraction so all AI features use one consistent interface, with Gemini as the current provider and easy switching later.

**Architecture:** Interface `AIService` with `generateText()` method. `GeminiProvider` implements it. Factory `getAIService()` returns singleton. Shared sanitization and output cleaning utilities. Existing API routes refactored to use the abstraction.

**Tech Stack:** @google/generative-ai (already installed), TypeScript interfaces

---

### Task 1: Create AI service types and interface

**Files:**
- Create: `src/lib/ai/types.ts`

**Step 1: Create the types file**

```typescript
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
  generateText(prompt: string, options?: AIGenerateOptions): Promise<AIGenerateResult>;
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
```

**Step 2: Commit**

```bash
git add src/lib/ai/types.ts
git commit -m "feat(ai): add AIService interface and types"
```

---

### Task 2: Create sanitization utilities

**Files:**
- Create: `src/lib/ai/sanitize.ts`

**Step 1: Create the sanitize module**

These utilities are currently duplicated across `generate-description/route.ts` (line 17-19) and `narrative/route.ts` (line 86-89). Extract them into a shared module.

```typescript
/**
 * Sanitize user input before interpolating into AI prompts.
 * Strips newlines and limits length to prevent prompt injection.
 */
export function sanitizeInput(input: string, maxLength: number): string {
  return input.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

/**
 * Clean AI output: strip markdown formatting and common prefix patterns.
 */
export function cleanAIOutput(text: string): string {
  let cleaned = text;

  // Strip markdown bold/italic asterisks
  cleaned = cleaned.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");

  // Strip markdown headers
  cleaned = cleaned.replace(/^#{1,3}\s+/gm, "");

  // Remove common meta-text opening patterns (Indonesian)
  cleaned = cleaned.replace(
    /^(Berikut|Di bawah ini|Ini adalah|Deskripsi\s*:|KPI ini\s+|Indikator ini\s+)[^\n]*:?\s*\n*/i,
    ""
  );

  return cleaned.trim();
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/sanitize.ts
git commit -m "feat(ai): add shared sanitization and output cleaning utilities"
```

---

### Task 3: Create Gemini provider

**Files:**
- Create: `src/lib/ai/gemini-provider.ts`

**Step 1: Create the Gemini provider**

This wraps the existing `@google/generative-ai` SDK usage from `generate-description/route.ts` (lines 109-113) and `narrative/route.ts` (lines 80-82) into the `AIService` interface.

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIService, AIGenerateOptions, AIGenerateResult } from "./types";
import { AIServiceError } from "./types";

const DEFAULT_MODEL = "gemini-2.0-flash-lite";

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
```

**Step 2: Commit**

```bash
git add src/lib/ai/gemini-provider.ts
git commit -m "feat(ai): add Gemini provider implementing AIService interface"
```

---

### Task 4: Create factory and barrel export

**Files:**
- Create: `src/lib/ai/index.ts`

**Step 1: Create the factory and exports**

The factory creates a singleton `AIService` instance. If no API key is configured, it throws `AIServiceError` with code `"no_api_key"` so callers can return appropriate HTTP responses.

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/ai/index.ts
git commit -m "feat(ai): add factory function and barrel exports for AI service"
```

---

### Task 5: Create shared API error handler

**Files:**
- Create: `src/lib/ai/api-helpers.ts`

**Step 1: Create the API helper**

Both existing routes have identical auth check + API key check + try/catch error handling patterns. Extract these into a reusable helper.

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AIServiceError } from "./types";

/**
 * Check auth and return session. Returns NextResponse error if unauthorized.
 */
export async function requireAuth(): Promise<
  | { session: Awaited<ReturnType<typeof auth>>; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await auth();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/**
 * Convert AIServiceError to appropriate NextResponse.
 */
export function handleAIError(error: unknown): NextResponse {
  if (error instanceof AIServiceError) {
    if (error.code === "no_api_key") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.error("Unexpected AI error:", error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada layanan AI." },
    { status: 500 }
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/api-helpers.ts
git commit -m "feat(ai): add shared auth check and error handling helpers"
```

---

### Task 6: Refactor KPI description generator to use abstraction

**Files:**
- Modify: `src/app/api/kpi/generate-description/route.ts`

**Step 1: Refactor the route**

Replace direct `GoogleGenerativeAI` usage with `getAIService()`, `sanitizeInput()`, `cleanAIOutput()`, and `handleAIError()`. The route should no longer import `@google/generative-ai` directly.

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getAIService,
  sanitizeInput,
  cleanAIOutput,
  AIServiceError,
} from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

const MAX_DESCRIPTION_LENGTH = 200;

const VALID_DIRECTIONS = ["higher_better", "lower_better"] as const;

interface GenerateDescriptionRequest {
  name: string;
  unit: string;
  target: number;
  direction: string;
  domain: string;
}

export async function POST(request: NextRequest) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  let body: GenerateDescriptionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (
    typeof body.name !== "string" ||
    typeof body.unit !== "string" ||
    typeof body.direction !== "string" ||
    typeof body.domain !== "string"
  ) {
    return NextResponse.json(
      { error: "Field name, unit, direction, dan domain harus berupa string." },
      { status: 400 }
    );
  }

  if (!body.name || body.name.trim().length < 3) {
    return NextResponse.json(
      { error: "Nama KPI harus minimal 3 karakter." },
      { status: 400 }
    );
  }

  if (
    !VALID_DIRECTIONS.includes(
      body.direction as (typeof VALID_DIRECTIONS)[number]
    )
  ) {
    return NextResponse.json(
      { error: "Direction harus 'higher_better' atau 'lower_better'." },
      { status: 400 }
    );
  }

  if (!body.unit.trim() || !body.domain.trim()) {
    return NextResponse.json(
      { error: "Field unit dan domain tidak boleh kosong." },
      { status: 400 }
    );
  }

  if (typeof body.target !== "number" || !isFinite(body.target)) {
    return NextResponse.json(
      { error: "Target harus berupa angka yang valid." },
      { status: 400 }
    );
  }

  const name = sanitizeInput(body.name, 100);
  const unit = sanitizeInput(body.unit, 50);
  const domain = sanitizeInput(body.domain, 100);

  const directionText =
    body.direction === "lower_better"
      ? "semakin rendah semakin baik"
      : "semakin tinggi semakin baik";

  const prompt = `Tulis 1 kalimat deskripsi singkat dalam Bahasa Indonesia untuk KPI berikut. Maksimal ${MAX_DESCRIPTION_LENGTH} karakter.

Nama KPI: ${name}
Domain: ${domain}
Satuan: ${unit}
Target: ${body.target}
Arah: ${directionText}

Instruksi:
- Langsung tulis deskripsinya, JANGAN buka dengan label seperti "Deskripsi:" atau "KPI ini"
- Hanya 1 kalimat, padat dan jelas
- Jangan gunakan markdown formatting (bold, italic, asterisks)
- Maksimal ${MAX_DESCRIPTION_LENGTH} karakter`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text).slice(0, MAX_DESCRIPTION_LENGTH);

    return NextResponse.json({ description: text });
  } catch (error) {
    return handleAIError(error);
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/kpi/generate-description/route.ts
git commit -m "refactor(kpi): use AI service abstraction for description generator"
```

---

### Task 7: Refactor narrative route to use abstraction

**Files:**
- Modify: `src/app/api/report/narrative/route.ts`

**Step 1: Refactor the route**

Replace direct `GoogleGenerativeAI` usage with `getAIService()`, `cleanAIOutput()`, and `handleAIError()`.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAIService, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

interface KPIDataItem {
  name: string;
  description: string;
  domain: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  momDelta: string;
  prevValue: string;
  direction: string;
}

interface NarrativeRequest {
  period: string;
  healthScore: number;
  healthDelta: number | null;
  improved: number;
  declined: number;
  stable: number;
  avgAchievement: number | null;
  domains: { name: string; description: string }[];
  kpis: KPIDataItem[];
}

export async function POST(request: NextRequest) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const body: NarrativeRequest = await request.json();

  const kpiSummary = body.kpis
    .map(
      (k) =>
        `- ${k.name} [${k.domain}]${k.description ? ` (${k.description})` : ""}: aktual ${k.actual}, target ${k.target}, pencapaian ${k.achievement}, status ${k.status}, perubahan ${k.momDelta} (sebelumnya ${k.prevValue}), arah: ${k.direction}`
    )
    .join("\n");

  const healthDeltaText =
    body.healthDelta !== null
      ? ` (perubahan ${body.healthDelta > 0 ? "+" : ""}${body.healthDelta}% dari bulan lalu)`
      : "";

  const prompt = `Kamu adalah analis KPI senior. Tulis narasi ringkasan eksekutif dalam Bahasa Indonesia untuk laporan KPI periode ${body.period}.

Data:
- Health Score: ${body.healthScore}%${healthDeltaText}
- Pergerakan status: ${body.improved} naik, ${body.declined} turun, ${body.stable} tetap
- Rata-rata pencapaian: ${body.avgAchievement ?? "N/A"}%

Detail KPI:
${kpiSummary}

Instruksi:
- Langsung tulis narasinya, JANGAN buka dengan kalimat pengantar seperti "Berikut adalah..."
- Tulis tepat 3 paragraf pendek (masing-masing 2-3 kalimat saja)
- Paragraf 1: Gambaran umum performa bulan ini
- Paragraf 2: Sorot KPI yang memburuk dan jelaskan dampaknya
- Paragraf 3: Satu rekomendasi tindakan prioritas
- Gunakan bahasa yang mudah dipahami oleh eksekutif non-teknis
- Jangan mengulang angka mentah, fokus pada insight dan konteks
- Jangan gunakan markdown formatting (bold, italic, asterisks)
- Jangan gunakan bullet points, tulis dalam paragraf naratif`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text);

    return NextResponse.json({ narrative: text });
  } catch (error) {
    return handleAIError(error);
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/report/narrative/route.ts
git commit -m "refactor(report): use AI service abstraction for narrative generator"
```

---

### Task 8: Verify and final cleanup

**Step 1: Verify no direct @google/generative-ai imports remain in routes**

```bash
grep -r "from \"@google/generative-ai\"" src/app/
```

Expected: No results (only `src/lib/ai/gemini-provider.ts` should import it).

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Run dev server and manually test**

```bash
npm run dev
```

Verify:
- `/admin/kpi/new` → Generate description still works
- `/report/all` → Generate narrative still works

**Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix(ai): address issues from abstraction layer review"
```
