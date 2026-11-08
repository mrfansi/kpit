"use client";

import { cn } from "@/lib/utils";
import type { GanttColumn } from "./gantt-types";

interface GanttGridProps {
  columns: GanttColumn[];
  totalHeight: number;
}

export function GanttGrid({ columns, totalHeight }: GanttGridProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {columns.map((col, i) => (
        <div
          key={i}
          className={cn(
            "absolute top-0 border-r",
            col.isCurrentPeriod && "bg-paper-2"
          )}
          style={{ left: col.x, width: col.width, height: totalHeight }}
        />
      ))}
    </div>
  );
}
