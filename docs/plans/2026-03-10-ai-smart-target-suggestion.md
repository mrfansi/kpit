# AI Smart Target Suggestion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Suggest Target" button in the KPI target form that uses AI to recommend an optimal target based on historical performance data.

**Architecture:** API route receives KPI metadata + historical values + past targets and achievement rates, calls AI service with structured output instruction, returns suggested target number + reasoning + confidence level. Client button next to target field shows suggestion card.

**Tech Stack:** AI service abstraction (`src/lib/ai`), Next.js API routes, React client component

**Depends on:** Feature 1 (AI Service Abstraction Layer) must be completed first.

---

### Task 1: Create API route for target suggestion

**Files:**
- Create: `src/app/api/kpi/suggest-target/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { auth } from "@/auth";

interface HistoricalData {
  periodDate: string;
  value: number;
  target: number;
  achievementPct: number;
}

interface SuggestTargetRequest {
  name: string;
  unit: string;
  direction: string;
  currentTarget: number;
  thresholdGreen: number;
  thresholdYellow: number;
  history: HistoricalData[];
}

export async function POST(request: NextRequest) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  // Admin-only check
  const fullSession = await auth();
  if (fullSession?.user?.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa menggunakan fitur ini." },
      { status: 403 }
    );
  }

  let body: SuggestTargetRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json(
      { error: "Nama KPI harus diisi." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.history) || body.history.length < 3) {
    return NextResponse.json(
      { error: "Minimal 3 periode data historis diperlukan untuk saran target." },
      { status: 400 }
    );
  }

  const name = sanitizeInput(body.name, 100);
  const unit = sanitizeInput(body.unit || "", 50);

  const directionText =
    body.direction === "lower_better"
      ? "semakin rendah semakin baik"
      : "semakin tinggi semakin baik";

  const historyText = body.history
    .slice(-12)
    .map(
      (h) =>
        `- ${h.periodDate}: aktual ${h.value}, target ${h.target}, pencapaian ${h.achievementPct}%`
    )
    .join("\n");

  const avgAchievement =
    body.history.reduce((sum, h) => sum + h.achievementPct, 0) /
    body.history.length;

  const prompt = `Kamu adalah analis KPI senior. Berikan saran target untuk periode berikutnya.

KPI: ${name}
Satuan: ${unit}
Arah: ${directionText}
Target saat ini: ${body.currentTarget} ${unit}
Threshold hijau: ${body.thresholdGreen}
Threshold kuning: ${body.thresholdYellow}
Rata-rata pencapaian: ${avgAchievement.toFixed(1)}%

Data historis:
${historyText}

Instruksi:
- Jawab HANYA dalam format JSON berikut, tanpa teks lain:
{
  "suggestedTarget": <angka target yang disarankan>,
  "reasoning": "<1-2 kalimat penjelasan dalam Bahasa Indonesia>",
  "confidence": "<low|medium|high>"
}

Aturan penentuan target:
- Jika rata-rata pencapaian >110%, target bisa dinaikkan
- Jika rata-rata pencapaian <80%, target mungkin terlalu ambisius
- Pertimbangkan tren (naik/turun/stabil) dalam 3-6 bulan terakhir
- Target harus realistis tapi menantang (achievable stretch)
- Confidence "high" jika data >6 bulan dan tren konsisten
- Confidence "medium" jika data 3-6 bulan
- Confidence "low" jika data <3 bulan atau tren tidak konsisten`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt, { temperature: 0.3 });
    const cleaned = cleanAIOutput(result.text);

    // Extract JSON from response (model might wrap in ```json blocks)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI tidak menghasilkan format yang valid. Coba lagi." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate response structure
    if (
      typeof parsed.suggestedTarget !== "number" ||
      typeof parsed.reasoning !== "string" ||
      !["low", "medium", "high"].includes(parsed.confidence)
    ) {
      return NextResponse.json(
        { error: "AI response format tidak valid. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      suggestedTarget: parsed.suggestedTarget,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI response tidak bisa diparse. Coba lagi." },
        { status: 500 }
      );
    }
    return handleAIError(error);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/kpi/suggest-target/route.ts
git commit -m "feat(kpi): add API route for AI smart target suggestion"
```

---

### Task 2: Create client component for target suggestion

**Files:**
- Create: `src/components/kpi-target-suggestion.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface TargetSuggestion {
  suggestedTarget: number;
  reasoning: string;
  confidence: "low" | "medium" | "high";
}

interface KPITargetSuggestionProps {
  kpiName: string;
  unit: string;
  direction: string;
  currentTarget: number;
  thresholdGreen: number;
  thresholdYellow: number;
  history: {
    periodDate: string;
    value: number;
    target: number;
    achievementPct: number;
  }[];
  onApply: (target: number) => void;
}

const confidenceColors = {
  low: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-green-100 text-green-700",
};

const confidenceLabels = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
};

export function KPITargetSuggestion({
  kpiName,
  unit,
  direction,
  currentTarget,
  thresholdGreen,
  thresholdYellow,
  history,
  onApply,
}: KPITargetSuggestionProps) {
  const [suggestion, setSuggestion] = useState<TargetSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEnoughData = history.length >= 3;

  async function handleSuggest() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/kpi/suggest-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: kpiName,
          unit,
          direction,
          currentTarget,
          thresholdGreen,
          thresholdYellow,
          history,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal mendapatkan saran target");
      }

      const data = await res.json();
      setSuggestion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSuggest}
        disabled={loading || !hasEnoughData}
        className="text-xs"
      >
        {loading ? (
          <>
            <span
              className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-1"
              aria-hidden="true"
            />
            Menganalisis...
          </>
        ) : (
          "Suggest Target"
        )}
      </Button>

      {!hasEnoughData && (
        <p className="text-xs text-gray-400">Minimal 3 periode data.</p>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {suggestion && (
        <div className="p-3 bg-blue-50 rounded border border-blue-200 text-sm max-w-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold">
              {suggestion.suggestedTarget} {unit}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${confidenceColors[suggestion.confidence]}`}
            >
              Confidence: {confidenceLabels[suggestion.confidence]}
            </span>
          </div>
          <p className="text-xs text-gray-600 mb-2">{suggestion.reasoning}</p>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onApply(suggestion.suggestedTarget)}
            className="text-xs"
          >
            Terapkan
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/kpi-target-suggestion.tsx
git commit -m "feat(kpi): add AI target suggestion client component"
```

---

### Task 3: Integrate target suggestion into target management

**Files:**
- Modify: The admin page or component where KPI targets are edited (check `src/app/admin/kpi/[id]/edit/page.tsx` or the target editing form)

**Step 1: Import and wire the component**

Import `KPITargetSuggestion` and place next to the target field. Pass `onApply` callback that sets the form target value via `form.setValue("target", value, { shouldDirty: true })`.

**Step 2: Fetch historical data for the suggestion**

Query `getKPIEntries(kpiId)` and `getKPITargets(kpiId)` to build the history array with value, target, and achievement percentage for each period.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/admin/kpi/[id]/edit/page.tsx
git commit -m "feat(kpi): integrate AI target suggestion into KPI edit form"
```
