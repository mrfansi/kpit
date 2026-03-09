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
