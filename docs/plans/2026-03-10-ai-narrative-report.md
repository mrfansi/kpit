# AI Narrative Report — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add on-demand AI narrative generation to the executive report, replacing the static summary with insightful Gemini Flash 2.0 analysis.

**Architecture:** API route receives structured KPI data, constructs a prompt, calls Gemini Flash 2.0, returns narrative text. Client component handles the button interaction and replaces the static summary. Static summary stays as fallback.

**Tech Stack:** @google/generative-ai (Gemini SDK), Next.js API routes, React client component

---

### Task 1: Install Gemini SDK and add env variable

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env.local`

**Step 1: Install the SDK**

```bash
npm install @google/generative-ai
```

**Step 2: Add env variable to `.env.example`**

Add after `NOTIFY_WEBHOOK_URL`:

```
# Optional: Google AI API key for AI narrative in executive report
# Get from: https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=
```

**Step 3: Add the actual key to `.env.local`**

```
GOOGLE_AI_API_KEY=<your-key>
```

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add Gemini AI SDK and env variable for AI narrative"
```

---

### Task 2: Create API route for narrative generation

**Files:**
- Create: `src/app/api/report/narrative/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/lib/auth";

interface KPIDataItem {
  name: string;
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
  kpis: KPIDataItem[];
}

export async function POST(request: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI tidak tersedia. GOOGLE_AI_API_KEY belum dikonfigurasi." },
      { status: 503 }
    );
  }

  const body: NarrativeRequest = await request.json();

  const kpiSummary = body.kpis
    .map((k) => `- ${k.name}: aktual ${k.actual}, target ${k.target}, pencapaian ${k.achievement}, status ${k.status}, perubahan ${k.momDelta} (sebelumnya ${k.prevValue}), arah: ${k.direction}`)
    .join("\n");

  const prompt = `Kamu adalah analis KPI senior. Tulis narasi ringkasan eksekutif dalam Bahasa Indonesia untuk laporan KPI periode ${body.period}.

Data:
- Health Score: ${body.healthScore}%${body.healthDelta !== null ? ` (perubahan ${body.healthDelta > 0 ? "+" : ""}${body.healthDelta}% dari bulan lalu)` : ""}
- Pergerakan status: ${body.improved} naik, ${body.declined} turun, ${body.stable} tetap
- Rata-rata pencapaian: ${body.avgAchievement ?? "N/A"}%

Detail KPI:
${kpiSummary}

Instruksi:
- Tulis 2-3 paragraf ringkas
- Paragraf 1: Gambaran umum performa bulan ini
- Paragraf 2: Sorot KPI yang memburuk dan jelaskan dampaknya
- Paragraf 3: Rekomendasi tindakan yang perlu diambil
- Gunakan bahasa yang mudah dipahami oleh eksekutif non-teknis
- Jangan mengulang angka mentah, fokus pada insight dan konteks
- Jangan gunakan bullet points, tulis dalam paragraf naratif`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ narrative: text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Gagal menghasilkan narasi. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/report/narrative/route.ts
git commit -m "feat(report): add API route for AI narrative generation via Gemini"
```

---

### Task 3: Create client component for AI narrative section

**Files:**
- Create: `src/components/report/report-ai-narrative.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";

interface KPIDataItem {
  name: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  momDelta: string;
  prevValue: string;
  direction: string;
}

interface ReportAINarrativeProps {
  staticSummary: string;
  requestData: {
    period: string;
    healthScore: number;
    healthDelta: number | null;
    improved: number;
    declined: number;
    stable: number;
    avgAchievement: number | null;
    kpis: KPIDataItem[];
  };
}

export function ReportAINarrative({ staticSummary, requestData }: ReportAINarrativeProps) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/report/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghasilkan narasi");
      }

      const data = await res.json();
      setNarrative(data.narrative);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Ringkasan</h2>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="print:hidden text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Menganalisis...
            </>
          ) : narrative ? (
            "Regenerate"
          ) : (
            "\u2728 Generate Analisis AI"
          )}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-xs mb-2">{error}</p>
      )}

      {narrative ? (
        <div className="text-sm text-gray-700 space-y-2">
          {narrative.split("\n\n").filter(Boolean).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <p className="text-xs text-gray-400 mt-2 print:hidden">Dihasilkan oleh AI — verifikasi data sebelum mengambil keputusan</p>
        </div>
      ) : (
        <p className="text-sm text-gray-700">{staticSummary}</p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/report/report-ai-narrative.tsx
git commit -m "feat(report): add AI narrative client component with generate button"
```

---

### Task 4: Integrate AI narrative into executive report page

**Files:**
- Modify: `src/app/report/all/page.tsx`

**Step 1: Import the new component**

Add to imports:

```typescript
import { ReportAINarrative } from "@/components/report/report-ai-narrative";
```

**Step 2: Build request data for AI**

After `executiveSummary` calculation (around line where `const executiveSummary = summaryParts.join(". ") + "."` is), add:

```typescript
  // Build AI narrative request data
  const aiRequestData = {
    period: periodLabel,
    healthScore: healthPct,
    healthDelta,
    improved,
    declined,
    stable,
    avgAchievement,
    kpis: allKPIsWithEntries.map(({ kpi, latestEntry, effectiveTarget }) => {
      const comparison = comparisonMap.get(kpi.id);
      const prevEntry = comparison?.prevMonth ?? null;
      const tgt = effectiveTarget ?? { target: kpi.target };
      const pct = getAchievementPct(latestEntry?.value, tgt.target, kpi.direction);
      const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
      return {
        name: kpi.name,
        actual: latestEntry ? formatValue(latestEntry.value, kpi.unit) : "N/A",
        target: formatValue(tgt.target, kpi.unit),
        achievement: pct !== null ? `${pct}%` : "N/A",
        status: statusConfig[status].label,
        momDelta: prevEntry && latestEntry
          ? `${((latestEntry.value - prevEntry.value) / (prevEntry.value || 1) * 100).toFixed(1)}%`
          : "N/A",
        prevValue: prevEntry ? formatValue(prevEntry.value, kpi.unit) : "N/A",
        direction: kpi.direction === "lower_better" ? "semakin rendah semakin baik" : "semakin tinggi semakin baik",
      };
    }),
  };
```

**Step 3: Replace static summary with AI narrative component**

Replace the existing static summary `<div>`:

```tsx
{/* Old code to remove: */}
<div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
  <h2 className="font-bold text-sm mb-1">Ringkasan</h2>
  <p className="text-sm text-gray-700">{executiveSummary}</p>
</div>
```

Replace with:

```tsx
<ReportAINarrative staticSummary={executiveSummary} requestData={aiRequestData} />
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/report/all/page.tsx
git commit -m "feat(report): integrate AI narrative component into executive report"
```

---

### Task 5: Add env variable to .env.example and verify

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Navigate to `/report/all`**

Verify:
- Static summary displays by default
- "Generate Analisis AI" button appears (print-hidden)
- Clicking button shows loading spinner
- Narrative replaces static summary
- "Regenerate" button appears after generation
- Error displays gracefully if API key missing
- Print shows narrative (if generated) or static summary

**Step 3: Test error handling**

Temporarily remove `GOOGLE_AI_API_KEY` from `.env.local`, restart dev server, click generate. Should show "AI tidak tersedia" error.

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(report): address issues from AI narrative review"
```
