"use client";

import { useState } from "react";

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
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Ringkasan</h2>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="print:hidden text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Menganalisis...
            </>
          ) : narrative ? (
            "Regenerate"
          ) : (
            "\u2728 Generate Analisis AI"
          )}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-xs mb-2">{error}</p>
      )}

      {narrative ? (
        <div className="text-sm text-gray-700 space-y-2">
          {narrative.split("\n\n").filter(Boolean).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <p className="text-xs text-gray-400 mt-2 print:hidden">Dihasilkan oleh AI — verifikasi data sebelum mengambil keputusan</p>
        </div>
      ) : (
        <p className="text-sm text-gray-700">{staticSummary}</p>
      )}
    </div>
  );
}
