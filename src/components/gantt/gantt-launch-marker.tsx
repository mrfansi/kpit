"use client";

import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface GanttLaunchMarkerProps {
  x: number;
  y: number;
  height: number;
  launchDate: string;
  isManualOverride: boolean;
}

export function GanttLaunchMarker({
  x,
  y,
  height,
  launchDate,
  isManualOverride,
}: GanttLaunchMarkerProps) {
  if (x < 0) return null;

  const label = format(parseISO(launchDate), "dd MMM", { locale: idLocale });

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: x, top: y, height, zIndex: 15 }}
    >
      {/* Vertical dashed line */}
      <div
        className="absolute top-0 w-0.5 h-full"
        style={{
          background:
            "repeating-linear-gradient(to bottom, #10b981 0px, #10b981 4px, transparent 4px, transparent 8px)",
        }}
      />
      {/* Label badge — positioned inside the row, at the top */}
      <div className="absolute top-0 left-1 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-0.5">
        <span>🚀</span>
        <span>{label}</span>
        {isManualOverride && (
          <span className="opacity-70" title="Manual override">
            ✏️
          </span>
        )}
      </div>
    </div>
  );
}
