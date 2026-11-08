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
    <section
      aria-labelledby="domain-summary-heading"
      className={cn("border-b", hasContent ? "space-y-3 pb-5" : "pb-4")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="domain-summary-heading" className="text-base font-semibold">
          Ringkasan domain
          {!hasContent && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
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
          className="print:hidden"
        >
          {loading ? (
            <>
              <LoadingSpinner />
              Menganalisis…
            </>
          ) : summary ? (
            "Buat ulang"
          ) : (
            "Buat ringkasan"
          )}
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {summary && (
        <div className="max-w-[65ch] space-y-3 text-base text-foreground">
          {summary
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          <p className="text-xs text-muted-foreground print:hidden">
            Dihasilkan oleh AI. Verifikasi data sebelum mengambil keputusan.
          </p>
        </div>
      )}
    </section>
  );
}
