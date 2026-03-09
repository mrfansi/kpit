"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DomainKPIItem {
  name: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  trend: string;
}

interface DomainAISummaryProps {
  requestData: {
    domainName: string;
    domainDescription: string;
    period: string;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    noDataCount: number;
    kpis: DomainKPIItem[];
  };
}

export function DomainAISummary({ requestData }: DomainAISummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/domain/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghasilkan ringkasan");
      }

      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Ringkasan Domain</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={loading}
          className="print:hidden text-xs"
        >
          {loading ? (
            <>
              <span
                className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-1"
                aria-hidden="true"
              />
              Menganalisis...
            </>
          ) : summary ? (
            "Regenerate"
          ) : (
            "Generate Summary"
          )}
        </Button>
      </div>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {summary && (
        <div className="text-sm text-gray-700 space-y-2">
          {summary
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          <p className="text-xs text-gray-400 mt-2 print:hidden">
            Dihasilkan oleh AI — verifikasi data sebelum mengambil keputusan
          </p>
        </div>
      )}
    </div>
  );
}
