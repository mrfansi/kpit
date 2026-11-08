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
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      title={isPinned ? "Lepas pin" : "Pin KPI ini"}
      aria-label={isPinned ? "Lepas pin" : "Pin KPI ini"}
      aria-pressed={isPinned}
      className={cn(
        // ::before memperluas area sentuh ke 36px tanpa mengubah ukuran ikon
        // atau tinggi baris tabel; target ikon-saja 22px terlalu kecil untuk disentuh.
        "relative rounded-sm p-1 transition-colors duration-[var(--dur-micro)] before:absolute before:inset-1/2 before:size-9 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        isPinned ? "text-foreground hover:text-muted-foreground" : "text-muted-foreground hover:text-foreground",
        isPending && "cursor-wait opacity-55"
      )}
    >
      <Icon aria-hidden className="size-3.5" />
    </button>
  );
}
