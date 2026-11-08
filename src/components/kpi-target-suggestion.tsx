"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

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
  onApply?: (target: number) => void;
}

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
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSuggest}
        disabled={loading || !hasEnoughData}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Menganalisis…
          </>
        ) : (
          "Suggest target"
        )}
      </Button>

      {!hasEnoughData && (
        <p className="text-sm text-muted-foreground">Minimal 3 periode data.</p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {suggestion && (
        // Sumur netral: tingkat keyakinan AI bukan status KPI, jadi tanpa hue status.
        <div className="w-full max-w-sm space-y-2 rounded-card bg-paper-2 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span>
              <span className="num text-3xl leading-none font-semibold">{suggestion.suggestedTarget}</span>{" "}
              <span className="text-muted-foreground">{unit}</span>
            </span>
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-semibold">
              Confidence: {confidenceLabels[suggestion.confidence]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
          {onApply && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onApply(suggestion.suggestedTarget)}
            >
              Terapkan
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
