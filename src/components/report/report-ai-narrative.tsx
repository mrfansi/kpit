"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface KPIDataItem {
  name: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  momDelta: string;
  prevValue: string;
  direction: string;
}

interface ReportAINarrativeProps {
  staticSummary: string;
  requestData: {
    period: string;
    healthScore: number;
    healthDelta: number | null;
    improved: number;
    declined: number;
    stable: number;
    avgAchievement: number | null;
    kpis: KPIDataItem[];
  };
}

export function ReportAINarrative({ staticSummary, requestData }: ReportAINarrativeProps) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/report/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghasilkan narasi");
      }

      const data = await res.json();
      setNarrative(data.narrative);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    // Prosa, bukan kotak: dibaca seperti paragraf pembuka dokumen, lebar baris ~65ch.
    <section aria-labelledby="report-summary-heading" className="space-y-3 break-inside-avoid-page">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="report-summary-heading" className="text-lg font-semibold">Ringkasan</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={loading}
          className="print:hidden"
        >
          {loading ? (
            <>
              <LoadingSpinner />
              Menganalisis…
            </>
          ) : narrative ? (
            "Buat ulang"
          ) : (
            <>
              <Sparkles aria-hidden />
              Buat analisis AI
            </>
          )}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      {narrative ? (
        <div className="max-w-[65ch] space-y-3 text-base text-foreground">
          {narrative.split("\n\n").filter(Boolean).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <p className="text-sm text-muted-foreground print:hidden">Dihasilkan oleh AI, verifikasi data sebelum mengambil keputusan</p>
        </div>
      ) : (
        <p className="max-w-[65ch] text-base text-foreground">{staticSummary}</p>
      )}
    </section>
  );
}
