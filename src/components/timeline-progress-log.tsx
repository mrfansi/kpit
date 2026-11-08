"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createProgressLog, deleteProgressLog } from "@/lib/actions/timeline";
import type { TimelineProjectLog } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
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
  // initialLogs hanya dibaca sekali. Pemanggil yang datanya datang async wajib
  // menunda render sampai data siap (lihat GanttLogPanel), bukan menyinkronkan
  // prop ke state lewat effect.
  const [logs, setLogs] = useState<TimelineProjectLog[]>(initialLogs);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

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
      <h4 className="text-base font-semibold">Progress Log</h4>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tulis update progress…"
          aria-label="Update progress"
          disabled={isPending}
          rows={2}
          className="resize-none"
        />
        <Button type="submit" size="icon" aria-label="Kirim" className="shrink-0 self-end" disabled={isPending || !text.trim()}>
          <Send aria-hidden />
        </Button>
      </form>

      {/* Timeline List */}
      {logs.length === 0 ? (
        <EmptyState compact title="Belum ada progress log." />
      ) : (
        <div className="pr-1">
          <div className="relative" style={{ paddingLeft: 28 }}>
            {/* Vertical line - centered at 11px from left */}
            <div className="absolute top-2 bottom-2 w-px bg-border" style={{ left: 11 }} />

            {logs.map((log, i) => (
              <div key={log.id} className="relative pb-6 last:pb-0 group">
                {/* Simpul persegi 10px, berpusat di garis pada 11px: 11 - 5 = 6 */}
                <div className="absolute z-10" style={{ left: -22, top: 5 }}>
                  <div
                    className={`size-2.5 rounded-sm border ${i === 0 ? "bg-foreground border-foreground" : "bg-background border-edge"}`}
                  />
                </div>

                {/* Content */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="num text-xs text-muted-foreground">
                      {formatDateTime(new Date(log.createdAt))}
                    </span>
                    {log.progressBefore != null && log.progressAfter != null && (
                      <span className="num inline-flex items-center gap-1 rounded-sm bg-secondary px-1.5 text-xs leading-5 text-foreground">
                        {log.progressBefore}%
                        <ArrowRight aria-hidden className="size-3" />
                        {log.progressAfter}%
                      </span>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Hapus log"
                          className="ml-auto shrink-0 text-muted-foreground hover:text-destructive opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                          disabled={isPending}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus log ini?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Log &quot;{log.content.length > 60 ? `${log.content.slice(0, 60)}…` : log.content}&quot; akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => handleDelete(log.id)}>
                            Ya, hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">{log.author}</p>
                  <p className="mt-0.5 max-w-[65ch] text-base text-foreground whitespace-pre-wrap">{log.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
