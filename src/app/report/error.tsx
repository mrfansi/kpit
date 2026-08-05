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
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div>
        <h2 className="text-lg font-semibold">Laporan gagal dimuat</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Data KPI tidak berhasil dirangkum. Coba muat ulang; kalau tetap gagal, buka
          domainnya satu per satu dari Overview.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Kembali ke Overview</Link>
        </Button>
        <Button size="sm" onClick={reset}>
          Coba lagi
        </Button>
      </div>
    </div>
  );
}
