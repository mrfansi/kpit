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
      <AlertTriangle aria-hidden className="size-6 text-destructive" />
      <div>
        <h1 className="text-lg font-semibold">Gagal memuat KPI</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Terjadi kesalahan saat memuat data KPI. Silakan coba lagi.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Kembali ke Overview</Link>
        </Button>
        <Button type="button" size="sm" onClick={reset}>Coba lagi</Button>
      </div>
    </div>
  );
}
