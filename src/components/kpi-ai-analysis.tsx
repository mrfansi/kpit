"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Analisis AI</h2>
        <div className="flex items-center gap-2">
          {analysis && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="text-muted-foreground"
            >
              {expanded ? "Tutup" : "Buka"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={loading || !hasEnoughData}
            className="print:hidden"
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Menganalisis…
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
        <p className="text-sm text-muted-foreground">
          Minimal 2 periode data diperlukan untuk analisis.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {analysis && expanded && (
        <div className="max-w-prose space-y-3 text-base">
          {analysis
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          <p className="text-xs text-muted-foreground print:hidden">
            Dihasilkan oleh AI. Verifikasi data sebelum mengambil keputusan
          </p>
        </div>
      )}
    </div>
  );
}
