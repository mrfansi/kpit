"use client";

import { cn } from "@/lib/utils";
import type { GanttColumn } from "./gantt-types";
import { HEADER_HEIGHT } from "./gantt-types";

interface GanttHeaderProps {
  columns: GanttColumn[];
  totalWidth: number;
}

export function GanttHeader({ columns, totalWidth }: GanttHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 border-b bg-background"
      style={{ height: HEADER_HEIGHT, width: totalWidth }}
    >
      <div className="relative h-full">
        {columns.map((col, i) => (
          <div
            key={i}
            className={cn(
              "absolute top-0 h-full flex items-center justify-center border-r text-xs font-medium",
              col.isCurrentPeriod && "bg-primary/5 text-primary"
            )}
            style={{ left: col.x, width: col.width }}
          >
            {col.label}
          </div>
        ))}
      </div>
    </div>
  );
}
