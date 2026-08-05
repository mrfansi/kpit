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
      {/* Garis putus-putus vertikal. Ini isian grafis, jadi --success-fill —
          --success adalah token TEKS yang sengaja digelapkan untuk kontras 4.5:1
          dan terlihat kusam sebagai garis. */}
      <div
        className="absolute top-0 w-0.5 h-full"
        style={{
          background:
            "repeating-linear-gradient(to bottom, var(--success-fill) 0px, var(--success-fill) 4px, transparent 4px, transparent 8px)",
        }}
      />
      {/* Badge label. Pola chip baku: latar -soft + teks token penuh, sama
          seperti statusConfig.green. Sebelumnya bg-success + text-white — putih
          di atas token teks, dan di dark mode --success naik ke oklch 0.76
          sehingga labelnya nyaris hilang. */}
      <div className="absolute top-0 left-1 bg-success-soft text-success text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-0.5">
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
