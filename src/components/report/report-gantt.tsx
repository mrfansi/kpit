"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { TimelineProject } from "@/lib/db/schema";
import { computeGanttLayout } from "@/lib/gantt-layout";
import { getEffectiveLaunchDate, isManualLaunchDate } from "@/lib/launch-date";
import { GanttHeader } from "@/components/gantt/gantt-header";
import { GanttGrid } from "@/components/gantt/gantt-grid";
import { GanttTodayLine } from "@/components/gantt/gantt-today-line";
import { GanttLaunchMarker } from "@/components/gantt/gantt-launch-marker";
import { ROW_HEIGHT } from "@/components/gantt/gantt-types";

interface ReportGanttProps {
  projects: TimelineProject[];
}

export function ReportGantt({ projects }: ReportGanttProps) {
  const layout = useMemo(
    () => computeGanttLayout(projects, "month", 0),
    [projects]
  );

  if (projects.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Timeline Gantt Chart</h2>
      <div className="border rounded-lg overflow-auto">
        <div style={{ width: layout.totalWidth, minHeight: "100%" }}>
          <GanttHeader columns={layout.columns} totalWidth={layout.totalWidth} />

          <div className="relative" style={{ height: layout.totalHeight }}>
            <GanttGrid columns={layout.columns} totalHeight={layout.totalHeight} />
            <GanttTodayLine
              x={layout.dateToX(format(new Date(), "yyyy-MM-dd"))}
              totalHeight={layout.totalHeight}
            />

            {/* Project bars - read only, no drag */}
            {projects.map((project, rowIndex) => {
              const x = layout.dateToX(project.startDate);
              const xEnd = layout.dateToX(project.endDate);
              const barWidth = Math.max(xEnd - x + layout.config.colWidth * 0.15, 24);
              const y = rowIndex * ROW_HEIGHT + 8;
              const barHeight = ROW_HEIGHT - 16;

              return (
                <div
                  key={project.id}
                  className="absolute rounded-lg shadow-sm group"
                  style={{
                    left: x,
                    top: y,
                    width: barWidth,
                    height: barHeight,
                    backgroundColor: `${project.color}20`,
                    border: `2px solid ${project.color}`,
                  }}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute inset-0 rounded-md pointer-events-none"
                    style={{
                      width: `${project.progress}%`,
                      backgroundColor: `${project.color}35`,
                    }}
                  />

                  {/* Project name */}
                  <div className="absolute inset-0 flex items-center px-2.5">
                    <span className="text-xs font-medium truncate text-foreground">
                      {project.name}
                    </span>
                  </div>

                  {/* Hover tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-muted-foreground mt-1">
                        Progress: {project.progress}%
                      </p>
                      <p className="text-muted-foreground">
                        {format(parseISO(project.startDate), "dd MMM yy", { locale: idLocale })}
                        {" — "}
                        {format(parseISO(project.endDate), "dd MMM yy", { locale: idLocale })}
                      </p>
                      <p className="text-emerald-600">
                        Launch: {format(parseISO(getEffectiveLaunchDate(project)), "dd MMM yy", { locale: idLocale })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Launch markers */}
            {projects.map((project, rowIndex) => {
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
  );
}
