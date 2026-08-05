"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

interface AuditFiltersProps {
  actions: string[];
  entities: string[];
}

/** Filter by aksi & entitas untuk log audit. Update query param via router, page.tsx (server) yang query ke DB. */
export function AuditFilters({ actions, entities }: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }, [router, pathname, searchParams]);

  const currentAction = searchParams.get("action") ?? "";
  const currentEntity = searchParams.get("entity") ?? "";

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <select
        aria-label="Filter aksi"
        value={currentAction}
        onChange={(e) => updateParam("action", e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
      >
        <option value="">Semua Aksi</option>
        {actions.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <select
        aria-label="Filter entitas"
        value={currentEntity}
        onChange={(e) => updateParam("entity", e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground capitalize"
      >
        <option value="">Semua Entitas</option>
        {entities.map((en) => (
          <option key={en} value={en}>{en}</option>
        ))}
      </select>
    </div>
  );
}
