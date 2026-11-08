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
      <AlertTriangle aria-hidden className="size-6 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-semibold">Laporan gagal dimuat</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Data KPI tidak berhasil dirangkum. Coba muat ulang; kalau tetap gagal, buka
          domainnya satu per satu dari Overview.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Kembali ke Overview</Link>
        </Button>
        <Button type="button" size="sm" onClick={reset}>
          Coba lagi
        </Button>
      </div>
    </div>
  );
}
