"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  message: string;
  /** Bila diisi, tampil tombol tautan kembali ke halaman ini. */
  homeHref?: string;
}

export function RouteError({ error, reset, title, message, homeHref }: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle aria-hidden className="size-6 text-destructive" />
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{message}</p>
        {error.digest && (
          <p className="text-sm text-muted-foreground">Kode galat: {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {homeHref && (
          <Button variant="outline" asChild>
            <Link href={homeHref}>Kembali ke Overview</Link>
          </Button>
        )}
        <Button type="button" onClick={reset}>
          Coba lagi
        </Button>
      </div>
    </div>
  );
}
