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

const riskColors = {
  low: "bg-success-soft text-success border-success",
  medium: "bg-warning-soft text-warning border-warning",
  high: "bg-danger-soft text-danger border-danger",
  critical: "bg-danger-soft text-danger border-danger",
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
            <LoadingSpinner className="mr-1" />
            Menganalisis...
          </>
        ) : assessment ? (
          "Analisis Ulang"
        ) : (
          "Analisis Risiko"
        )}
      </Button>

      {error && <p className="text-destructive text-xs mt-2">{error}</p>}

      {assessment && (
        <div className="mt-3 p-3 bg-muted rounded border border-border">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded border font-medium ${riskColors[assessment.riskLevel]}`}
            >
              Risiko: {riskLabels[assessment.riskLevel]}
            </span>
            <span
              className={`text-xs ${assessment.onTrack ? "text-success" : "text-danger"}`}
            >
              {assessment.onTrack ? "On Track" : "Off Track"}
            </span>
          </div>

          {assessment.estimatedCompletion && (
            <p className="text-xs text-muted-foreground mb-2">
              Estimasi selesai: {assessment.estimatedCompletion}
            </p>
          )}

          <div className="text-sm text-foreground space-y-2">
            {assessment.analysis
              .split("\n\n")
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Dihasilkan oleh AI — verifikasi sebelum mengambil keputusan
          </p>
        </div>
      )}
    </div>
  );
}
