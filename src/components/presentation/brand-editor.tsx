"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrandStyle } from "@/lib/presentation/brand";

type ActiveBrand = {
  revision: number;
  style: BrandStyle;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
};
type BrandResponse = { active: ActiveBrand | null; default: BrandStyle };
type Message = { role: "user" | "assistant"; text: string };

const starters = [
  "Korporat formal, biru navy, kesan tepercaya",
  "Terang dan minimalis, aksen hijau, mudah dibaca",
  "Editorial elegan, judul serif, warna hangat",
];
const colorLabels: Record<keyof BrandStyle["colors"], string> = {
  background: "Latar", backgroundEnd: "Gradasi", surface: "Panel", text: "Teks",
  mutedText: "Teks sekunder", primary: "Utama", accent: "Aksen",
};

async function fetchBrand(signal?: AbortSignal): Promise<BrandResponse> {
  const response = await fetch("/api/presentation/brand", { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Brand aktif gagal dimuat. Coba lagi.");
  return result;
}

export function BrandEditor() {
  const [active, setActive] = useState<ActiveBrand | null>(null);
  const [defaults, setDefaults] = useState<BrandStyle | null>(null);
  const [draft, setDraft] = useState<BrandStyle | null>(null);
  const [description, setDescription] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [instruction, setInstruction] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflicted, setConflicted] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  function showDraft(style: BrandStyle) {
    setDraft(style);
    setPreviewHtml("");
    setPreviewError("");
    setPreviewLoading(true);
  }

  function applyLoadedBrand(result: BrandResponse) {
    setActive(result.active);
    setDefaults(result.default);
    showDraft(result.active?.style ?? result.default);
    setDescription(result.active?.description ?? "");
    setMessages([]);
    setInstruction("");
    setDirty(false);
    setConflicted(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetchBrand(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setActive(result.active);
      setDefaults(result.default);
      setDraft(result.active?.style ?? result.default);
      setDescription(result.active?.description ?? "");
      setMessages([]);
      setInstruction("");
      setDirty(false);
      setConflicted(false);
      setError("");
      setPreviewHtml("");
      setPreviewError("");
      setPreviewLoading(true);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Brand gagal dimuat.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [loadKey]);

  useEffect(() => {
    if (!draft) return;
    const controller = new AbortController();
    void fetch("/api/presentation/brand/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style: draft }), signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Pratinjau gagal dibuat. Coba lagi.");
      }
      const html = await response.text();
      if (!controller.signal.aborted) setPreviewHtml(html);
    }).catch((cause) => {
      if (!controller.signal.aborted) setPreviewError(cause instanceof Error ? cause.message : "Pratinjau gagal dimuat.");
    }).finally(() => {
      if (!controller.signal.aborted) setPreviewLoading(false);
    });
    return () => controller.abort();
  }, [draft, previewKey]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function generate() {
    const text = instruction.trim();
    if (!text || busy || !draft) return;
    setBusy("generate"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/presentation/brand/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text, ...(messages.length ? { base: draft } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(response.status === 429 ? "Batas penggunaan AI tercapai. Tunggu sebentar lalu kirim lagi."
          : response.status === 503 ? "AI belum tersedia. Minta admin memeriksa konfigurasi DeepSeek, lalu coba lagi."
          : result.error || "Gaya belum berhasil dibuat. Coba jelaskan dengan cara lain.");
      }
      showDraft(result.style);
      setMessages((current) => [...current, { role: "user", text }, { role: "assistant", text: result.summary }]);
      setDescription((current) => `${messages.length ? current + "\n" : ""}${text}`.slice(-2000));
      setInstruction("");
      setDirty(true);
      setNotice("Draf diperbarui. Periksa pratinjau sebelum menyimpan.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI gagal dihubungi. Pesan Anda tetap tersedia untuk dikirim lagi.");
    } finally { setBusy(null); }
  }

  async function save() {
    if (!draft || busy || conflicted) return;
    setBusy("save"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/presentation/brand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: draft, description, expectedRevision: active?.revision ?? 0 }),
      });
      const result = await response.json();
      if (response.status === 409) {
        setConflicted(true);
        setError("Brand aktif sudah diubah di tempat lain. Memuat versi terbaru…");
        const latest = await fetchBrand();
        applyLoadedBrand(latest);
        setError("Brand aktif sudah diubah di tempat lain. Versi terbaru telah dimuat; draf lama tidak disimpan. Silakan buat perubahan lagi.");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Brand gagal disimpan. Draf Anda tetap tersedia.");
      // Refresh metadata only: a failed refresh must not turn a successful save into a failed save.
      setActive({ revision: result.revision, style: draft, description, updatedAt: "", updatedBy: null });
      setDirty(false);
      setNotice(`Brand aktif tersimpan sebagai revisi ${result.revision}.`);
      toast.success("Brand presentasi berhasil disimpan.");
      try {
        const latest = await fetchBrand();
        if (latest.active?.revision === result.revision) setActive(latest.active);
        else {
          applyLoadedBrand(latest);
          setNotice(`Revisi ${result.revision} tersimpan. Ada perubahan lebih baru; brand aktif terbaru telah dimuat.`);
        }
      } catch {
        setNotice(`Revisi ${result.revision} tersimpan. Waktu dan penyimpan belum dapat dimuat; muat ulang untuk memperbaruinya.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Penyimpanan gagal. Draf Anda tetap tersedia.");
    } finally { setBusy(null); }
  }

  function discard() {
    if (!defaults) return;
    showDraft(active?.style ?? defaults);
    setDescription(active?.description ?? "");
    setMessages([]); setInstruction(""); setDirty(false); setError("");
    setNotice("Draf dibuang. Pratinjau kembali ke brand aktif.");
  }

  return <div className="max-w-7xl space-y-6 pb-10">
    <PageHeader title="Brand Presentasi" description="Ceritakan gaya yang Anda inginkan, sempurnakan bersama AI, lalu gunakan untuk seluruh laporan bulanan." />
    <div className="flex flex-wrap items-center justify-between gap-3 border-y py-4">
      <div className="space-y-1 text-sm">
        <p className="font-medium">{loading ? "Memuat brand aktif…" : active ? `${active.style.name} · revisi ${active.revision}` : "Brand default · belum ada revisi tersimpan"}</p>
        {active?.updatedAt && <p className="text-xs text-muted-foreground">Disimpan {new Date(active.updatedAt).toLocaleString("id-ID")}{active.updatedBy ? ` oleh ${active.updatedBy}` : ""}</p>}
        <p className="text-xs text-muted-foreground">{dirty ? "Draf belum disimpan. Brand aktif belum berubah." : "Brand aktif berlaku untuk HTML presentasi dan Presentation Prompt."}</p>
      </div>
      <Button onClick={() => void save()} disabled={loading || !!busy || !dirty || conflicted || previewLoading || !previewHtml}>
        {busy === "save" && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        Simpan sebagai brand aktif
      </Button>
    </div>
    {error && <div role="alert" className="space-y-2 rounded-md border border-destructive p-3 text-sm text-destructive"><p>{error}</p>{(!draft || conflicted) && <Button variant="outline" size="sm" disabled={!!busy || loading} onClick={() => { setLoading(true); setLoadKey((key) => key + 1); }}>Muat brand aktif lagi</Button>}</div>}
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{busy === "generate" ? "AI sedang merancang gaya presentasi…" : busy === "save" ? "Menyimpan brand aktif…" : notice}</p>
    {draft && <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
      <section className="min-w-0 space-y-4" aria-labelledby="conversation-title" aria-busy={busy === "generate"}>
        <div><h2 id="conversation-title" className="text-lg font-semibold">Rancang lewat percakapan</h2><p className="mt-1 text-sm text-muted-foreground">Sebutkan suasana, warna, atau jenis huruf. Setelah itu, coba arahan seperti “lebih terang” atau “judul lebih formal”.</p></div>
        {messages.length > 0 && <div role="log" aria-label="Percakapan desain brand" aria-live="polite" className="max-h-96 space-y-4 overflow-y-auto rounded-md border p-4">
          {messages.map((message, index) => <div key={index} className={message.role === "user" ? "ml-4 rounded-md bg-muted p-3" : "space-y-1"}><p className="text-xs font-semibold">{message.role === "user" ? "Anda" : "AI"}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p></div>)}
          <div ref={threadEnd} />
        </div>}
        {messages.length === 0 && <div className="flex flex-wrap gap-2" aria-label="Contoh arahan gaya">{starters.map((starter) => <Button key={starter} type="button" variant="outline" size="sm" className="h-auto max-w-full whitespace-normal rounded-full text-left" disabled={!!busy || loading || conflicted} onClick={() => { setInstruction(starter); textarea.current?.focus(); }}>{starter}</Button>)}</div>}
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
          <Label htmlFor="brand-instruction">{messages.length ? "Apa yang ingin diubah?" : "Gaya presentasi yang Anda inginkan"}</Label>
          <Textarea ref={textarea} id="brand-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Misalnya: latar navy, judul tegas, dan aksen biru. Tetap nyaman dibaca saat rapat." maxLength={1000} rows={4} required disabled={!!busy || loading || conflicted} aria-describedby="instruction-hint" />
          <div className="flex items-center justify-between gap-3"><p id="instruction-hint" className="text-xs text-muted-foreground">Maksimal 1.000 karakter. Warna status KPI tetap.</p><Button type="submit" disabled={!!busy || loading || conflicted || !instruction.trim()}>Kirim</Button></div>
        </form>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={!!busy || loading || conflicted || !defaults} onClick={() => { if (!defaults) return; showDraft(defaults); setDescription("Dikembalikan ke gaya default."); setMessages([]); setInstruction(""); setDirty(true); setError(""); setNotice("Gaya default ditampilkan. Klik Simpan sebagai brand aktif untuk menerapkannya."); }}>Kembali ke default</Button>
          <Button type="button" variant="ghost" disabled={!!busy || loading || conflicted || (!dirty && !messages.length && !instruction)} onClick={discard}>Buang draf</Button>
        </div>
      </section>
      <section className="min-w-0 space-y-4" aria-labelledby="preview-title">
        <div><h2 id="preview-title" className="text-lg font-semibold">Pratinjau · {draft.name}</h2><p className="mt-1 text-sm text-muted-foreground">Deck asli dengan data contoh, bukan laporan perusahaan. Klik di dalam slide, lalu gunakan tombol panah untuk berpindah.</p></div>
        <div className="aspect-video overflow-hidden rounded-md border bg-muted" aria-busy={previewLoading}>
          {previewHtml ? <iframe title="Pratinjau brand pada presentasi laporan bulanan" sandbox="allow-scripts" srcDoc={previewHtml} className="h-full w-full border-0" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">{previewLoading ? <span role="status">Menyiapkan pratinjau…</span> : <div role="alert" className="space-y-3"><p>{previewError}</p><Button variant="outline" size="sm" onClick={() => { setPreviewLoading(true); setPreviewError(""); setPreviewKey((key) => key + 1); }}>Coba pratinjau lagi</Button></div>}</div>}
        </div>
        <div className="space-y-3 text-xs text-muted-foreground" aria-label="Warna dan jenis huruf draf">
          <ul className="flex flex-wrap gap-x-4 gap-y-3">{Object.entries(draft.colors).map(([key, color]) => <li key={key} className="flex items-center gap-2"><span aria-hidden="true" className="size-5 shrink-0 rounded-sm border" style={{ backgroundColor: color }} /><span>{colorLabels[key as keyof BrandStyle["colors"]]}<span className="block">{color}</span></span></li>)}</ul>
          <p>Judul: <span className="text-foreground">{draft.fonts.heading}</span> · Isi: <span className="text-foreground">{draft.fonts.body}</span></p>
          {draft.guideline && <p className="max-w-prose whitespace-pre-wrap leading-relaxed">{draft.guideline}</p>}
        </div>
      </section>
    </div>}
  </div>;
}
