"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="mt-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleValidate}
        disabled={loading}
        className="text-xs"
      >
        {loading ? (
          <>
            <span
              className="inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mr-1"
              aria-hidden="true"
            />
            Memvalidasi...
          </>
        ) : (
          "Validasi AI"
        )}
      </Button>

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

      {validated && flags.length === 0 && (
        <p className="text-green-600 text-xs mt-2">
          Semua nilai terlihat wajar.
        </p>
      )}

      {flags.length > 0 && (
        <div className="mt-2 space-y-1">
          {flags.map((flag, i) => (
            <div
              key={i}
              className={`text-xs p-2 rounded ${
                flag.severity === "warning"
                  ? "bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300"
                  : "bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
              }`}
            >
              <span className="font-semibold">{flag.kpiName}:</span>{" "}
              {flag.concern}
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">
            Peringatan ini bersifat advisory — Anda tetap bisa submit data.
          </p>
        </div>
      )}
    </div>
  );
}
