"use client";

import { Button } from "@/components/ui/button";

export default function TimelineError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-sm text-muted-foreground">
        Gagal memuat timeline.
      </p>
      <Button variant="outline" size="sm" onClick={reset}>
        Coba lagi
      </Button>
    </div>
  );
}
