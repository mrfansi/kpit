"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

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

// Chip baku: latar -soft + teks token penuh, tanpa bingkai.
const riskColors = {
  low: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning",
  high: "bg-danger-soft text-danger",
  critical: "bg-danger-soft text-danger",
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
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAnalyze}
        disabled={loading}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Menganalisis…
          </>
        ) : assessment ? (
          "Analisis ulang"
        ) : (
          "Analisis risiko"
        )}
      </Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {assessment && (
        <div className="space-y-3 rounded-card bg-paper-2 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-sm px-1.5 text-sm font-semibold leading-6 ${riskColors[assessment.riskLevel]}`}
            >
              Risiko: {riskLabels[assessment.riskLevel]}
            </span>
            <span
              className={`text-sm ${assessment.onTrack ? "text-success" : "text-danger"}`}
            >
              {assessment.onTrack ? "On Track" : "Off Track"}
            </span>
          </div>

          {assessment.estimatedCompletion && (
            <p className="text-sm text-muted-foreground">
              Estimasi selesai: <span className="num text-foreground">{assessment.estimatedCompletion}</span>
            </p>
          )}

          <div className="max-w-[65ch] space-y-3 text-base text-foreground">
            {assessment.analysis
              .split("\n\n")
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Dihasilkan oleh AI: verifikasi sebelum mengambil keputusan
          </p>
        </div>
      )}
    </div>
  );
}
