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
              "num absolute top-0 flex h-full items-center justify-center border-r text-sm text-muted-foreground",
              col.isCurrentPeriod && "bg-paper-2 font-semibold text-foreground"
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
