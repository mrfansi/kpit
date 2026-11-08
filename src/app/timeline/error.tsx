"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function TimelineError({
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
      <AlertTriangle aria-hidden className="size-6 text-destructive" />
      <div>
        <h2 className="text-lg font-semibold">Terjadi kesalahan</h2>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Gagal memuat timeline. Silakan coba lagi.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={reset}>
        Coba lagi
      </Button>
    </div>
  );
}
