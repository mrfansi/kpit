"use client";

interface GanttTodayLineProps {
  x: number;
  totalHeight: number;
}

export function GanttTodayLine({ x, totalHeight }: GanttTodayLineProps) {
  if (x < 0) return null;

  return (
    <div
      className="absolute top-0 w-0.5 bg-primary z-20 pointer-events-none"
      style={{ left: x, height: totalHeight }}
    >
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
        Hari ini
      </div>
    </div>
  );
}
