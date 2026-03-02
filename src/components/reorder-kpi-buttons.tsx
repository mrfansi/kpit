"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { reorderKPI } from "@/lib/actions/kpi";

interface ReorderKPIButtonsProps {
  id: number;
  isFirst: boolean;
  isLast: boolean;
}

export function ReorderKPIButtons({ id, isFirst, isLast }: ReorderKPIButtonsProps) {
  const [isPending, startTransition] = useTransition();

  const move = (direction: "up" | "down") => {
    startTransition(() => reorderKPI(id, direction));
  };

  return (
    <div className="flex flex-col gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5"
        disabled={isFirst || isPending}
        onClick={() => move("up")}
        title="Pindah ke atas"
      >
        <ChevronUp className="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5"
        disabled={isLast || isPending}
        onClick={() => move("down")}
        title="Pindah ke bawah"
      >
        <ChevronDown className="w-3 h-3" />
      </Button>
    </div>
  );
}
