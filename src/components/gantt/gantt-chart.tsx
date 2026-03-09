"use client";

import { useState, useRef, useCallback, useTransition, useMemo, useEffect } from "react";
import {
  addDays,
  parseISO,
  format,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { computeGanttLayout } from "@/lib/gantt-layout";
import type { TimelineProject, TimelineProjectStatus } from "@/lib/db/schema";
import {
  type ViewMode,
  type DragMode,
  VIEW_MODE_CONFIG,
  ROW_HEIGHT,
  HEADER_HEIGHT,
  ROW_LIST_WIDTH,
} from "./gantt-types";
import { GanttToolbar } from "./gantt-toolbar";
import { GanttHeader } from "./gantt-header";
import { GanttGrid } from "./gantt-grid";
import { GanttTodayLine } from "./gantt-today-line";
import { GanttLaunchMarker } from "./gantt-launch-marker";
import { getEffectiveLaunchDate, isManualLaunchDate } from "@/lib/launch-date";
import { TimelineProjectFormDialog } from "@/components/timeline-project-form";
import { updateProjectDates } from "@/lib/actions/timeline";
import { CalendarDays, ClipboardList, FolderOpen, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { GanttLogPanel } from "./gantt-log-panel";

interface GanttChartProps {
  projects: TimelineProject[];
  statuses: TimelineProjectStatus[];
  isAuthenticated: boolean;
}

export function GanttChart({
  projects: initialProjects,
  statuses,
  isAuthenticated,
}: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [panOffset, setPanOffset] = useState(0);
  const [localProjects, setLocalProjects] = useState(initialProjects);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<TimelineProject | null>(null);
  const [logPanelProject, setLogPanelProject] = useState<TimelineProject | null>(null);

  // Drag state
  const [dragState, setDragState] = useState<{
    projectId: number;
    mode: DragMode;
    startX: number;
    currentX: number;
  } | null>(null);

  // Sync when props change
  useEffect(() => setLocalProjects(initialProjects), [initialProjects]);

  // Compute layout
  const layout = useMemo(
    () => computeGanttLayout(localProjects, viewMode, panOffset),
    [viewMode, localProjects, panOffset]
  );

  // Pan
  const handlePan = useCallback(
    (direction: "left" | "right") => {
      const days =
        direction === "left"
          ? -VIEW_MODE_CONFIG[viewMode].unitDays * 3
          : VIEW_MODE_CONFIG[viewMode].unitDays * 3;
      setPanOffset((prev) => prev + days);
    },
    [viewMode]
  );

  // Drag handlers
  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, projectId: number, mode: DragMode) => {
      if (!isAuthenticated) return;
      e.preventDefault();
      e.stopPropagation();
      setDragState({ projectId, mode, startX: e.clientX, currentX: e.clientX });

      const handleMouseMove = (ev: MouseEvent) => {
        setDragState((prev) =>
          prev ? { ...prev, currentX: ev.clientX } : null
        );
      };

      const handleMouseUp = (ev: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Read drag state and clear it
        let captured: typeof dragState = null;
        setDragState((prev) => {
          captured = prev;
          return null;
        });

        // Process outside of state updater to avoid "startTransition while rendering"
        requestAnimationFrame(() => {
          if (!captured) return;
          const drag = captured;
          const deltaX = ev.clientX - drag.startX;
          const config = VIEW_MODE_CONFIG[viewMode];
          const dayDelta = Math.round(
            (deltaX / config.colWidth) * config.unitDays
          );
          if (dayDelta === 0) return;

          const project = localProjects.find((p) => p.id === drag.projectId);
          if (!project) return;

          let newStart = project.startDate;
          let newEnd = project.endDate;

          if (drag.mode === "move") {
            newStart = format(addDays(parseISO(project.startDate), dayDelta), "yyyy-MM-dd");
            newEnd = format(addDays(parseISO(project.endDate), dayDelta), "yyyy-MM-dd");
          } else if (drag.mode === "resize-start") {
            const candidate = format(addDays(parseISO(project.startDate), dayDelta), "yyyy-MM-dd");
            newStart = candidate < project.endDate ? candidate : project.startDate;
          } else if (drag.mode === "resize-end") {
            const candidate = format(addDays(parseISO(project.endDate), dayDelta), "yyyy-MM-dd");
            newEnd = candidate > project.startDate ? candidate : project.endDate;
          }

          setLocalProjects((prevProjects) =>
            prevProjects.map((p) =>
              p.id === drag.projectId ? { ...p, startDate: newStart, endDate: newEnd } : p
            )
          );

          startTransition(() => {
            updateProjectDates(drag.projectId, newStart, newEnd);
          });
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [isAuthenticated, localProjects, viewMode]
  );

  // Empty state
  if (initialProjects.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <GanttToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onPan={handlePan}
          onJumpToToday={() => setPanOffset(0)}
          isAuthenticated={isAuthenticated}
          onAddProject={() => { setEditingProject(null); setProjectDialogOpen(true); }}
        />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <CalendarDays className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm">Belum ada project.</p>
            {isAuthenticated && (
              <p className="text-xs">
                Klik &quot;+ Project&quot; untuk memulai.
              </p>
            )}
          </div>
        </div>
        <TimelineProjectFormDialog
          open={projectDialogOpen}
          onOpenChange={(open) => {
            setProjectDialogOpen(open);
            if (!open) setEditingProject(null);
          }}
          project={editingProject}
          statuses={statuses}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <GanttToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPan={handlePan}
        onJumpToToday={() => setPanOffset(0)}
        isAuthenticated={isAuthenticated}
        onAddProject={() => { setEditingProject(null); setProjectDialogOpen(true); }}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: project names */}
        <div
          className="shrink-0 border-r bg-background z-30"
          style={{ width: ROW_LIST_WIDTH }}
        >
          <div
            className="sticky top-0 z-10 border-b bg-background flex items-center px-3"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projects
            </span>
          </div>
          <div>
            {localProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-2.5 px-3 border-b hover:bg-accent/50 transition-colors group/row"
                style={{ height: ROW_HEIGHT }}
              >
                <FolderOpen
                  className="w-4 h-4 shrink-0"
                  style={{ color: project.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium truncate min-w-0">
                      {project.name}
                    </span>
                    {(() => {
                      const status = statuses.find((s) => s.id === project.statusId);
                      if (!status) return null;
                      return (
                        <span
                          className="shrink-0 text-[8px] font-medium px-1 py-px rounded"
                          style={{ backgroundColor: `${status.color}20`, color: status.color }}
                        >
                          {status.name}
                        </span>
                      );
                    })()}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {project.startDate} — {project.endDate}
                  </span>
                  <span className="text-[10px] text-emerald-600 truncate block">
                    🚀 {format(parseISO(getEffectiveLaunchDate(project)), "dd MMM yyyy", { locale: idLocale })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {project.progress}%
                  </span>
                  {isAuthenticated && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
                        onClick={() => setLogPanelProject(project)}
                        title="Progress Log"
                      >
                        <ClipboardList className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
                        onClick={() => {
                          setEditingProject(project);
                          setProjectDialogOpen(true);
                        }}
                        title="Edit project"
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: scrollable canvas */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div style={{ width: layout.totalWidth, minHeight: "100%" }}>
            <GanttHeader columns={layout.columns} totalWidth={layout.totalWidth} />

            <div className="relative" style={{ height: layout.totalHeight }}>
              <GanttGrid
                columns={layout.columns}
                totalHeight={layout.totalHeight}
              />
              <GanttTodayLine
                x={layout.dateToX(format(new Date(), "yyyy-MM-dd"))}
                totalHeight={layout.totalHeight}
              />

              {/* Project bars */}
              {localProjects.map((project, rowIndex) => {
                const x = layout.dateToX(project.startDate);
                const xEnd = layout.dateToX(project.endDate);
                const barWidth = Math.max(xEnd - x + layout.config.colWidth * 0.15, 24);
                const y = rowIndex * ROW_HEIGHT + 8;
                const barHeight = ROW_HEIGHT - 16;

                const status = statuses.find((s) => s.id === project.statusId);
                const barColor = project.color;
                const isNotStarted = status?.slug === "not_started";
                const isOnHold = status?.slug === "on_hold";

                const isDragging = dragState?.projectId === project.id;
                const deltaX = isDragging
                  ? dragState!.currentX - dragState!.startX
                  : 0;

                let adjustedX = x;
                let adjustedWidth = barWidth;
                if (isDragging && dragState!.mode === "move") {
                  adjustedX += deltaX;
                } else if (isDragging && dragState!.mode === "resize-start") {
                  adjustedX += deltaX;
                  adjustedWidth -= deltaX;
                } else if (isDragging && dragState!.mode === "resize-end") {
                  adjustedWidth += deltaX;
                }
                adjustedWidth = Math.max(adjustedWidth, 24);

                return (
                  <div
                    key={project.id}
                    className={cn(
                      "absolute rounded-lg shadow-sm group transition-shadow",
                      isDragging && "shadow-lg ring-2 ring-primary/30 z-50"
                    )}
                    style={{
                      left: adjustedX,
                      top: y,
                      width: adjustedWidth,
                      height: barHeight,
                      backgroundColor: `${barColor}20`,
                      border: `2px ${isNotStarted ? "dashed" : "solid"} ${barColor}`,
                      opacity: 1,
                    }}
                  >
                    {/* Progress fill */}
                    <div
                      className="absolute inset-0 rounded-md pointer-events-none"
                      style={{
                        width: `${project.progress}%`,
                        backgroundColor: `${barColor}35`,
                      }}
                    />

                    {/* Project name + date labels */}
                    <div className="absolute inset-0 flex flex-col justify-center px-2.5 pointer-events-none overflow-hidden">
                      <span className="text-xs font-medium truncate text-foreground leading-tight">
                        {project.name}
                      </span>
                      {adjustedWidth > 120 && (
                        <span className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                          {format(parseISO(project.startDate), "dd MMM", { locale: idLocale })}
                          {" — "}
                          {format(parseISO(project.endDate), "dd MMM", { locale: idLocale })}
                        </span>
                      )}
                    </div>

                    {/* Move handle (rendered first, lowest z) */}
                    <div
                      className="absolute inset-0 cursor-grab active:cursor-grabbing z-10"
                      onMouseDown={(e) =>
                        handleBarMouseDown(e, project.id, "move")
                      }
                    />

                    {/* Left resize handle (higher z, overlaps move handle) */}
                    <div
                      className="absolute left-0 top-0 w-3 h-full cursor-ew-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={(e) =>
                        handleBarMouseDown(e, project.id, "resize-start")
                      }
                    >
                      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded bg-foreground/40" />
                    </div>

                    {/* Right resize handle (higher z, overlaps move handle) */}
                    <div
                      className="absolute right-0 top-0 w-3 h-full cursor-ew-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={(e) =>
                        handleBarMouseDown(e, project.id, "resize-end")
                      }
                    >
                      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded bg-foreground/40" />
                    </div>
                  </div>
                );
              })}

              {/* Launch markers */}
              {localProjects.map((project, rowIndex) => {
                const launchDate = getEffectiveLaunchDate(project);
                const launchX = layout.dateToX(launchDate);
                const y = rowIndex * ROW_HEIGHT + 8;
                const markerHeight = ROW_HEIGHT - 16;

                return (
                  <GanttLaunchMarker
                    key={`launch-${project.id}`}
                    x={launchX}
                    y={y}
                    height={markerHeight}
                    launchDate={launchDate}
                    isManualOverride={isManualLaunchDate(project)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <TimelineProjectFormDialog
        open={projectDialogOpen}
        onOpenChange={(open) => {
          setProjectDialogOpen(open);
          if (!open) setEditingProject(null);
        }}
        project={editingProject}
        statuses={statuses}
      />

      {logPanelProject && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setLogPanelProject(null)}
          />
          <GanttLogPanel
            project={logPanelProject}
            onClose={() => setLogPanelProject(null)}
          />
        </>
      )}
    </div>
  );
}
