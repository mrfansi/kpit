"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { restoreKPI } from "@/lib/actions/kpi";
import { toast } from "sonner";

interface RestoreKPIButtonProps {
  id: number;
  name: string;
}

export function RestoreKPIButton({ id, name }: RestoreKPIButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      await restoreKPI(id);
      toast.success(`KPI "${name}" berhasil di-restore`);
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleRestore} disabled={isPending}>
      <RotateCcw aria-hidden />
      {isPending ? "Memulihkan…" : "Restore"}
    </Button>
  );
}
