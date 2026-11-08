"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableSearchProps {
  placeholder: string;
  /** Nama query param yang diupdate. Default "q". */
  paramName?: string;
  className?: string;
}

/**
 * Input search generik untuk tabel admin: update query param via router,
 * server component pemanggil yang melakukan filter. Pola sama dengan
 * kpi-filter-bar.tsx.
 */
export function TableSearch({ placeholder, paramName = "q", className }: TableSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateParam = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(paramName, value);
    } else {
      params.delete(paramName);
    }
    // Filter berubah → kembali ke halaman pertama kalau tabelnya dipaginasi.
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }, [router, pathname, searchParams, paramName]);

  const currentValue = searchParams.get(paramName) ?? "";

  return (
    <div className={cn("relative max-w-xs flex-1", className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        defaultValue={currentValue}
        onChange={(e) => updateParam(e.target.value)}
        className="pl-9"
      />
      {currentValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => updateParam("")}
          aria-label="Hapus pencarian"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
