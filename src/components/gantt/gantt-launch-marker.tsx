"use client";

import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Pencil, Rocket } from "lucide-react";

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
        className="absolute top-0 w-px h-full"
        style={{
          background:
            "repeating-linear-gradient(to bottom, var(--success-fill) 0px, var(--success-fill) 4px, transparent 4px, transparent 8px)",
        }}
      />
      {/* Badge label. Pola chip baku: latar -soft + teks token penuh, sama
          seperti statusConfig.green. */}
      <div className="num absolute top-0 left-1 flex items-center gap-1 rounded-sm bg-success-soft px-1.5 text-xs leading-5 text-success whitespace-nowrap">
        <Rocket aria-hidden className="size-3" />
        <span>{label}</span>
        {isManualOverride && (
          <Pencil role="img" aria-label="Manual override" className="size-3" />
        )}
      </div>
    </div>
  );
}
