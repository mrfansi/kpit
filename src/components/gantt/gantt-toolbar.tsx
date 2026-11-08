"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./gantt-types";

interface GanttToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPan: (direction: "left" | "right") => void;
  onJumpToToday: () => void;
  canEdit: boolean;
  onAddProject?: () => void;
}

const viewModes: { value: ViewMode; label: string }[] = [
  { value: "week", label: "Minggu" },
  { value: "month", label: "Bulan" },
];

export function GanttToolbar({
  viewMode,
  onViewModeChange,
  onPan,
  onJumpToToday,
  canEdit,
  onAddProject,
}: GanttToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b bg-background px-4 py-4 lg:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>

        {/* Pilihan skala, bukan aksi: terpilih = permukaan tinta tipis, bukan isian primary. */}
        <div role="group" aria-label="Skala" className="flex h-8 overflow-hidden rounded-md border">
          {viewModes.map((mode) => (
            <button
              type="button"
              key={mode.value}
              aria-pressed={viewMode === mode.value}
              onClick={() => onViewModeChange(mode.value)}
              className={cn(
                "px-3 text-sm transition-colors duration-[var(--dur-micro)]",
                viewMode === mode.value
                  ? "bg-secondary font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Geser ke kiri"
            onClick={() => onPan("left")}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onJumpToToday}>
            <CalendarDays aria-hidden />
            Hari ini
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Geser ke kanan"
            onClick={() => onPan("right")}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/timeline/report" target="_blank">
            <FileText aria-hidden />
            Laporan
          </Link>
        </Button>
        {canEdit && (
          <Button type="button" size="sm" onClick={onAddProject}>
            <Plus aria-hidden />
            Tambah project
          </Button>
        )}
      </div>
    </div>
  );
}
