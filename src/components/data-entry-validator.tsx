"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ValidationFlag {
  kpiName: string;
  concern: string;
  severity: "warning" | "info";
}

interface EntryData {
  kpiId: string;
  kpiName: string;
  unit: string;
  inputValue: number;
  recentValues: number[];
  target: number;
  direction: string;
}

interface DataEntryValidatorProps {
  period: string;
  getEntries: () => EntryData[];
}

export function DataEntryValidator({
  period,
  getEntries,
}: DataEntryValidatorProps) {
  const [flags, setFlags] = useState<ValidationFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  async function handleValidate() {
    const entries = getEntries();
    if (entries.length === 0) {
      setError("Tidak ada data untuk divalidasi.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/kpi/validate-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, entries }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memvalidasi data");
      }

      const data = await res.json();
      setFlags(data.flags);
      setValidated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleValidate}
        disabled={loading}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Memvalidasi…
          </>
        ) : (
          "Validasi AI"
        )}
      </Button>

      {error && <p className="text-sm text-danger">{error}</p>}

      {validated && flags.length === 0 && (
        <p className="text-sm text-success">
          Semua nilai terlihat wajar.
        </p>
      )}

      {flags.length > 0 && (
        <div className="space-y-2">
          {/* Satu sumur berwarna per KPI yang ditandai; tanpa garis tepi. */}
          <ul className="space-y-1.5">
            {flags.map((flag, i) => (
              <li
                key={i}
                className={`max-w-prose rounded-card px-3 py-2 text-sm ${
                  flag.severity === "warning"
                    ? "bg-warning-soft text-warning"
                    : "bg-info-soft text-foreground"
                }`}
              >
                <span className="font-semibold">{flag.kpiName}:</span>{" "}
                {flag.concern}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Peringatan ini bersifat advisory. Anda tetap bisa submit data.
          </p>
        </div>
      )}
    </div>
  );
}
