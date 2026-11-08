"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
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
import { EmptyState } from "@/components/empty-state";
import { Trash2, Send, Sparkles, Loader2 } from "lucide-react";
import { isEmptyHtml, textToHtml } from "@/lib/html-utils";
import { formatDayShort } from "@/lib/date-utils";

// Tiptap/ProseMirror are heavy and only admins ever see the editor; the editor renders nothing before mount anyway.
const RichTextEditor = dynamic(() => import("@/components/rich-text-editor").then((m) => m.RichTextEditor), { ssr: false });

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
  return formatDayShort(date);
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
      toast.success("Draf dimuat. Periksa dan sunting sebelum mengirim");
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Komentar periode {currentPeriodLabel}
          {visibleComments.length > 0 && (
            <span className="num ml-2 text-sm font-normal text-muted-foreground">({visibleComments.length})</span>
          )}
        </h2>
        {availablePeriods.length > 1 && (
          <Select value={selectedPeriod} onValueChange={(v) => { setSelectedPeriod(v); setHtml(""); setEditorKey((k) => k + 1); }}>
            <SelectTrigger size="sm" className="w-40" aria-label="Periode komentar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availablePeriods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Editor Form */}
      {canEdit && (
      <form onSubmit={handleSubmit} className="space-y-3 print:hidden">
        <RichTextEditor
          key={editorKey}
          content={html}
          onChange={setHtml}
          placeholder={`Tulis catatan untuk ${currentPeriodLabel}…`}
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
              <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles aria-hidden />
            )}
            {isDrafting ? "Menyusun draf…" : "Draf dengan AI"}
          </Button>
          {/* Outline: primary terisi layar ini milik form action plan. */}
          <Button type="submit" variant="outline" size="sm" disabled={isPending || isEmptyHtml(html)}>
            <Send aria-hidden />
            Kirim
          </Button>
        </div>
      </form>
      )}

      {/* Comment List */}
      {visibleComments.length === 0 ? (
        <EmptyState compact title="Belum ada komentar untuk periode ini." />
      ) : (
        <ul className="divide-y border-y">
          {visibleComments.map((c) => (
            <li key={c.id} className="group py-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{c.author}</span>
                    <span className="text-sm text-muted-foreground">{formatRelative(new Date(c.createdAt))}</span>
                  </div>
                  {canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity duration-[var(--dur-micro)] group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 print:hidden"
                        disabled={isPending}
                        aria-label="Hapus komentar"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus komentar ini?</AlertDialogTitle>
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
                          Ya, hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  )}
                </div>
                <div
                  className="prose-comment text-base"
                  dangerouslySetInnerHTML={{ __html: c.content }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
