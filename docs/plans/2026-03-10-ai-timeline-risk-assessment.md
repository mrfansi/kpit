# AI Timeline Risk Assessment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Analisis Risiko" button to the timeline project detail panel that uses AI to assess delay risk based on progress, timeline, and activity logs.

**Architecture:** API route receives project data (dates, progress, logs), calls AI service, returns structured risk assessment (risk level, estimated completion, on-track boolean) plus narrative analysis. Client component shows risk badge and analysis in the project detail panel.

**Tech Stack:** AI service abstraction (`src/lib/ai`), Next.js API routes, React client component

**Depends on:** Feature 1 (AI Service Abstraction Layer) must be completed first.

---

### Task 1: Create API route for timeline risk analysis

**Files:**
- Create: `src/app/api/timeline/risk-analysis/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAIService, sanitizeInput, cleanAIOutput } from "@/lib/ai";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";

interface ProgressLog {
  date: string;
  progressBefore: number;
  progressAfter: number;
  content: string;
}

interface RiskAnalysisRequest {
  projectName: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  estimatedLaunchDate: string | null;
  launchBufferDays: number;
  progress: number;
  logs: ProgressLog[];
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  let body: RiskAnalysisRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body tidak valid." },
      { status: 400 }
    );
  }

  if (!body.projectName || typeof body.projectName !== "string") {
    return NextResponse.json(
      { error: "Nama project harus diisi." },
      { status: 400 }
    );
  }

  if (!body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: "Tanggal mulai dan selesai harus diisi." },
      { status: 400 }
    );
  }

  const projectName = sanitizeInput(body.projectName, 100);
  const description = sanitizeInput(body.description || "", 200);
  const status = sanitizeInput(body.status || "", 50);

  // Calculate time metrics
  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  const now = new Date();
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const timeElapsedPct = totalDays > 0 ? ((elapsedDays / totalDays) * 100).toFixed(1) : "0";

  const logsText =
    body.logs.length > 0
      ? body.logs
          .slice(-15)
          .map(
            (l) =>
              `- ${l.date}: progress ${l.progressBefore}% → ${l.progressAfter}% | ${l.content}`
          )
          .join("\n")
      : "Belum ada log aktivitas.";

  const prompt = `Kamu adalah project manager senior. Analisis risiko keterlambatan project berikut.

Project: ${projectName}
${description ? `Deskripsi: ${description}\n` : ""}Status: ${status}
Mulai: ${body.startDate}
Deadline: ${body.endDate}
${body.estimatedLaunchDate ? `Estimasi launch: ${body.estimatedLaunchDate}\n` : ""}Buffer: ${body.launchBufferDays} hari

Progress: ${body.progress}%
Waktu berlalu: ${elapsedDays} dari ${totalDays} hari (${timeElapsedPct}%)
Sisa waktu: ${remainingDays} hari

Log aktivitas terakhir:
${logsText}

Instruksi:
- Jawab dalam format JSON berikut, dengan field "analysis" berisi 2 paragraf narasi:
{
  "riskLevel": "<low|medium|high|critical>",
  "estimatedCompletion": "<YYYY-MM-DD perkiraan selesai berdasarkan velocity>",
  "onTrack": <true|false>,
  "analysis": "<2 paragraf: paragraf 1 tentang situasi saat ini, paragraf 2 tentang rekomendasi. Pisahkan paragraf dengan \\n\\n>"
}

Aturan penilaian risiko:
- "low": progress >= waktu berlalu, velocity konsisten
- "medium": progress sedikit tertinggal (<15% gap), atau velocity menurun
- "high": progress tertinggal signifikan (15-30% gap), atau tidak ada update terbaru
- "critical": progress tertinggal >30%, atau deadline sangat dekat dengan progress rendah
- estimatedCompletion: hitung dari velocity rata-rata (progress/hari dari log)
- Jika tidak ada log, gunakan progress/elapsedDays sebagai velocity`;

  try {
    const ai = getAIService();
    const result = await ai.generateText(prompt, { temperature: 0.3 });
    const cleaned = cleanAIOutput(result.text);

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI tidak menghasilkan format yang valid. Coba lagi." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (
      !["low", "medium", "high", "critical"].includes(parsed.riskLevel) ||
      typeof parsed.onTrack !== "boolean" ||
      typeof parsed.analysis !== "string"
    ) {
      return NextResponse.json(
        { error: "AI response format tidak valid. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      riskLevel: parsed.riskLevel,
      estimatedCompletion: parsed.estimatedCompletion || null,
      onTrack: parsed.onTrack,
      analysis: parsed.analysis,
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
git add src/app/api/timeline/risk-analysis/route.ts
git commit -m "feat(timeline): add API route for AI risk assessment"
```

