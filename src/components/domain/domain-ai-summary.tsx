"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";

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

  const hasContent = Boolean(summary || error);

  return (
    // Saat belum ada ringkasan, panel ini menyusut jadi satu baris. Panel kosong
    // tidak boleh mengambil ruang sebanyak panel berisi — data yang harus naik,
    // bukan tombol yang menunggu diklik.
    <div className={cn("rounded-lg border", hasContent ? "space-y-2 p-4" : "px-4 py-2.5")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Ringkasan Domain
          {!hasContent && (
            <span className="ml-2 font-normal text-muted-foreground">
              belum dibuat untuk periode ini
            </span>
          )}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={loading}
          className="shrink-0 text-xs print:hidden"
        >
          {loading ? (
            <>
              <LoadingSpinner className="mr-1" />
              Menganalisis...
            </>
          ) : summary ? (
            "Buat ulang"
          ) : (
            "Buat ringkasan"
          )}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {summary && (
        <div className="space-y-2 text-sm text-foreground">
          {summary
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          <p className="mt-2 text-xs text-muted-foreground print:hidden">
            Dihasilkan oleh AI — verifikasi data sebelum mengambil keputusan
          </p>
        </div>
      )}
    </div>
  );
}
