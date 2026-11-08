"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { TimelineProject, TimelineProjectStatus } from "@/lib/db/schema";
import { computeGanttLayout } from "@/lib/gantt-layout";
import { getEffectiveLaunchDate, isManualLaunchDate } from "@/lib/launch-date";
import { GanttHeader } from "@/components/gantt/gantt-header";
import { GanttGrid } from "@/components/gantt/gantt-grid";
import { GanttTodayLine } from "@/components/gantt/gantt-today-line";
import { GanttLaunchMarker } from "@/components/gantt/gantt-launch-marker";
import { ROW_HEIGHT } from "@/components/gantt/gantt-types";

interface ReportGanttProps {
  projects: TimelineProject[];
  statuses: TimelineProjectStatus[];
}

export function ReportGantt({ projects, statuses }: ReportGanttProps) {
  const layout = useMemo(
    () => computeGanttLayout(projects, "month", 0),
    [projects]
  );

  if (projects.length === 0) return null;

  return (
    <section aria-labelledby="report-gantt-heading" className="space-y-3">
      <h2 id="report-gantt-heading" className="text-lg font-semibold">Timeline Gantt Chart</h2>
      <div className="overflow-x-auto border-y">
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
              const y = rowIndex * ROW_HEIGHT + 4;
              const barHeight = ROW_HEIGHT - 8;

              const status = statuses.find((s) => s.id === project.statusId);
              const barColor = project.color;
              const isNotStarted = status?.slug === "not_started";
              return (
                <div
                  key={project.id}
                  className="absolute rounded-sm"
                  style={{
                    left: x,
                    top: y,
                    width: barWidth,
                    height: barHeight,
                    backgroundColor: `${barColor}20`,
                    border: `1px ${isNotStarted ? "dashed" : "solid"} ${barColor}`,
                    opacity: 1,
                  }}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute inset-y-0 left-0 pointer-events-none"
                    style={{
                      width: `${project.progress}%`,
                      backgroundColor: `${barColor}35`,
                    }}
                  />

                  {/* Nama + rentang tanggal. Tooltip hover lama (progress, tanggal, launch)
                      tersembunyi secara default dan isinya sudah ada di tabel Executive
                      Summary di atas, jadi dihapus agar tidak ada teks tersembunyi. */}
                  <div className="absolute inset-0 flex flex-col justify-center px-2.5 overflow-hidden">
                    <span className="text-xs font-semibold truncate text-foreground leading-4">
                      {project.name}
                    </span>
                    {barWidth > 120 && (
                      <span className="num text-xs text-ink-2 leading-4 truncate">
                        {format(parseISO(project.startDate), "dd MMM", { locale: idLocale })}
                        {" - "}
                        {format(parseISO(project.endDate), "dd MMM", { locale: idLocale })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Launch markers */}
            {projects.map((project, rowIndex) => {
              const launchDate = getEffectiveLaunchDate(project);
              const launchX = layout.dateToX(launchDate);
              const y = rowIndex * ROW_HEIGHT + 4;
              const markerHeight = ROW_HEIGHT - 8;

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
    </section>
  );
}
