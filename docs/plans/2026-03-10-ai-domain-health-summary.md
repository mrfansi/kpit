# AI Domain Health Summary — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Generate Summary" button to the domain page that uses Gemini to generate a narrative health summary for all KPIs in that domain.

**Architecture:** API route receives domain name + KPI data, constructs prompt, calls AI service, returns 2-paragraph summary. Client component wraps the summary section with a generate button. Server page passes pre-computed KPI data to the client component.

**Tech Stack:** AI service abstraction (`src/lib/ai`), Next.js API routes, React client component

**Depends on:** Feature 1 (AI Service Abstraction Layer) must be completed first.

---

### Task 1: Create API route for domain summary

**Files:**
- Create: `src/app/api/domain/summary/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

interface DomainKPIItem {
  name: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  trend: string;
}

interface DomainSummaryRequest {
  domainName: string;
  domainDescription: string;
  period: string;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  noDataCount: number;
  kpis: DomainKPIItem[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  let body: DomainSummaryRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!body.domainName || typeof body.domainName !== "string") {
    return NextResponse.json(
      { error: "Nama domain harus diisi." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.kpis) || body.kpis.length === 0) {
    return NextResponse.json(
      { error: "Data KPI tidak boleh kosong." },
      { status: 400 }
    );
  }

  const domainName = sanitizeInput(body.domainName, 100);
  const domainDesc = sanitizeInput(body.domainDescription || "", 200);

  const kpiList = body.kpis
    .map(
      (k) =>
        `- ${k.name}: aktual ${k.actual}, target ${k.target}, pencapaian ${k.achievement}, status ${k.status}, tren ${k.trend}`
    )
    .join("\n");

  const prompt = `Kamu adalah analis KPI senior. Tulis ringkasan performa domain "${domainName}" periode ${body.period} dalam Bahasa Indonesia.

${domainDesc ? `Deskripsi domain: ${domainDesc}\n` : ""}
Statistik:
- KPI sehat (hijau): ${body.healthyCount}
- KPI perlu perhatian (kuning): ${body.warningCount}
- KPI kritis (merah): ${body.criticalCount}
- KPI belum ada data: ${body.noDataCount}

Detail KPI:
${kpiList}

Instruksi:
- Langsung tulis narasinya, tanpa kalimat pengantar
- Tulis tepat 2 paragraf pendek (masing-masing 2-3 kalimat)
- Paragraf 1: Performa keseluruhan domain ini
- Paragraf 2: KPI yang perlu perhatian dan saran spesifik
- Bahasa mudah dipahami eksekutif non-teknis
- Fokus pada insight, bukan mengulang angka
- Jangan gunakan markdown formatting atau bullet points`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt);
    const text = cleanAIOutput(result.text);

    return NextResponse.json({ summary: text });
  } catch (error) {
    return handleAIError(error);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/domain/summary/route.ts
git commit -m "feat(domain): add API route for AI domain health summary"
```

---

### Task 2: Create client component for domain AI summary

**Files:**
- Create: `src/components/domain/domain-ai-summary.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DomainKPIItem {
  name: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  trend: string;
}

interface DomainAISummaryProps {
  requestData: {
    domainName: string;
    domainDescription: string;
    period: string;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    noDataCount: number;
    kpis: DomainKPIItem[];
  };
}

export function DomainAISummary({ requestData }: DomainAISummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/domain/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghasilkan ringkasan");
      }

      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Ringkasan Domain</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={loading}
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
          ) : summary ? (
            "Regenerate"
          ) : (
            "Generate Summary"
          )}
        </Button>
      </div>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {summary && (
        <div className="text-sm text-gray-700 space-y-2">
          {summary
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
git add src/components/domain/domain-ai-summary.tsx
git commit -m "feat(domain): add AI summary client component"
```

---

### Task 3: Integrate AI summary into domain page

**Files:**
- Modify: `src/app/domain/[slug]/page.tsx`

**Step 1: Import the component**

Add to imports:

```typescript
import { DomainAISummary } from "@/components/domain/domain-ai-summary";
```

**Step 2: Build request data after KPI fetching**

After the existing KPI data is fetched (where `kpisWithEntries` is computed from `getKPIsWithLatestEntry`), build the AI request data:

```typescript
import { getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatValue } from "@/lib/utils"; // or wherever formatValue is

// Count statuses
const statusCounts = { healthy: 0, warning: 0, critical: 0, noData: 0 };
const domainAIKpis = kpisWithEntries.map(({ kpi, latestEntry, effectiveTarget }) => {
  const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
  if (status === "green") statusCounts.healthy++;
  else if (status === "yellow") statusCounts.warning++;
  else if (status === "red") statusCounts.critical++;
  else statusCounts.noData++;

  const tgt = effectiveTarget ?? { target: kpi.target };
  const pct = latestEntry
    ? getAchievementPct(latestEntry.value, tgt.target, kpi.direction)
    : null;

  return {
    name: kpi.name,
    actual: latestEntry ? formatValue(latestEntry.value, kpi.unit) : "N/A",
    target: formatValue(tgt.target, kpi.unit),
    achievement: pct !== null ? `${pct}%` : "N/A",
    status: statusConfig[status].label,
    trend: "stabil", // simplified — can enhance later with sparkline data
  };
});

const domainSummaryData = {
  domainName: domain.name,
  domainDescription: domain.description || "",
  period: currentPeriod, // the currently selected period
  healthyCount: statusCounts.healthy,
  warningCount: statusCounts.warning,
  criticalCount: statusCounts.critical,
  noDataCount: statusCounts.noData,
  kpis: domainAIKpis,
};
```

**Step 3: Add component to page JSX**

Place the `<DomainAISummary>` component above the KPI list:

```tsx
<DomainAISummary requestData={domainSummaryData} />
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/domain/[slug]/page.tsx
git commit -m "feat(domain): integrate AI summary into domain page"
```
