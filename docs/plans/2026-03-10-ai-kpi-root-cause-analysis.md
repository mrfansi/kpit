# AI KPI Root Cause Analysis — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Analisis AI" button to the KPI detail page that generates a root cause analysis explaining why a KPI is trending up or down, with recommendations.

**Architecture:** API route receives KPI metadata + 6-12 months of historical data + sibling KPIs in same domain, constructs analysis prompt, calls AI service, returns 2-3 paragraph analysis. Client component renders the analysis in an expandable card below the KPI chart.

**Tech Stack:** AI service abstraction (`src/lib/ai`), Next.js API routes, React client component

**Depends on:** Feature 1 (AI Service Abstraction Layer) must be completed first.

---

### Task 1: Create API route for KPI analysis

**Files:**
- Create: `src/app/api/kpi/analyze/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

interface HistoryEntry {
  periodDate: string;
  value: number;
  target: number;
  achievement: string;
}

interface SiblingKPI {
  name: string;
  status: string;
  achievement: string;
  trend: string;
}

interface AnalyzeRequest {
  name: string;
  description: string;
  domain: string;
  unit: string;
  direction: string;
  history: HistoryEntry[];
  siblings: SiblingKPI[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  let body: AnalyzeRequest;
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

  if (!Array.isArray(body.history) || body.history.length < 2) {
    return NextResponse.json(
      { error: "Minimal 2 periode data historis diperlukan untuk analisis." },
      { status: 400 }
    );
  }

  const name = sanitizeInput(body.name, 100);
  const domain = sanitizeInput(body.domain || "Umum", 100);
  const description = sanitizeInput(body.description || "", 200);
  const unit = sanitizeInput(body.unit || "", 50);

  const directionText =
    body.direction === "lower_better"
      ? "semakin rendah semakin baik"
      : "semakin tinggi semakin baik";

  const historyText = body.history
    .slice(-12)
    .map(
      (h) =>
        `- ${h.periodDate}: aktual ${h.value} ${unit}, target ${h.target} ${unit}, pencapaian ${h.achievement}`
    )
    .join("\n");

  const siblingsText =
    body.siblings.length > 0
      ? body.siblings
          .map(
            (s) =>
              `- ${s.name}: status ${s.status}, pencapaian ${s.achievement}, tren ${s.trend}`
          )
          .join("\n")
      : "Tidak ada KPI lain di domain ini.";

  const prompt = `Kamu adalah analis KPI senior. Analisis KPI berikut dan jelaskan penyebab tren yang terlihat.

KPI: ${name}
${description ? `Deskripsi: ${description}\n` : ""}Domain: ${domain}
Satuan: ${unit}
Arah: ${directionText}

Data historis (terbaru di bawah):
${historyText}

KPI lain di domain ${domain}:
${siblingsText}

Instruksi:
- Langsung tulis analisisnya, tanpa kalimat pengantar
- Tulis tepat 3 paragraf pendek (masing-masing 2-3 kalimat)
- Paragraf 1: Apa tren utama yang terlihat dari data
- Paragraf 2: Kemungkinan penyebab berdasarkan pola data dan konteks domain
- Paragraf 3: Satu rekomendasi tindakan yang spesifik dan actionable
- Jika ada korelasi dengan KPI lain di domain, sebutkan
- Bahasa mudah dipahami, fokus insight bukan angka mentah
- Jangan gunakan markdown formatting atau bullet points`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text);

    return NextResponse.json({ analysis: text });
  } catch (error) {
    return handleAIError(error);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/kpi/analyze/route.ts
git commit -m "feat(kpi): add API route for AI root cause analysis"
```

---

### Task 2: Create client component for KPI analysis

**Files:**
- Create: `src/components/kpi-ai-analysis.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface HistoryEntry {
  periodDate: string;
  value: number;
  target: number;
  achievement: string;
}

interface SiblingKPI {
  name: string;
  status: string;
  achievement: string;
  trend: string;
}

interface KPIAIAnalysisProps {
  requestData: {
    name: string;
    description: string;
    domain: string;
    unit: string;
    direction: string;
    history: HistoryEntry[];
    siblings: SiblingKPI[];
  };
}

export function KPIAIAnalysis({ requestData }: KPIAIAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const hasEnoughData = requestData.history.length >= 2;

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/kpi/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghasilkan analisis");
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">Analisis AI</h3>
        <div className="flex items-center gap-2">
          {analysis && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {expanded ? "Tutup" : "Buka"}
            </button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={loading || !hasEnoughData}
            className="print:hidden text-xs"
          >
            {loading ? (
              <>
                <span
                  className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-1"
                  aria-hidden="true"
                />
                Menganalisis...
              </>
            ) : analysis ? (
              "Regenerate"
            ) : (
              "Analisis AI"
            )}
          </Button>
        </div>
      </div>

      {!hasEnoughData && (
        <p className="text-xs text-gray-400">
          Minimal 2 periode data diperlukan untuk analisis.
        </p>
      )}

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {analysis && expanded && (
        <div className="text-sm text-gray-700 space-y-2">
          {analysis
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          <p className="text-xs text-gray-400 mt-2 print:hidden">
            Dihasilkan oleh AI — verifikasi data sebelum mengambil keputusan
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/kpi-ai-analysis.tsx
git commit -m "feat(kpi): add AI root cause analysis client component"
```

---

### Task 3: Integrate AI analysis into KPI detail page

**Files:**
- Modify: `src/app/kpi/[id]/page.tsx`

**Step 1: Import the component**

```typescript
import { KPIAIAnalysis } from "@/components/kpi-ai-analysis";
```

**Step 2: Build request data**

After existing data fetching (entries, targets, domain info), build the analysis request data. Use the existing `entries` array (from `getKPIEntries`) and `getKPIsWithLatestEntry` for siblings.

```typescript
// Fetch sibling KPIs in same domain
const siblingKPIs = await getKPIsWithLatestEntry(kpi.domainId);

// Build AI analysis request data
const analysisRequestData = {
  name: kpi.name,
  description: kpi.description || "",
  domain: domain?.name || "Umum",
  unit: kpi.unit,
  direction: kpi.direction,
  history: entries.map((e) => {
    const tgt = getEffectiveTarget(kpi, e.periodDate);
    const pct = getAchievementPct(e.value, tgt.target, kpi.direction);
    return {
      periodDate: e.periodDate,
      value: e.value,
      target: tgt.target,
      achievement: pct !== null ? `${pct}%` : "N/A",
    };
  }),
  siblings: siblingKPIs
    .filter(({ kpi: s }) => s.id !== kpi.id)
    .map(({ kpi: s, latestEntry, effectiveTarget }) => {
      const status = getKPIStatus(latestEntry?.value, { ...s, ...effectiveTarget });
      const tgt = effectiveTarget ?? { target: s.target };
      const pct = latestEntry
        ? getAchievementPct(latestEntry.value, tgt.target, s.direction)
        : null;
      return {
        name: s.name,
        status: statusConfig[status].label,
        achievement: pct !== null ? `${pct}%` : "N/A",
        trend: "stabil",
      };
    }),
};
```

**Step 3: Add component to page JSX**

Place below the main chart section:

```tsx
<KPIAIAnalysis requestData={analysisRequestData} />
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/kpi/[id]/page.tsx
git commit -m "feat(kpi): integrate AI root cause analysis into KPI detail page"
```
