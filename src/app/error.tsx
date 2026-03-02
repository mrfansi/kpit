"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

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
        <h2 className="text-lg font-semibold">Terjadi Kesalahan</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {error.message || "Gagal memuat halaman. Silakan coba lagi."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        Coba Lagi
      </Button>
    </div>
  );
}
