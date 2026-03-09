"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createComment, deleteComment } from "@/lib/actions/comment";
import type { KPIComment } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MessageCircle, Trash2, Send } from "lucide-react";
import { isEmptyHtml, sanitizeHtmlClient } from "@/lib/html-utils";

interface Period {
  value: string;
  label: string;
}

interface KPICommentsProps {
  kpiId: number;
  periodDate: string;
  periodLabel: string;
  initialComments: KPIComment[];
  availablePeriods?: Period[];
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function KPIComments({ kpiId, periodDate, periodLabel, initialComments, availablePeriods = [] }: KPICommentsProps) {
  const [comments, setComments] = useState<KPIComment[]>(initialComments);
  const [selectedPeriod, setSelectedPeriod] = useState(periodDate);
  const [html, setHtml] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const currentPeriodLabel = availablePeriods.find((p) => p.value === selectedPeriod)?.label ?? periodLabel;
  const visibleComments = comments.filter((c) => c.periodDate === selectedPeriod);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEmptyHtml(html)) return;
    startTransition(async () => {
      try {
        await createComment(kpiId, selectedPeriod, html);
        const sanitized = sanitizeHtmlClient(html);
        setComments((prev) => [
          { id: Date.now(), kpiId, periodDate: selectedPeriod, content: sanitized, author: "Admin", createdAt: new Date() },
          ...prev,
        ]);
        setHtml("");
        setEditorKey((k) => k + 1); // Reset editor
        toast.success("Komentar ditambahkan");
      } catch {
        toast.error("Gagal menambahkan komentar");
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteComment(id, kpiId);
        setComments((prev) => prev.filter((c) => c.id !== id));
        toast.success("Komentar dihapus");
      } catch {
        toast.error("Gagal menghapus komentar");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircle className="w-4 h-4" />
          <span>
            Komentar periode <strong className="text-foreground">{currentPeriodLabel}</strong>
          </span>
          {visibleComments.length > 0 && <span className="text-xs">({visibleComments.length})</span>}
        </div>
        {availablePeriods.length > 1 && (
          <Select value={selectedPeriod} onValueChange={(v) => { setSelectedPeriod(v); setHtml(""); setEditorKey((k) => k + 1); }}>
            <SelectTrigger className="h-7 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availablePeriods.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Editor Form */}
      <form onSubmit={handleSubmit} className="space-y-2 print:hidden">
        <RichTextEditor
          key={editorKey}
          onChange={setHtml}
          placeholder={`Tulis catatan untuk ${currentPeriodLabel}...`}
          disabled={isPending}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending || isEmptyHtml(html)}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Kirim
          </Button>
        </div>
      </form>

      {/* Comment List */}
      {visibleComments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Belum ada komentar untuk periode ini.</p>
      ) : (
        <ul className="space-y-3">
          {visibleComments.map((c) => (
            <li key={c.id} className="group">
              <div className="rounded-lg border bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{c.author}</span>
                    <span className="text-xs text-muted-foreground">{formatRelative(new Date(c.createdAt))}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 print:hidden"
                    onClick={() => handleDelete(c.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div
                  className="prose-comment text-sm"
                  dangerouslySetInnerHTML={{ __html: c.content }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
