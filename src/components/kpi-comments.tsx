"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createComment, deleteComment } from "@/lib/actions/comment";
import type { KPIComment } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Trash2, Send } from "lucide-react";

interface KPICommentsProps {
  kpiId: number;
  periodDate: string;
  periodLabel: string;
  initialComments: KPIComment[];
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

export function KPIComments({ kpiId, periodDate, periodLabel, initialComments }: KPICommentsProps) {
  const [comments, setComments] = useState<KPIComment[]>(initialComments);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      try {
        await createComment(kpiId, periodDate, text);
        // Optimistic: tambah ke list
        setComments((prev) => [
          { id: Date.now(), kpiId, periodDate, content: text.trim(), author: "Admin", createdAt: new Date() },
          ...prev,
        ]);
        setText("");
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
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MessageCircle className="w-4 h-4" />
        <span>Komentar periode <strong className="text-foreground">{periodLabel}</strong></span>
        {comments.length > 0 && <span className="text-xs">({comments.length})</span>}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 print:hidden">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tambah catatan atau konteks untuk periode ini..."
          className="min-h-0 h-10 resize-none py-2 text-sm"
          disabled={isPending}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
        />
        <Button type="submit" size="icon" disabled={isPending || !text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* List */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Belum ada komentar untuk periode ini.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-3 group">
              <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium">{c.author}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(new Date(c.createdAt))}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 print:hidden"
                onClick={() => handleDelete(c.id)}
                disabled={isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
