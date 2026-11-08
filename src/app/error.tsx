"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
        <h1 className="text-2xl font-semibold tracking-tight">Terjadi kesalahan</h1>
        <p className="max-w-prose text-base text-muted-foreground">
          Gagal memuat halaman. Silakan coba lagi.
        </p>
        {error.digest && (
          <p className="text-sm text-muted-foreground">Kode galat: {error.digest}</p>
        )}
      </div>
      <Button type="button" onClick={reset}>
        Coba lagi
      </Button>
    </div>
  );
}
