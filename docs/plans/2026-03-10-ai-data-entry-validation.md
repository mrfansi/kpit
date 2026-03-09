# AI Data Entry Validation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Validasi AI" button on the data input page that checks newly entered KPI values for anomalies based on historical patterns, flagging suspicious values before submission.

**Architecture:** API route receives array of KPI entries with their historical data, calls AI service to detect anomalies, returns array of warning flags. Client button below the input table triggers validation and shows inline warnings per KPI row.

**Tech Stack:** AI service abstraction (`src/lib/ai`), Next.js API routes, React client component

**Depends on:** Feature 1 (AI Service Abstraction Layer) must be completed first.

---

### Task 1: Create API route for entry validation

**Files:**
- Create: `src/app/api/kpi/validate-entries/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { auth } from "@/auth";

interface EntryToValidate {
  kpiId: string;
  kpiName: string;
  unit: string;
  inputValue: number;
  recentValues: number[];
  target: number;
  direction: string;
}

interface ValidateEntriesRequest {
  period: string;
  entries: EntryToValidate[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  const fullSession = await auth();
  if (fullSession?.user?.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya admin yang bisa menggunakan fitur ini." },
      { status: 403 }
    );
  }

  let body: ValidateEntriesRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json(
      { error: "Data entry tidak boleh kosong." },
      { status: 400 }
    );
  }

  const entriesText = body.entries
    .map((e) => {
      const avg =
        e.recentValues.length > 0
          ? (e.recentValues.reduce((a, b) => a + b, 0) / e.recentValues.length).toFixed(2)
          : "N/A";
      const min = e.recentValues.length > 0 ? Math.min(...e.recentValues) : "N/A";
      const max = e.recentValues.length > 0 ? Math.max(...e.recentValues) : "N/A";
      const direction =
        e.direction === "lower_better" ? "rendah lebih baik" : "tinggi lebih baik";
      return `- ${e.kpiName} (${e.unit}, ${direction}): input ${e.inputValue}, target ${e.target}, rata-rata 3 bulan ${avg}, range [${min}-${max}]`;
    })
    .join("\n");

  const prompt = `Kamu adalah validator data KPI. Periksa apakah nilai input berikut masuk akal berdasarkan data historis.

Periode: ${body.period}

Data entry:
${entriesText}

Instruksi:
- Jawab HANYA dalam format JSON array, tanpa teks lain:
[
  {
    "kpiName": "<nama KPI>",
    "concern": "<penjelasan singkat dalam Bahasa Indonesia kenapa nilai ini mencurigakan>",
    "severity": "warning" atau "info"
  }
]
- Hanya masukkan KPI yang mencurigakan, JANGAN masukkan yang normal
- Flag "warning" jika: nilai >50% lebih tinggi/rendah dari rata-rata historis, atau nilai di luar range historis secara signifikan
- Flag "info" jika: nilai berbeda dari tren tapi masih bisa masuk akal
- Jika semua nilai wajar, jawab dengan array kosong: []
- Jangan flag KPI yang belum punya data historis (rata-rata N/A)`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt, { temperature: 0.2 });
    const cleaned = cleanAIOutput(result.text);

    // Extract JSON array from response
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ flags: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ flags: [] });
    }

    // Validate and sanitize each flag
    const flags = parsed
      .filter(
        (f: Record<string, unknown>) =>
          typeof f.kpiName === "string" &&
          typeof f.concern === "string" &&
          (f.severity === "warning" || f.severity === "info")
      )
      .map((f: Record<string, unknown>) => ({
        kpiName: String(f.kpiName),
        concern: String(f.concern),
        severity: f.severity as "warning" | "info",
      }));

    return NextResponse.json({ flags });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ flags: [] });
    }
    return handleAIError(error);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/kpi/validate-entries/route.ts
git commit -m "feat(kpi): add API route for AI data entry validation"
```

---

### Task 2: Create client component for validation button and warnings

**Files:**
- Create: `src/components/data-entry-validator.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ValidationFlag {
  kpiName: string;
  concern: string;
  severity: "warning" | "info";
}

interface EntryData {
  kpiId: string;
  kpiName: string;
  unit: string;
  inputValue: number;
  recentValues: number[];
  target: number;
  direction: string;
}

interface DataEntryValidatorProps {
  period: string;
  getEntries: () => EntryData[];
}

export function DataEntryValidator({
  period,
  getEntries,
}: DataEntryValidatorProps) {
  const [flags, setFlags] = useState<ValidationFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  async function handleValidate() {
    const entries = getEntries();
    if (entries.length === 0) {
      setError("Tidak ada data untuk divalidasi.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/kpi/validate-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, entries }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memvalidasi data");
      }

      const data = await res.json();
      setFlags(data.flags);
      setValidated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleValidate}
        disabled={loading}
        className="text-xs"
      >
        {loading ? (
          <>
            <span
              className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-1"
              aria-hidden="true"
            />
            Memvalidasi...
          </>
        ) : (
          "Validasi AI"
        )}
      </Button>

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

      {validated && flags.length === 0 && (
        <p className="text-green-600 text-xs mt-2">
          Semua nilai terlihat wajar.
        </p>
      )}

      {flags.length > 0 && (
        <div className="mt-2 space-y-1">
          {flags.map((flag, i) => (
            <div
              key={i}
              className={`text-xs p-2 rounded ${
                flag.severity === "warning"
                  ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                  : "bg-blue-50 border border-blue-200 text-blue-800"
              }`}
            >
              <span className="font-semibold">{flag.kpiName}:</span>{" "}
              {flag.concern}
            </div>
          ))}
          <p className="text-xs text-gray-400 mt-1">
            Peringatan ini bersifat advisory — Anda tetap bisa submit data.
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/data-entry-validator.tsx
git commit -m "feat(kpi): add data entry validator client component"
```

---

### Task 3: Integrate validator into data input page

**Files:**
- Modify: `src/app/admin/input/page.tsx`

**Step 1: Import the component**

```typescript
import { DataEntryValidator } from "@/components/data-entry-validator";
```

**Step 2: Add `getEntries` function**

Create a function that reads current form values and recent historical data (last 3-6 entries per KPI) to build the entries array for validation.

**Step 3: Place component below the input table**

```tsx
<DataEntryValidator
  period={selectedPeriod}
  getEntries={() => {
    // Build entries from current form state + historical data
    return kpis
      .filter((kpi) => formValues[kpi.id] !== undefined)
      .map((kpi) => ({
        kpiId: kpi.id,
        kpiName: kpi.name,
        unit: kpi.unit,
        inputValue: Number(formValues[kpi.id]),
        recentValues: recentEntries[kpi.id] || [],
        target: kpi.target,
        direction: kpi.direction,
      }));
  }}
/>
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/admin/input/page.tsx
git commit -m "feat(kpi): integrate AI validator into data input page"
```
