"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./gantt-types";

interface GanttToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPan: (direction: "left" | "right") => void;
  onJumpToToday: () => void;
  isAuthenticated: boolean;
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
  isAuthenticated,
  onAddProject,
}: GanttToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold mr-2">Timeline</h1>

        <div className="flex rounded-md border overflow-hidden">
          {viewModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => onViewModeChange(mode.value)}
              className={cn(
                "px-2.5 py-1 text-xs transition-colors",
                viewMode === mode.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPan("left")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onJumpToToday}
          >
            <CalendarDays className="w-3.5 h-3.5 mr-1" />
            Hari ini
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPan("right")}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isAuthenticated && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onAddProject}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Project
        </Button>
      )}
    </div>
  );
}
