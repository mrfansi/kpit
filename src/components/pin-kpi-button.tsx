"use client";

import { useTransition } from "react";
import { Pin, PinOff } from "lucide-react";
import { togglePinKPI } from "@/lib/actions/kpi";
import { cn } from "@/lib/utils";

interface PinKPIButtonProps {
  id: number;
  isPinned: boolean;
}

export function PinKPIButton({ id, isPinned }: PinKPIButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault(); // prevent Link navigation
    e.stopPropagation();
    startTransition(() => togglePinKPI(id, !isPinned));
  }

  const Icon = isPinned ? PinOff : Pin;

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={isPinned ? "Lepas pin" : "Pin KPI ini"}
      className={cn(
        // ::before memperluas area sentuh ke 36px tanpa mengubah ukuran ikon
        // atau tinggi baris tabel — target ikon-saja 22px terlalu kecil untuk disentuh.
        "relative p-1 rounded transition-colors before:absolute before:inset-1/2 before:size-9 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        isPinned
          ? "text-primary hover:text-primary/70"
          : "text-muted-foreground/40 hover:text-muted-foreground",
        isPending && "opacity-50 cursor-wait"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
