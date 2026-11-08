"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
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
    <div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Gagal memuat domain</h1>
        <p className="max-w-prose text-base text-muted-foreground">
          Terjadi kesalahan saat memuat data domain. Silakan coba lagi.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/">Kembali ke Overview</Link>
        </Button>
        <Button type="button" onClick={reset}>Coba lagi</Button>
      </div>
    </div>
  );
}