---

### Task 2: Create client component for risk assessment

**Files:**
- Create: `src/components/timeline/timeline-risk-assessment.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RiskAssessment {
  riskLevel: "low" | "medium" | "high" | "critical";
  estimatedCompletion: string | null;
  onTrack: boolean;
  analysis: string;
}

interface TimelineRiskAssessmentProps {
  projectName: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  estimatedLaunchDate: string | null;
  launchBufferDays: number;
  progress: number;
  logs: {
    date: string;
    progressBefore: number;
    progressAfter: number;
    content: string;
  }[];
}

const riskColors = {
  low: "bg-green-100 text-green-700 border-green-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const riskLabels = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

export function TimelineRiskAssessment(props: TimelineRiskAssessmentProps) {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/timeline/risk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: props.projectName,
          description: props.description,
          status: props.status,
          startDate: props.startDate,
          endDate: props.endDate,
          estimatedLaunchDate: props.estimatedLaunchDate,
          launchBufferDays: props.launchBufferDays,
          progress: props.progress,
          logs: props.logs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menganalisis risiko");
      }

      const data = await res.json();
      setAssessment(data);
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
        onClick={handleAnalyze}
        disabled={loading}
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
        ) : assessment ? (
          "Analisis Ulang"
        ) : (
          "Analisis Risiko"
        )}
      </Button>

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

      {assessment && (
        <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded border font-medium ${riskColors[assessment.riskLevel]}`}
            >
              Risiko: {riskLabels[assessment.riskLevel]}
            </span>
            <span
              className={`text-xs ${assessment.onTrack ? "text-green-600" : "text-red-600"}`}
            >
              {assessment.onTrack ? "On Track" : "Off Track"}
            </span>
          </div>

          {assessment.estimatedCompletion && (
            <p className="text-xs text-gray-500 mb-2">
              Estimasi selesai: {assessment.estimatedCompletion}
            </p>
          )}

          <div className="text-sm text-gray-700 space-y-2">
            {assessment.analysis
              .split("\n\n")
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Dihasilkan oleh AI — verifikasi sebelum mengambil keputusan
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/timeline/timeline-risk-assessment.tsx
git commit -m "feat(timeline): add risk assessment client component"
```

---

### Task 3: Integrate risk assessment into Gantt chart detail panel

**Files:**
- Modify: `src/components/gantt/gantt-chart.tsx` (or the log panel component where project details are shown)

**Step 1: Import the component**

```typescript
import { TimelineRiskAssessment } from "@/components/timeline/timeline-risk-assessment";
```

**Step 2: Add to project detail/log panel**

When a project is selected and its detail panel is open, pass project data and logs to `TimelineRiskAssessment`:

```tsx
<TimelineRiskAssessment
  projectName={selectedProject.name}
  description={selectedProject.description || ""}
  status={selectedProject.status?.name || ""}
  startDate={selectedProject.startDate}
  endDate={selectedProject.endDate}
  estimatedLaunchDate={selectedProject.estimatedLaunchDate}
  launchBufferDays={selectedProject.launchBufferDays || 0}
  progress={selectedProject.progress}
  logs={projectLogs.map((l) => ({
    date: l.createdAt,
    progressBefore: l.progressBefore ?? 0,
    progressAfter: l.progressAfter ?? 0,
    content: l.content,
  }))}
/>
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/gantt/gantt-chart.tsx
git commit -m "feat(timeline): integrate AI risk assessment into Gantt detail panel"
```
