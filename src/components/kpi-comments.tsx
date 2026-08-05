"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createComment, deleteComment } from "@/lib/actions/comment";
import type { KPIComment } from "@/lib/db/schema";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text-editor";
import { EmptyState } from "@/components/empty-state";
import { MessageCircle, Trash2, Send, Sparkles, Loader2 } from "lucide-react";
import { isEmptyHtml, textToHtml } from "@/lib/html-utils";

// Ringkasan teks polos dari HTML komentar, untuk ditampilkan di dialog konfirmasi hapus.
function excerptFromHtml(html: string, maxLength = 60) {
  const text = html.replace(/<[^>]*>/g, "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

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
  /** Komentarnya tetap terbaca siapa pun; hanya editor dan tombol hapus digating. */
  canEdit?: boolean;
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

export function KPIComments({ kpiId, periodDate, periodLabel, initialComments, availablePeriods = [], canEdit = false }: KPICommentsProps) {
  const [comments, setComments] = useState<KPIComment[]>(initialComments);
  const [selectedPeriod, setSelectedPeriod] = useState(periodDate);
  const [html, setHtml] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isDrafting, setIsDrafting] = useState(false);

  async function handleDraft() {
    setIsDrafting(true);
    try {
      const res = await fetch("/api/kpi/draft-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpiId, periodDate: selectedPeriod }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Pesan server sudah spesifik (mis. "belum ada data untuk periode ini",
        // kuota AI habis) — teruskan apa adanya, jangan ganti teks generik.
        toast.error(data?.error ?? "Gagal menyusun draf");
        return;
      }
      setHtml(textToHtml(data.draft));
      setEditorKey((k) => k + 1); // remount editor supaya `content` terbaca
      toast.success("Draf dimuat — periksa dan sunting sebelum mengirim");
    } catch {
      toast.error("Gagal menghubungi layanan AI");
    } finally {
      setIsDrafting(false);
    }
  }

  const currentPeriodLabel = availablePeriods.find((p) => p.value === selectedPeriod)?.label ?? periodLabel;
  const visibleComments = comments.filter((c) => c.periodDate === selectedPeriod);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEmptyHtml(html)) return;
    startTransition(async () => {
      try {
        // Use the row returned by the server (real DB id) so a subsequent
        // delete targets the correct row instead of a fabricated Date.now() id.
        const created = await createComment(kpiId, selectedPeriod, html);
        if (!created) {
          toast.error("Gagal menambahkan komentar");
          return;
        }
        setComments((prev) => [created, ...prev]);
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
      {canEdit && (
      <form onSubmit={handleSubmit} className="space-y-2 print:hidden">
        <RichTextEditor
          key={editorKey}
          content={html}
          onChange={setHtml}
          placeholder={`Tulis catatan untuk ${currentPeriodLabel}...`}
          disabled={isPending}
        />
        <div className="flex items-center justify-between gap-2">
          {/* Draf mengisi editor, bukan menyimpan. Manusia tetap yang memutuskan
              apa yang terbit — model bisa salah baca angka, dan komentar ini
              jadi catatan resmi periode. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDraft}
            disabled={isPending || isDrafting}
          >
            {isDrafting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isDrafting ? "Menyusun draf..." : "Draf dengan AI"}
          </Button>
          <Button type="submit" size="sm" disabled={isPending || isEmptyHtml(html)}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Kirim
          </Button>
        </div>
      </form>
      )}

      {/* Comment List */}
      {visibleComments.length === 0 ? (
        <EmptyState compact title="Belum ada komentar untuk periode ini." />
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
                  {canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 print:hidden"
                        disabled={isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Komentar Ini?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Komentar &quot;{excerptFromHtml(c.content) || "(kosong)"}&quot; akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(c.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Ya, Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  )}
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
