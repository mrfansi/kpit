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
    <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">Analisis AI</h3>
        <div className="flex items-center gap-2">
          {analysis && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Tutup" : "Buka"}
            </button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={loading || !hasEnoughData}
            className="print:hidden text-xs"
          >
            {loading ? (
              <>
                <LoadingSpinner className="mr-1" />
                Menganalisis...
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
        <p className="text-xs text-muted-foreground">
          Minimal 2 periode data diperlukan untuk analisis.
        </p>
      )}

      {error && <p className="text-destructive text-xs mb-2">{error}</p>}

      {analysis && expanded && (
        <div className="text-sm text-foreground space-y-2">
          {analysis
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          <p className="text-xs text-muted-foreground mt-2 print:hidden">
            Dihasilkan oleh AI — verifikasi data sebelum mengambil keputusan
          </p>
        </div>
      )}
    </div>
  );
}
