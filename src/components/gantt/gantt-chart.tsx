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
import { ClipboardList, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { GanttLogPanel } from "./gantt-log-panel";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";

interface GanttChartProps {
  projects: TimelineProject[];
  statuses: TimelineProjectStatus[];
  canEdit: boolean;
  /** Analisis risiko terbuka untuk semua pengguna login, bukan hanya admin. */
  signedIn: boolean;
}

export function GanttChart({
  projects: initialProjects,
  statuses,
  canEdit,
  signedIn,
}: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [panOffset, setPanOffset] = useState(0);
  const [localProjects, setLocalProjects] = useState(initialProjects);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<TimelineProject | null>(null);
  const [logPanelProject, setLogPanelProject] = useState<TimelineProject | null>(null);
  const [listWidth, setListWidth] = useState(ROW_LIST_WIDTH);

  // Drag state
  const [dragState, setDragState] = useState<{
    projectId: number;
    mode: DragMode;
    startX: number;
    currentX: number;
  } | null>(null);

  /*
   * `localProjects` hanya ada untuk umpan balik optimistis saat bar digeser:
   * bar harus pindah di detik yang sama dengan mouse, jauh sebelum server
   * menjawab. Konsekuensinya seluruh Gantt -- nama, status, warna, deskripsi --
   * ikut dirender dari salinan lokal itu.
   *
   * Begitu server mengirim data baru (revalidatePath setelah simpan atau
   * hapus), salinan lokal harus menyerah pada kebenaran server. Tanpa ini,
   * hasil edit dari dialog baru muncul setelah refresh manual.
   *
   * Ini pola resmi React untuk menyesuaikan state ketika prop berubah:
   * bandingkan prop sebelumnya saat render. useEffect akan menambah satu paint
   * berisi data basi lebih dulu, dan prop identity hanya berubah saat payload
   * server benar-benar diperbarui -- bukan tiap kali state klien berubah.
   */
  const [syncedProjects, setSyncedProjects] = useState(initialProjects);
  if (syncedProjects !== initialProjects) {
    setSyncedProjects(initialProjects);
    setLocalProjects(initialProjects);
  }

  // Compute layout
  const layout = useMemo(
    () => computeGanttLayout(localProjects, viewMode, panOffset),
    [viewMode, localProjects, panOffset]
  );

  // Pusatkan hari ini saat mount dan tiap "Hari ini"; tick memaksa efek jalan walau panOffset sudah 0.
  const [todayTick, setTodayTick] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const x = layout.dateToX(format(new Date(), "yyyy-MM-dd"));
    el.scrollTo({ left: x - el.clientWidth / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat tick; layout berubah saat drag tidak boleh menggeser scroll
  }, [todayTick]);

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
      if (!canEdit) return;
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

          const previousDates = { startDate: project.startDate, endDate: project.endDate };

          setLocalProjects((prevProjects) =>
            prevProjects.map((p) =>
              p.id === drag.projectId ? { ...p, startDate: newStart, endDate: newEnd } : p
            )
          );

          startTransition(async () => {
            try {
              const result = await updateProjectDates(drag.projectId, newStart, newEnd);
              if (result?.error) throw new Error(result.error);
            } catch (error) {
              // Server menolak (mis. tanggal tidak valid) — kembalikan bar ke posisi
              // semula, jangan biarkan UI menampilkan jadwal yang tidak tersimpan.
              setLocalProjects((prevProjects) =>
                prevProjects.map((p) =>
                  p.id === drag.projectId ? { ...p, ...previousDates } : p
                )
              );
              toast.error(error instanceof Error ? error.message : "Gagal memperbarui jadwal project");
            }
          });
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [canEdit, localProjects, viewMode]
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
          canEdit={canEdit}
          onAddProject={() => { setEditingProject(null); setProjectDialogOpen(true); }}
        />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Belum ada project."
            description={canEdit ? 'Klik "+ Project" untuk memulai.' : undefined}
          />
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
        onJumpToToday={() => { setPanOffset(0); setTodayTick((t) => t + 1); }}
        canEdit={canEdit}
        onAddProject={() => { setEditingProject(null); setProjectDialogOpen(true); }}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: project names */}
        <div
          className="shrink-0 bg-background z-30 overflow-hidden max-sm:max-w-[140px]"
          style={{ width: listWidth }}
        >
          {/* Tidak sticky: panel kiri overflow-hidden dan tidak pernah bergulir sendiri,
              jadi sticky di sini tidak berbuat apa-apa selain menumpuk dengan kepala Gantt. */}
          <div
            className="border-b bg-background flex items-center px-3"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-sm text-muted-foreground">Daftar project</span>
          </div>
          <div>
            {localProjects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col justify-center px-3 border-b hover:bg-paper-2 transition-colors duration-[var(--dur-micro)] group/row"
                style={{ height: ROW_HEIGHT }}
              >
                <div className="flex items-center gap-2">
                  {/* Warna identitas project dari DB, sebagai kunci kecil persegi. */}
                  <span
                    aria-hidden
                    className="size-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-sm font-semibold truncate flex-1 min-w-0">
                    {project.name}
                  </span>
                  {canEdit && (
                    // Tanpa lg: tombol permanen terlihat di mobile/tablet — hover tidak ada di layar sentuh.
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Progress Log ${project.name}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-100 lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100 transition-[opacity,color,background-color] duration-[var(--dur-micro)] hover:bg-accent hover:text-foreground"
                        onClick={() => setLogPanelProject(project)}
                        title="Progress Log"
                      >
                        <ClipboardList aria-hidden className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Ubah project ${project.name}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-100 lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100 transition-[opacity,color,background-color] duration-[var(--dur-micro)] hover:bg-accent hover:text-foreground"
                        onClick={() => {
                          setEditingProject(project);
                          setProjectDialogOpen(true);
                        }}
                        title="Ubah project"
                      >
                        <Pencil aria-hidden className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 pl-[18px]">
                  {(() => {
                    const status = statuses.find((s) => s.id === project.statusId);
                    if (!status) return null;
                    // Warna status dari DB hanya sebagai latar tipis; teks tetap tinta supaya lolos 4.5:1.
                    return (
                      <span
                        className="text-xs leading-4 px-1 rounded-sm shrink-0 text-foreground"
                        style={{ backgroundColor: `${status.color}26` }}
                      >
                        {status.name}
                      </span>
                    );
                  })()}
                  {/* Gauge persegi, tanpa animasi lebar. */}
                  <div className="flex-1 h-1.5 bg-secondary overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${project.progress}%`, backgroundColor: project.color }}
                    />
                  </div>
                  <span className="num text-xs text-muted-foreground shrink-0">
                    {project.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resize handle */}
        <div
          className="shrink-0 w-1 cursor-col-resize bg-border hover:bg-edge active:bg-foreground transition-colors duration-[var(--dur-micro)] z-30"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = listWidth;
            const onMove = (ev: MouseEvent) => {
              const newWidth = Math.max(180, Math.min(500, startWidth + ev.clientX - startX));
              setListWidth(newWidth);
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
        />

        {/* Right panel: scrollable canvas */}
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label="Linimasa project"
          className="flex-1 overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
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
                const y = rowIndex * ROW_HEIGHT + 4;
                const barHeight = ROW_HEIGHT - 8;

                const status = statuses.find((s) => s.id === project.statusId);
                const barColor = project.color;
                const isNotStarted = status?.slug === "not_started";
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
                      "absolute rounded-sm group",
                      isDragging && "ring-2 ring-foreground/30 z-50"
                    )}
                    style={{
                      left: adjustedX,
                      top: y,
                      width: adjustedWidth,
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

                    {/* Project name + date labels */}
                    <div className="absolute inset-0 flex flex-col justify-center px-2.5 pointer-events-none overflow-hidden">
                      <span className="text-xs font-semibold truncate text-foreground leading-4">
                        {project.name}
                      </span>
                      {adjustedWidth > 120 && (
                        <span className="num text-xs text-ink-2 leading-4 truncate">
                          {format(parseISO(project.startDate), "dd MMM", { locale: idLocale })}
                          {" - "}
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
            key={logPanelProject.id}
            project={logPanelProject}
            signedIn={signedIn}
            onClose={() => setLogPanelProject(null)}
          />
        </>
      )}
    </div>
  );
}
