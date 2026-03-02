"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <AlertTriangle className="w-10 h-10 text-destructive" />
      <div>
        <h2 className="text-lg font-semibold">Gagal Memuat KPI</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {error.message || "Terjadi kesalahan saat memuat data KPI."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Kembali ke Overview</Link>
        </Button>
        <Button size="sm" onClick={reset}>Coba Lagi</Button>
      </div>
    </div>
  );
}
