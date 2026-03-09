"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineProgressLog } from "@/components/timeline-progress-log";
import { TimelineRiskAssessment } from "@/components/timeline/timeline-risk-assessment";
import { fetchProjectLogs } from "@/lib/actions/timeline";
import type { TimelineProject, TimelineProjectLog } from "@/lib/db/schema";

interface GanttLogPanelProps {
  project: TimelineProject;
  onClose: () => void;
}

export function GanttLogPanel({ project, onClose }: GanttLogPanelProps) {
  const [logs, setLogs] = useState<TimelineProjectLog[]>([]);

  useEffect(() => {
    fetchProjectLogs(project.id).then(setLogs);
  }, [project.id]);

  return (
    <div className="fixed inset-y-0 right-0 w-[360px] bg-background border-l shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{project.name}</h3>
          <p className="text-xs text-muted-foreground">Progress Log</p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
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
    </div>
  );
}
