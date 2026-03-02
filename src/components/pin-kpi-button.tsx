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
        "p-1 rounded transition-colors",
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
