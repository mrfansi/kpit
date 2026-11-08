"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TimelineProgressLog } from "@/components/timeline-progress-log";
import { TimelineRiskAssessment } from "@/components/timeline/timeline-risk-assessment";
import { fetchProjectLogs } from "@/lib/actions/timeline";
import type { TimelineProject, TimelineProjectLog } from "@/lib/db/schema";

interface GanttLogPanelProps {
  project: TimelineProject;
  onClose: () => void;
}

export function GanttLogPanel({ project, onClose }: GanttLogPanelProps) {
  // null = masih fetch. Dibedakan dari [] supaya panel tidak sempat menampilkan
  // "belum ada log" untuk proyek yang sebenarnya punya log.
  const [logs, setLogs] = useState<TimelineProjectLog[] | null>(null);

  useEffect(() => {
    fetchProjectLogs(project.id).then(setLogs);
  }, [project.id]);

  // Full-width di mobile: sisa backdrop di layar sempit terlalu tipis untuk
  // jadi target tap-to-close yang andal, jadi penutupan mengandalkan tombol X
  // eksplisit di bawah, bukan tap di luar panel.
  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[360px] bg-background border-l z-50 flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 py-4 border-b">
        <div className="min-w-0">
          <h3 className="text-base font-semibold truncate">{project.name}</h3>
          <p className="text-sm text-muted-foreground">Progress Log</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Tutup" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {logs === null ? (
          <div aria-busy="true" className="space-y-4">
            <p className="text-sm text-muted-foreground">Memuat progress log…</p>
            <Skeleton className="h-8 w-32 motion-reduce:animate-none" />
            <Skeleton className="h-16 w-full motion-reduce:animate-none" />
            <Skeleton className="h-12 w-full motion-reduce:animate-none" />
          </div>
        ) : (
          <div className="space-y-8">
            <TimelineRiskAssessment
              projectName={project.name}
              description={project.description || ""}
              status={project.statusId ? String(project.statusId) : ""}
              startDate={project.startDate}
              endDate={project.endDate}
              estimatedLaunchDate={project.estimatedLaunchDate}
              launchBufferDays={project.launchBufferDays}
              progress={project.progress}
              logs={logs.map((l) => ({
                date: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
                progressBefore: l.progressBefore ?? 0,
                progressAfter: l.progressAfter ?? 0,
                content: l.content,
              }))}
            />
            <TimelineProgressLog
              projectId={project.id}
              currentProgress={project.progress}
              initialLogs={logs}
            />
          </div>
        )}
      </div>
    </div>
  );
}
