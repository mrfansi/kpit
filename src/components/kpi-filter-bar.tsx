"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

const STATUS_OPTIONS = [
  { label: "Semua", value: "" },
  { label: "On Track", value: "green" },
  { label: "At Risk", value: "yellow" },
  { label: "Off Track", value: "red" },
  { label: "No Data", value: "no-data" },
];

interface KPIFilterBarProps {
  defaultQ?: string;
  defaultStatus?: string;
}

export function KPIFilterBar({ defaultQ = "", defaultStatus = "" }: KPIFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }, [router, pathname, searchParams]);

  const currentQ = searchParams.get("q") ?? defaultQ;
  const currentStatus = searchParams.get("status") ?? defaultStatus;

  // Input terkontrol + debounce: satu navigasi per jeda mengetik, bukan satu per karakter.
  const [q, setQ] = useState(currentQ);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(updateParams);
  useEffect(() => {
    latest.current = updateParams;
  }, [updateParams]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center print:hidden">
      <div className="relative w-full sm:w-64 sm:shrink-0">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Cari KPI"
          placeholder="Cari KPI…"
          value={q}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            clearTimeout(timer.current);
            timer.current = window.setTimeout(() => latest.current("q", value), 300);
          }}
          className="pl-9"
        />
        {q && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              clearTimeout(timer.current);
              setQ("");
              updateParams("q", "");
            }}
            aria-label="Hapus pencarian"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          >
            <X aria-hidden className="size-3.5" />
          </Button>
        )}
      </div>
      {/* Kontrol bersegmen: satu bingkai, pilihan aktif diangkat ke permukaan. */}
      <div role="group" aria-label="Filter status" className="inline-flex w-fit max-w-full shrink-0 flex-wrap gap-0.5 rounded-md border bg-card p-0.5">
        {STATUS_OPTIONS.map((opt) => {
          const active = currentStatus === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              className={
                active
                  ? "h-8 shrink-0 rounded-sm bg-secondary px-2.5 text-sm font-semibold whitespace-nowrap text-foreground"
                  : "h-8 shrink-0 rounded-sm px-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:bg-accent hover:text-foreground"
              }
              onClick={() => updateParams("status", opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
