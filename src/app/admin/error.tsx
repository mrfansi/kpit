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
    <div role="alert" className="max-w-xl space-y-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <AlertTriangle aria-hidden className="size-5 text-destructive" />
        Terjadi kesalahan
      </h1>
      <p className="text-muted-foreground">
        Gagal memuat halaman admin. Silakan coba lagi.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={reset}>Coba lagi</Button>
        <Button variant="ghost" asChild>
          <Link href="/">Kembali ke Overview</Link>
        </Button>
      </div>
    </div>
  );
}
