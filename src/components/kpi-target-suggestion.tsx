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
  onApply?: (target: number) => void;
}

const confidenceColors = {
  low: "bg-danger-soft text-danger",
  medium: "bg-warning-soft text-warning",
  high: "bg-success-soft text-success",
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
              className="inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mr-1"
              aria-hidden="true"
            />
            Menganalisis...
          </>
        ) : (
          "Suggest Target"
        )}
      </Button>

      {!hasEnoughData && (
        <p className="text-xs text-muted-foreground">Minimal 3 periode data.</p>
      )}

      {error && <p className="text-danger text-xs">{error}</p>}

      {suggestion && (
        <div className="max-w-sm rounded border border-info/30 bg-info-soft p-3 text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold">
              <span className="num">{suggestion.suggestedTarget}</span> {unit}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${confidenceColors[suggestion.confidence]}`}
            >
              Confidence: {confidenceLabels[suggestion.confidence]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{suggestion.reasoning}</p>
          {onApply && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onApply(suggestion.suggestedTarget)}
              className="text-xs"
            >
              Terapkan
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
