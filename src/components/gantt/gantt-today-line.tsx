"use client";

interface GanttTodayLineProps {
  x: number;
  totalHeight: number;
}

export function GanttTodayLine({ x, totalHeight }: GanttTodayLineProps) {
  if (x < 0) return null;

  return (
    <div
      className="absolute top-0 w-px bg-foreground z-20 pointer-events-none"
      style={{ left: x, height: totalHeight }}
    >
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-sm bg-foreground px-1.5 text-xs leading-5 text-background whitespace-nowrap">
        Hari ini
      </div>
    </div>
  );
}
