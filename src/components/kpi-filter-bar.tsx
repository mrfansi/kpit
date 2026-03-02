"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
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

  return (
    <div className="flex flex-col sm:flex-row gap-2 print:hidden">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Cari KPI..."
          defaultValue={currentQ}
          onChange={(e) => updateParams("q", e.target.value)}
          className="pl-8 h-8 text-sm"
        />
        {currentQ && (
          <button
            onClick={() => updateParams("q", "")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={currentStatus === opt.value ? "default" : "outline"}
            className="text-xs h-8 px-2.5"
            onClick={() => updateParams("status", opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
