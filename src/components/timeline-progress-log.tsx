"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { createProgressLog, deleteProgressLog } from "@/lib/actions/timeline";
import type { TimelineProjectLog } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Send, ArrowRight } from "lucide-react";

interface TimelineProgressLogProps {
  projectId: number;
  currentProgress: number;
  initialLogs: TimelineProjectLog[];
}

function formatDateTime(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TimelineProgressLog({
  projectId,
  currentProgress,
  initialLogs,
}: TimelineProgressLogProps) {
  const [logs, setLogs] = useState<TimelineProjectLog[]>(initialLogs);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  // Sync when initialLogs changes (e.g. after re-fetch)
  useEffect(() => setLogs(initialLogs), [initialLogs]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      try {
        await createProgressLog(projectId, text.trim(), currentProgress, currentProgress);
        setLogs((prev) => [
          {
            id: Date.now(),
            projectId,
            content: text.trim(),
            progressBefore: currentProgress,
            progressAfter: currentProgress,
            author: "Admin",
            createdAt: new Date(),
          },
          ...prev,
        ]);
        setText("");
        toast.success("Log ditambahkan");
      } catch {
        toast.error("Gagal menambahkan log");
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteProgressLog(id);
        setLogs((prev) => prev.filter((l) => l.id !== id));
        toast.success("Log dihapus");
      } catch {
        toast.error("Gagal menghapus log");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Progress Log</div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tulis update progress..."
          disabled={isPending}
          rows={2}
          className="resize-none text-sm"
        />
        <Button type="submit" size="icon" className="shrink-0 self-end" disabled={isPending || !text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* Timeline List */}
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Belum ada progress log.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto pr-1">
          <div className="relative" style={{ paddingLeft: 28 }}>
            {/* Vertical line - centered at 11px from left */}
            <div className="absolute top-2 bottom-2 w-px bg-border" style={{ left: 11 }} />

            {logs.map((log, i) => (
              <div key={log.id} className="relative pb-5 last:pb-0 group">
                {/* Dot - 12px wide, centered on line at 11px: 11 - 6 = 5 */}
                <div className="absolute z-10" style={{ left: -23, top: 4 }}>
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${i === 0 ? "bg-primary border-primary" : "bg-background border-border"}`}
                  />
                </div>

                {/* Content */}
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(new Date(log.createdAt))}
                    </span>
                    {log.progressBefore != null && log.progressAfter != null && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                        {log.progressBefore}%
                        <ArrowRight className="w-2.5 h-2.5" />
                        {log.progressAfter}%
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto"
                      onClick={() => handleDelete(log.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-xs font-semibold text-foreground">{log.author}</span>
                  </div>
                  <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{log.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
