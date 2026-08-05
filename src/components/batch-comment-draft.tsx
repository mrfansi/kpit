"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCommentsBatch } from "@/lib/actions/comment";
import { textToHtml } from "@/lib/html-utils";
import { formatPeriodDate } from "@/lib/period";

interface Draft {
  kpiId: number;
  kpiName: string;
  draft: string;
}

interface Skipped {
  kpiId: number;
  kpiName: string;
  reason: string;
  message: string;
}

interface BatchCommentDraftProps {
  /** Tidak diisi = seluruh KPI, bukan satu domain. */
  domainId?: number;
  periodDate: string;
}

/**
 * Menyusun draf catatan untuk banyak KPI sekaligus, lalu menampilkannya untuk
 * disunting sebelum disimpan.
 *
 * Textarea polos, bukan rich text editor: ini permukaan tinjauan cepat untuk
 * belasan draf sekaligus. Penyuntingan kaya tetap tersedia per KPI di halaman
 * detailnya masing-masing.
 */
export function BatchCommentDraft({ domainId, periodDate }: BatchCommentDraftProps) {
  const [open, setOpen] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [skippedForCap, setSkippedForCap] = useState(0);

  const periodLabel = formatPeriodDate(periodDate, "MMMM yyyy");

  async function handleDraft() {
    setIsDrafting(true);
    try {
      const res = await fetch("/api/kpi/draft-comments-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, periodDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Gagal menyusun draf");
        return;
      }
      if (data.drafts.length === 0) {
        // Semuanya terlewat bukan berarti gagal teknis — biasanya periodenya
        // memang belum diisi. Katakan itu, jangan diam.
        toast.error(
          data.skipped?.[0]?.message ?? `Tidak ada KPI dengan data untuk ${periodLabel}.`
        );
        setSkipped(data.skipped ?? []);
        setSkippedForCap(data.skippedForCap ?? 0);
        setOpen(true);
        return;
      }
      setDrafts(data.drafts);
      setSkipped(data.skipped ?? []);
      setSkippedForCap(data.skippedForCap ?? 0);
      setOpen(true);
    } catch {
      toast.error("Gagal menghubungi layanan AI");
    } finally {
      setIsDrafting(false);
    }
  }

  function handleSave() {
    const items = drafts
      .filter((d) => d.draft.trim().length > 0)
      .map((d) => ({ kpiId: d.kpiId, content: textToHtml(d.draft) }));

    if (items.length === 0) {
      toast.error("Tidak ada draf yang terisi");
      return;
    }

    startSaving(async () => {
      try {
        const { saved, skipped: rejected } = await createCommentsBatch(items, periodDate);
        if (saved === 0) {
          toast.error("Tidak ada catatan yang tersimpan");
          return;
        }
        toast.success(
          rejected > 0
            ? `${saved} catatan tersimpan, ${rejected} dilewati`
            : `${saved} catatan tersimpan`
        );
        setOpen(false);
        setDrafts([]);
      } catch {
        toast.error("Gagal menyimpan catatan");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleDraft} disabled={isDrafting}>
        {isDrafting ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
        )}
        {isDrafting ? "Menyusun draf..." : "Draf catatan"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Draf catatan {periodLabel}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Periksa dan sunting sebelum menyimpan. Kosongkan salah satu untuk melewatinya.
          </p>

          {(skipped.length > 0 || skippedForCap > 0) && (
            <div className="rounded-md border border-warning bg-warning-soft p-3 text-xs text-warning">
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Tidak semua KPI diproses
              </div>
              <ul className="space-y-0.5">
                {skipped.map((s) => (
                  <li key={s.kpiId}>
                    {s.kpiName} — {s.message}
                  </li>
                ))}
                {skippedForCap > 0 && (
                  <li>
                    <span className="num">{skippedForCap}</span> KPI lain melebihi batas satu
                    kali proses. Jalankan lagi untuk sisanya.
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {drafts.map((d, i) => (
              <div key={d.kpiId} className="space-y-1.5">
                <label htmlFor={`draft-${d.kpiId}`} className="text-sm font-medium">
                  {d.kpiName}
                </label>
                <Textarea
                  id={`draft-${d.kpiId}`}
                  value={d.draft}
                  rows={4}
                  disabled={isSaving}
                  onChange={(e) =>
                    setDrafts((prev) => {
                      const next = [...prev];
                      next[i] = { ...next[i], draft: e.target.value };
                      return next;
                    })
                  }
                  className="text-sm"
                />
              </div>
            ))}
          </div>

          {drafts.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Simpan semua
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
