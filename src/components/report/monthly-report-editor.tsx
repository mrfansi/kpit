"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { MarkdownExportDialog } from "@/components/report/markdown-export-dialog";
import { REPORT_DIVISIONS, type ComputedReportValue, type MonthlyPreviousAction, type MonthlyReportBundle, type MonthlyReportContent, type MonthlyReportMetric, type MonthlyObservation, type ObservationState } from "@/lib/monthly-report-types";
import { appendTimelineActivities, applyNotes, applyPreviousActions, draftSummaryFromNumbers, fieldId, markManualActual, refreshFromEntries } from "@/lib/monthly-report-import";
import { computeMonthlyReport, reportMonths, SHORT_MONTHS, ytdStartInvalid } from "@/lib/monthly-report";
import { statusConfig } from "@/lib/kpi-status";
import { ChevronRight } from "lucide-react";
import { defaultReportingPeriod, shiftMonth } from "@/lib/period";

const inputClass = "min-w-0 space-y-1.5";
const sectionClass = "space-y-4 border-t pt-6";
// Select native disamakan dengan Input: tepi 3:1 konstan, fokus = outline inset.
const selectClass = "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm font-normal outline-2 outline-offset-[-3px] outline-transparent transition-colors duration-[var(--dur-micro)] focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55";
const stateOptions: { value: ObservationState; label: string }[] = [
  { value: "missing", label: "Belum diketahui" }, { value: "provided", label: "Tersedia" }, { value: "untracked", label: "Belum dilacak (dikonfirmasi)" },
];

function Field({ id, label, value, onChange, multiline = false, hint, type = "text" }: { id?: string; label: string; value: string; onChange: (value: string) => void; multiline?: boolean; hint?: string; type?: string }) {
  return <div className={inputClass}><Label className="block">{label}{multiline
    ? <Textarea id={id} className="mt-1.5 font-normal" value={value} onChange={(e) => onChange(e.target.value)} />
    : <Input id={id} className={type === "date" ? "num mt-1.5 font-normal" : "mt-1.5 font-normal"} type={type} value={value} onChange={(e) => onChange(e.target.value)} />}</Label>{hint && <p className="text-sm text-muted-foreground">{hint}</p>}</div>;
}
function Choice({ id, label, value, onChange, options }: { id?: string; label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <div className={inputClass}><Label className="block">{label}<select id={id} className={`${selectClass} mt-1.5`} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Label></div>;
}
function Toggle({ id, label, checked, onChange }: { id?: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <Label className="flex max-w-prose items-start gap-2.5 font-normal leading-5"><input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></Label>;
}
function NumberField({ id, label, value, onChange, disabled = false }: { id?: string; label: string; value: number | null; onChange: (value: number | null) => void; disabled?: boolean }) {
  return <div className={inputClass}><Label className="block">{label}<Input id={id} className="num mt-1.5 font-normal" type="number" step="any" disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} /></Label></div>;
}
function Section({ id, title, detail, children }: { id?: string; title: string; detail?: string; children: React.ReactNode }) {
  return <section id={id} className={sectionClass}><div><h2 className="text-lg font-semibold">{title}</h2>{detail && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{detail}</p>}</div>{children}</section>;
}
function RowGroup<T>({ id, rows, title, create, onChange, render, maxRows }: { id?: string; rows: T[]; title: string; create: () => T; onChange: (rows: T[]) => void; render: (row: T, update: (row: T) => void, index: number) => React.ReactNode; maxRows?: number }) {
  return <div id={id} className="space-y-3">{rows.map((row, index) => <div key={index} id={id ? `${id}-${index}` : undefined} className="space-y-3 rounded-card bg-paper-2 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-base font-semibold">{title} <span className="num">{index + 1}</span></h3><Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Hapus ${title} ${index + 1}`}>Hapus</Button></div><div className="grid gap-3 md:grid-cols-2">{render(row, (next) => onChange(rows.map((item, i) => i === index ? next : item)), index)}</div></div>)}<Button type="button" variant="outline" size="sm" disabled={maxRows !== undefined && rows.length >= maxRows} onClick={() => onChange([...rows, create()])}>Tambah {title.toLowerCase()}</Button></div>;
}
const pullTitles = {
  entries: { done: "Realisasi diperbarui dari entri KPI", none: "Tidak ada realisasi yang perlu diperbarui; baris yang Anda ubah sendiri tidak disentuh." },
  notes: { done: "Terisi dari komentar dan action plan", none: "Tidak ada bidang kosong yang bisa diisi: komentar hanya dipakai untuk KPI yang meleset dari target." },
  timeline: { done: "Kegiatan ditambahkan dari timeline", none: "Tidak ada project timeline baru untuk bulan ini." },
  previous: { done: "Aksi bulan lalu diimpor", none: "Tidak ada aksi bulan lalu untuk diimpor." },
};
// Opens every collapsed KPI around the field, then focuses it. Falls back to the closest ancestor path (e.g. a KPI block).
function focusField(path: string) {
  // The mismatch question points at ".entry"; the field that fixes it is the source.
  const segments = path.replace(/\.entry$/, ".source").split(".");
  let el: HTMLElement | null = null;
  while (segments.length && !(el = document.getElementById(fieldId(segments.join("."))))) segments.pop();
  if (!el) return;
  const fields = "input:not(:disabled),textarea:not(:disabled),select:not(:disabled)";
  const focusable = `${fields},button:not(:disabled),summary`;
  // Prefer a form field over the block's own buttons (e.g. "Hapus"), which come first in document order.
  const target = el.matches(focusable) ? el : el instanceof HTMLDetailsElement ? el.querySelector<HTMLElement>("summary") : el.querySelector<HTMLElement>(fields) ?? el.querySelector<HTMLElement>(focusable);
  // Open from the target itself: it may sit in a collapsed <details> nested inside the matched block.
  for (let d: HTMLDetailsElement | null = (target ?? el).closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
  el.scrollIntoView({ block: "center" });
  if (!target && !el.hasAttribute("tabindex")) el.tabIndex = -1;
  (target ?? el).focus();
}
const monthFormat = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" });
const monthLabel = (iso: string) => monthFormat.format(new Date(`${iso}T00:00:00Z`));
const dayLabel = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d); };
function observationLabel(month: string, period: string) {
  const label = monthLabel(month);
  const [year, m] = period.split("-").map(Number);
  const previous = new Date(Date.UTC(year, m - 2, 1)).toISOString().slice(0, 10);
  return `${label}${month === period ? " (bulan laporan)" : month === previous ? " (bulan sebelumnya)" : ""}`;
}
function QuestionLinks({ items }: { items: MonthlyReportBundle["questions"] }) {
  return <ul className="max-w-prose list-disc space-y-1.5 pl-5 text-sm">{items.map((q) => <li key={`${q.id}|${q.question}`}><a href={`#${fieldId(q.path)}`} className="underline underline-offset-4" onClick={(e) => { e.preventDefault(); focusField(q.path); }}>{q.question}</a></li>)}</ul>;
}
const questionKey = (q: MonthlyReportBundle["questions"][number]) => `${q.id}|${q.question}`;
function computedText(item: ComputedReportValue) {
  return item.state === "provided" ? item.value ?? "belum dihitung" : item.state === "untracked" ? "belum dilacak" : "belum lengkap";
}
function MetricEditor({ metric, metricIndex, computed, period, defaultOpen, onChange }: { metric: MonthlyReportMetric; metricIndex: number; computed: MonthlyReportBundle["metrics"][number] | undefined; period: string; defaultOpen: boolean; onChange: (metric: MonthlyReportMetric) => void }) {
  const p = `metrics.${metricIndex}`;
  function observation(index: number, next: MonthlyObservation) { onChange({ ...metric, observations: metric.observations.map((item, i) => i === index ? next : item) }); }
  const renderedMonths = new Set(metric.observations.map((item) => item.month));
  const [year, month] = period.split("-").map(Number);
  const ytdStartValue = metric.ytdStartMonth ?? `${year}-01-01`;
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
  const missingMonths = [previous, period].filter((item) => !renderedMonths.has(item));
  const older = metric.observations.map((row, index) => ({ row, index })).filter(({ row }) => row.month !== period && row.month !== previous);
  const renderRow = (row: MonthlyObservation, index: number) => <div key={row.month} className="space-y-3 border-t pt-4"><h4 className="text-sm font-semibold">{observationLabel(row.month, period)}</h4><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Choice id={fieldId(`${p}.observations.${row.month}`)} label="Status angka" value={row.state} onChange={(state) => observation(index, { ...row, state: state as ObservationState, actual: state === "provided" ? row.actual : null })} options={stateOptions} />
      <NumberField id={fieldId(`${p}.observations.${row.month}.actual`)} label="Realisasi" value={row.actual} disabled={row.state !== "provided"} onChange={(actual) => observation(index, markManualActual({ ...row, actual }))} />
      <NumberField label="Target" value={row.target} onChange={(target) => observation(index, { ...row, target })} />
      <Field id={fieldId(`${p}.observations.${row.month}.source`)} label="Sumber realisasi" value={row.source} onChange={(source) => observation(index, { ...row, source })} />
      <Field id={fieldId(`${p}.observations.${row.month}.targetSource`)} label="Sumber target" value={row.targetSource} onChange={(targetSource) => observation(index, { ...row, targetSource })} />
      {metric.aggregation === "ratio" && <><NumberField id={fieldId(`${p}.observations.${row.month}.ratio`)} label="Pembilang" value={row.numerator} disabled={row.state !== "provided"} onChange={(numerator) => observation(index, markManualActual({ ...row, numerator }))} /><NumberField label="Penyebut" value={row.denominator} disabled={row.state !== "provided"} onChange={(denominator) => observation(index, markManualActual({ ...row, denominator }))} /></>}
    </div></div>;
  // Disclosure = konten interaktif sendiri: kartu ber-border dengan padding pada summary dan isi.
  return <details id={fieldId(p)} className="group rounded-card border" open={defaultOpen ? true : undefined}><summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3"><ChevronRight aria-hidden className="size-4 shrink-0 self-center text-muted-foreground group-open:rotate-90" /><span className="font-semibold">{metric.name}</span><span className="text-sm text-muted-foreground">{metric.unit || "satuan belum diisi"}</span>{computed?.missedTarget && <span className={`rounded-sm px-1.5 py-0.5 text-xs font-semibold ${statusConfig.red.bg} ${statusConfig.red.color}`}>target belum tercapai</span>}</summary><div className="space-y-5 border-t px-4 py-4">
    <div className="grid gap-3 md:grid-cols-2"><Field id={fieldId(`${p}.identity`)} label="Nama KPI" value={metric.name} onChange={(name) => onChange({ ...metric, name })} /><Field label="Satuan" value={metric.unit} onChange={(unit) => onChange({ ...metric, unit })} /><Field label="Definisi KPI" value={metric.definition} onChange={(definition) => onChange({ ...metric, definition })} multiline /><Choice label="Arah target" value={metric.direction} onChange={(direction) => onChange({ ...metric, direction: direction as MonthlyReportMetric["direction"] })} options={[{ value: "higher_better", label: "Semakin tinggi semakin baik" }, { value: "lower_better", label: "Semakin rendah semakin baik" }]} /></div>
    <Toggle id={fieldId(`${p}.definition`)} label="Definisi dan target KPI sudah diperiksa; bila belum jelas atau berubah, sudah dikonfirmasi dengan CEO sebelum dinyatakan final" checked={metric.definitionConfirmed} onChange={(definitionConfirmed) => onChange({ ...metric, definitionConfirmed })} />
    <div className="grid gap-3 md:grid-cols-2"><Choice id={fieldId(`${p}.aggregation`)} label="Aturan agregasi YTD" value={metric.aggregation ?? ""} onChange={(aggregation) => onChange({ ...metric, aggregation: aggregation ? aggregation as MonthlyReportMetric["aggregation"] : null })} options={[{ value: "", label: "Pilih aturan" }, { value: "sum", label: "Jumlah bulanan" }, { value: "average", label: "Rata-rata bulanan" }, { value: "latest", label: "Nilai terakhir (posisi akhir bulan)" }, { value: "ratio", label: "Rasio pembilang / penyebut" }]} /><Field label="Penjelasan agregasi / cakupan pengukuran" value={metric.aggregationNote} onChange={(aggregationNote) => onChange({ ...metric, aggregationNote })} multiline /></div>
    <div className="grid gap-3 md:grid-cols-2"><Choice id={fieldId(`${p}.ytdStart`)} label="YTD mulai" value={ytdStartValue} onChange={(start) => onChange({ ...metric, ytdStartMonth: start === `${year}-01-01` ? null : start })} options={[...(ytdStartInvalid(metric, period) ? [{ value: ytdStartValue, label: `${monthLabel(ytdStartValue)} (tidak valid)` }] : []), ...reportMonths(period).map((m) => ({ value: m, label: `${SHORT_MONTHS[Number(m.slice(5, 7)) - 1]} ${year}` }))]} /></div>
    <div className="grid gap-3 md:grid-cols-2"><Field id={fieldId(`${p}.sharedMetricKey`)} label="Kunci metrik bersama (opsional)" value={metric.sharedMetricKey} onChange={(sharedMetricKey) => onChange({ ...metric, sharedMetricKey })} hint="Gunakan kunci sama untuk angka yang dilaporkan lintas divisi." /><Field id={fieldId(`${p}.reconciliationNote`)} label="Catatan rekonsiliasi definisi dan sumber" value={metric.reconciliationNote} onChange={(reconciliationNote) => onChange({ ...metric, reconciliationNote })} multiline /></div>
    <Toggle id={fieldId(`${p}.sharingReviewed`)} label="Saya sudah memeriksa apakah metrik ini dipakai bersama divisi lain" checked={metric.sharingReviewed} onChange={(sharingReviewed) => onChange({ ...metric, sharingReviewed })} />
    <div className="grid gap-3 md:grid-cols-2"><Field id={fieldId(`${p}.deviation`)} label="Penyebab deviasi target (jika meleset)" value={metric.deviationCause} onChange={(deviationCause) => onChange({ ...metric, deviationCause })} multiline /><Field label="Bukti / referensi deviasi" value={metric.deviationEvidence} onChange={(deviationEvidence) => onChange({ ...metric, deviationEvidence })} multiline /></div>
    <div><h3 className="text-base font-semibold">Riwayat bulanan</h3><p className="mt-1 max-w-prose text-sm text-muted-foreground">Isi setiap bulan untuk YTD. Kosong berarti belum diketahui; nol adalah angka sah. Untuk rasio, isi pembilang dan penyebut beserta sumbernya.</p></div>
    {missingMonths.length > 0 && <p className="text-sm text-destructive">Bulan {missingMonths.map(monthLabel).join(", ")} belum ada di snapshot. Muat ulang untuk memulihkan cakupan KPI.</p>}
    {metric.observations.map((row, index) => row.month === period || row.month === previous ? renderRow(row, index) : null)}
    {older.length > 0 && <details id={fieldId(`${p}.history`)} className="group/history border-t"><summary className="flex cursor-pointer items-center gap-2 py-3 text-sm font-semibold"><ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground group-open/history:rotate-90" />Riwayat sebelumnya<span className="font-normal text-muted-foreground"><span className="num">{older.length}</span> bulan</span></summary><div className="space-y-4 pb-1">{older.map(({ row, index }) => renderRow(row, index))}</div></details>}
    {computed && <div className="space-y-2"><p className="text-sm font-semibold">Hitungan tersimpan</p><dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm sm:grid-cols-3 sm:gap-x-8">
      {([["Bulan ini", computed.current], ["Bulan lalu", computed.previous], [computed.ytd.label ?? "YTD", computed.ytd]] as const).map(([term, item]) => <div key={term} className="col-span-2 grid grid-cols-subgrid sm:col-span-1 sm:flex sm:flex-col sm:gap-0.5"><dt className="text-muted-foreground">{term}</dt><dd className={item.state === "provided" && item.value !== null ? "num font-semibold" : "text-muted-foreground"}>{computedText(item)}</dd></div>)}
    </dl></div>}
  </div></details>;
}

export function MonthlyReportEditor({ initial }: { initial: MonthlyReportBundle }) {
  const [bundle, setBundle] = useState(initial);
  const [content, setContent] = useState<MonthlyReportContent>(initial.content);
  const contentRef = useRef(initial.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<MonthlyReportBundle["questions"] | null>(null);
  const [dirty, setDirty] = useState(initial.revision === 0);
  // A fresh, never-saved report is "dirty" but not edited; only real edits arm the leave-page guard.
  const [edited, setEdited] = useState(false);
  const [imported, setImported] = useState<{ title: string; lines: string[] } | null>(null);
  // Only the first unconfirmed KPI starts open, fixed at mount so confirming it does not collapse it.
  const [openIndex] = useState(() => initial.content.metrics.findIndex((m) => !m.definitionConfirmed));
  useEffect(() => {
    if (!edited) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [edited]);
  // Next's router navigates without unloading, so beforeunload never fires for in-app links: intercept clicks in capture phase, before Link's handler.
  // shortcut: back/forward (popstate) is not guarded; the URL has already changed when popstate fires and vinext's router offers no cancel hook, so a decline could not restore the page without a history hack. Upgrade if the router gains a beforePopState-style API.
  useEffect(() => {
    if (!edited) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.origin !== window.location.origin) return;
      if (a.pathname === window.location.pathname && a.search === window.location.search) return;
      if (!window.confirm("Ada perubahan yang belum disimpan. Tinggalkan halaman?")) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [edited]);
  // Questions only the server can produce (cross-division, KPI entry mismatch): saved ones the pure computation does not reproduce.
  const savedOnlyQuestions = useMemo(() => {
    const pure = new Set(computeMonthlyReport(bundle.content, bundle.period).questions.map(questionKey));
    return bundle.questions.filter((q) => !pure.has(questionKey(q)));
  }, [bundle]);
  const liveQuestions = useMemo(() => dirty ? computeMonthlyReport(content, bundle.period).questions : null, [dirty, content, bundle.period]);
  const params = new URLSearchParams({ domain: bundle.domain.slug, period: bundle.period });
  function replace(next: MonthlyReportContent) {
    contentRef.current = next;
    setContent(next);
    setDirty(true);
    setEdited(true);
    setNotice("");
    setAiQuestions(null);
  }
  function change<K extends keyof MonthlyReportContent>(key: K, value: MonthlyReportContent[K]) { replace({ ...contentRef.current, [key]: value }); }
  // Pulls source data and applies it to the editor's current (possibly unsaved) content; nothing is saved until the user saves.
  async function pull(kind: "entries" | "notes" | "timeline" | "previous") {
    setBusy(true); setError(""); setNotice(""); setImported(null);
    try {
      const response = await fetch(`/api/report/monthly?${params}&import=${kind === "previous" ? "notes" : kind}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Pengambilan data gagal (${response.status}).`);
      const current = contentRef.current;
      const result = kind === "entries" ? refreshFromEntries(current, data.entries, new Set<number>(data.checkedKpiIds), data.targets) : kind === "notes" ? applyNotes(current, data, bundle.period) : kind === "previous" ? applyPreviousActions(current, data.previousActions ?? []) : appendTimelineActivities(current, data.lines);
      if (!result.changes.length) { setNotice(pullTitles[kind].none); return; }
      replace(result.content);
      setImported({ title: pullTitles[kind].done, lines: result.changes });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pengambilan data gagal."); }
    finally { setBusy(false); }
  }
  async function save(): Promise<MonthlyReportBundle | null> {
    const snapshot = contentRef.current;
    setBusy(true); setError(""); setNotice(""); setConflict(false);
    try {
      const response = await fetch(`/api/report/monthly?${params}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: snapshot, revision: bundle.revision }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw new Error(response.status === 409 ? "Laporan sudah diubah di tempat lain. Muat versi terbaru sebelum menyimpan lagi." : result.error || `Penyimpanan gagal (${response.status}).`);
      }
      const saved = result as MonthlyReportBundle;
      setBundle(saved);
      if (contentRef.current === snapshot) { contentRef.current = saved.content; setContent(saved.content); setDirty(false); setEdited(false); }
      setImported(null);
      setNotice(saved.ready ? "Tersimpan, siap dipresentasikan." : "Draf tersimpan. Lengkapi pertanyaan sebelum presentasi final.");
      return saved;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Penyimpanan gagal."); return null; }
    finally { setBusy(false); }
  }
  async function assist() {
    const saved = dirty ? await save() : bundle;
    if (!saved) return;
    if (contentRef.current !== saved.content) { setNotice("Ada perubahan baru saat menyimpan. Simpan lagi sebelum memakai bantuan AI."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/report/monthly/ai?${params}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: saved.revision }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw new Error(response.status === 409 ? "Laporan berubah saat bantuan AI diproses. Muat versi terbaru sebelum mencoba lagi." : response.status === 503 ? "Layanan AI belum tersedia. Data tetap tersimpan; periksa konfigurasi penyedia lalu coba lagi." : result.error || `Bantuan AI gagal (${response.status}).`);
      }
      setBundle(result.bundle);
      if (contentRef.current === saved.content) { contentRef.current = result.bundle.content; setContent(result.bundle.content); }
      if (result.phase === "clarification") { setAiQuestions(result.questions); setNotice("Jawab pertanyaan pada bidang terkait, simpan, lalu periksa lagi. Ini pertanyaan kelengkapan data, bukan jawaban AI."); }
      else { setAiQuestions(null); setNotice("Catatan pembicara dari AI tersimpan. Periksa sebelum digunakan."); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bantuan AI gagal."); }
    finally { setBusy(false); }
  }
  const questionCount = bundle.questions.length;
  function fillDraft() {
    const current = contentRef.current;
    const draft = draftSummaryFromNumbers(current, computeMonthlyReport(current, bundle.period), bundle.period);
    const pool = draft.summary.filter((line) => !current.summary.includes(line));
    const filled: string[] = [];
    const take = () => { const line = pool.shift(); if (line) filled.push(line); return line; };
    const summary = current.summary.map((line) => line.trim() ? line : take() ?? line);
    // Only a fully empty summary grows new rows; otherwise the user's own lines stay as they are.
    if (!current.summary.some((line) => line.trim())) while (pool.length && summary.length < 4) summary.push(take()!);
    let worstOutcome = current.worstOutcome;
    if (!worstOutcome.trim() && draft.worstOutcome.trim()) { worstOutcome = draft.worstOutcome; filled.push(`Hasil terburuk: ${draft.worstOutcome}`); }
    if (!filled.length) { setImported(null); setNotice("Tidak ada yang diisi: poin dan hasil terburuk sudah terisi, atau belum ada angka yang bisa dirangkum."); return; }
    replace({ ...current, summary, worstOutcome });
    setImported({ title: "Draf ringkasan diisi dari angka", lines: filled });
  }
  return <div className="max-w-6xl space-y-10 pb-12">
    <div className="space-y-4">
      <PageHeader title={`Laporan bulanan: ${bundle.domain.name}`} description={<>Periode <span className="num">{monthLabel(bundle.period)}</span>, revisi <span className="num">{bundle.revision}</span>{bundle.updatedAt ? <>, diperbarui <span className="num">{new Date(bundle.updatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}</span></> : ", belum disimpan"}</>} actions={<><Button variant="outline" size="sm" asChild><Link href={`/admin/reports/monthly/${encodeURIComponent(bundle.domain.slug)}?period=${shiftMonth(bundle.period, -1)}`}>Bulan sebelumnya</Link></Button>{shiftMonth(bundle.period, 1) <= defaultReportingPeriod() && <Button variant="outline" size="sm" asChild><Link href={`/admin/reports/monthly/${encodeURIComponent(bundle.domain.slug)}?period=${shiftMonth(bundle.period, 1)}`}>Bulan berikutnya</Link></Button>}<Button variant="outline" size="sm" asChild><Link href={`/admin/reports/monthly?period=${bundle.period}`}>Semua domain</Link></Button></>} />
      <div className="flex flex-wrap items-center gap-2 border-y py-3">
        <div className="mr-auto"><span className={`inline-block rounded-sm px-2 py-0.5 text-sm ${dirty ? "border border-edge" : "bg-secondary"}`}>{dirty ? "Perubahan belum disimpan" : bundle.ready ? "Siap untuk presentasi final" : <>Draf, <span className="num">{questionCount}</span> pertanyaan terbuka</>}</span></div>
        <Button type="button" variant="outline" onClick={() => void assist()} disabled={busy || conflict}>{busy ? "Memproses…" : "Periksa / Bantu dengan AI"}</Button>
        <Button type="button" onClick={() => void save()} disabled={busy || conflict || !dirty}>{busy ? "Memproses…" : "Simpan draf"}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-sm text-muted-foreground">Tarik dari aplikasi:</span>
        <Button type="button" variant="outline" size="sm" onClick={() => void pull("entries")} disabled={busy || conflict}>Tarik ulang dari entri KPI</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void pull("notes")} disabled={busy || conflict}>Impor dari komentar &amp; action plan</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void pull("timeline")} disabled={busy || conflict}>Impor dari timeline</Button>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card bg-danger-soft p-3 text-sm text-danger"><p>{error}</p>{conflict && <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>Muat versi terbaru</Button>}</div>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {imported && <section aria-label={imported.title} className="space-y-1.5 rounded-card bg-paper-2 p-3 text-sm"><p className="font-semibold">{imported.title} <span className="num">{imported.lines.length}</span>; belum disimpan</p><ul className="list-disc space-y-1 pl-5">{imported.lines.map((line) => <li key={line}>{line}</li>)}</ul></section>}
    </div>
    <section className="space-y-3 rounded-card bg-paper-2 p-4 sm:p-5" aria-label="Kelengkapan laporan"><h2 className="text-lg font-semibold">Pertanyaan yang perlu dijawab</h2><p className="max-w-prose text-sm text-muted-foreground">{dirty ? "Dihitung ulang dari perubahan Anda. Pertanyaan lintas divisi dan perbandingan entri KPI baru dihitung setelah disimpan." : "Angka belum dilacak boleh dikonfirmasi, bukan diganti perkiraan."}</p>{(liveQuestions ?? aiQuestions ?? bundle.questions).length ? <QuestionLinks items={liveQuestions ?? aiQuestions ?? bundle.questions} /> : <p className="text-sm">{dirty ? "Tidak ada pertanyaan terbuka pada perubahan ini." : "Tidak ada pertanyaan terbuka pada versi tersimpan."}</p>}{liveQuestions && savedOnlyQuestions.length > 0 && <div className="space-y-1.5"><p className="text-sm font-semibold">Dari versi tersimpan</p><QuestionLinks items={savedOnlyQuestions} /></div>}</section>
    {bundle.reconciliations.length > 0 && <section className="space-y-3" aria-labelledby="reconciliation-title"><h2 id="reconciliation-title" className="text-lg font-semibold">Rekonsiliasi lintas divisi</h2>{bundle.reconciliations.map((item) => <div key={item.metricKey} className="space-y-1 border-t pt-3 text-sm"><p className="font-semibold">{item.metricKey}: <span className={item.state === "conflict" ? "text-destructive" : "font-normal text-muted-foreground"}>{item.state === "matched" ? "Cocok" : item.state === "conflict" ? "Selisih, perlu dikoreksi" : "Menunggu divisi lain"}</span></p><p className="max-w-prose">{item.detail}</p><ul className="flex flex-wrap gap-x-6 gap-y-1">{item.peers.map((peer) => <li key={peer.domainId}><Link className="underline underline-offset-4" href={`/admin/reports/monthly?period=${bundle.period}#domain-${peer.domainId}`}>{peer.domainName}</Link>: <span className="num">{peer.value ?? "belum tersedia"}</span> {peer.unit} <span className="text-muted-foreground">({peer.source || "tanpa sumber"})</span></li>)}</ul></div>)}</section>}
    <fieldset disabled={busy || conflict} className="min-w-0 space-y-10">
    <Section title="Ringkasan eksekutif" detail="Dua sampai empat poin utama lain ditambah satu hal paling tidak berjalan baik (total 3 sampai 5 poin); cantumkan sumber angka dalam narasi.">
      <Choice id="f-division" label="Divisi laporan" value={content.division ?? ""} onChange={(division) => change("division", division ? division as MonthlyReportContent["division"] : null)} options={[{ value: "", label: "Pilih divisi secara eksplisit" }, ...Object.entries(REPORT_DIVISIONS).map(([value, label]) => ({ value, label }))]} />
      <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" size="sm" onClick={fillDraft} disabled={busy || conflict}>Isi draf ringkasan dari angka</Button><p className="text-sm text-muted-foreground">Hanya mengisi poin dan hasil terburuk yang masih kosong; belum disimpan.</p></div>
      <RowGroup id="f-summary" rows={content.summary} title="Poin utama lain" maxRows={4} create={() => ""} onChange={(rows) => change("summary", rows)} render={(text, update) => <div className="md:col-span-2"><Field label="Isi poin" value={text} onChange={update} multiline /></div>} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="f-worstOutcome" label="Satu hal paling tidak berjalan baik periode ini" value={content.worstOutcome} onChange={(v) => change("worstOutcome", v)} multiline />
        <Field id="f-narrativeSource" label="Sumber angka pada ringkasan, isu, tindakan, dan keputusan" value={content.narrativeSource} onChange={(v) => change("narrativeSource", v)} multiline hint="Cantumkan referensi asal untuk setiap angka dalam narasi." />
      </div>
      <Field id="f-kpiSetChangeNote" label="Alasan perubahan set KPI dari bulan sebelumnya" value={content.kpiSetChangeNote} onChange={(v) => change("kpiSetChangeNote", v)} multiline hint="Isi bila indikator bertambah, hilang, atau definisinya berubah." />
    </Section>
    <p className="text-sm text-muted-foreground">Perubahan di sini hanya mengubah snapshot laporan bulanan tersimpan, bukan entri KPI asal. Laporan dan presentasi memakai snapshot ini setelah disimpan.</p>
    <Section id="f-metrics" title="KPI, target, MoM & YTD" detail="Klik setiap KPI untuk mengisi definisi, sumber, riwayat bulanan, target, agregasi, dan bukti deviasi.">{content.metrics.length ? content.metrics.map((metric, index) => <MetricEditor key={metric.kpiId} metric={metric} metricIndex={index} defaultOpen={index === openIndex} computed={bundle.metrics.find((item) => item.kpiId === metric.kpiId)} period={bundle.period} onChange={(next) => change("metrics", content.metrics.map((item, i) => i === index ? next : item))} />) : <p className="text-sm text-muted-foreground">Belum ada KPI aktif untuk domain ini. Tambahkan KPI melalui Kelola KPI, lalu muat ulang laporan.</p>}</Section>
    <Section title="Isu, risiko & eskalasi"><Toggle id="f-risksReviewed" label="Daftar risiko sudah diperiksa; kosong berarti tidak ada risiko yang perlu dilaporkan" checked={content.risksReviewed} onChange={(v) => change("risksReviewed", v)} /><RowGroup id="f-risks" rows={content.risks} title="Risiko" create={() => ({ issue: "", impact: "", escalationOwner: "" })} onChange={(rows) => change("risks", rows)} render={(row, update) => <><Field label="Isu / risiko" value={row.issue} onChange={(issue) => update({ ...row, issue })} multiline /><Field label="Dampak" value={row.impact} onChange={(impact) => update({ ...row, impact })} multiline /><Field label="Pemilik eskalasi" value={row.escalationOwner} onChange={(escalationOwner) => update({ ...row, escalationOwner })} /></>} /></Section>
    <Section title="Tindak lanjut aksi bulan lalu" detail="Aksi yang dijanjikan bulan lalu. Tandai hasilnya; ini tampil di slide Rencana bulan depan, di atas aksi bulan depan.">
      {content.previousActions.length ? <div className="space-y-3">{content.previousActions.map((row, index) => <div key={index} id={fieldId(`previousActions.${index}`)} className="space-y-3 rounded-card bg-paper-2 p-4"><div><p className="font-medium">{row.action}</p><p className="text-sm text-muted-foreground">PIC {row.pic || "belum diisi"}, tenggat <span className="num">{row.deadline ? dayLabel(row.deadline) : "belum diisi"}</span></p></div><div className="grid gap-3 md:grid-cols-2"><Choice id={fieldId(`previousActions.${index}.status`)} label="Status" value={row.status} onChange={(status) => change("previousActions", content.previousActions.map((item, i) => i === index ? { ...item, status: status as MonthlyPreviousAction["status"] } : item))} options={[{ value: "", label: "Pilih status" }, { value: "done", label: "Selesai" }, { value: "in_progress", label: "Berjalan" }, { value: "dropped", label: "Dibatalkan" }]} /><Field id={fieldId(`previousActions.${index}.note`)} label="Catatan" value={row.note} onChange={(note) => change("previousActions", content.previousActions.map((item, i) => i === index ? { ...item, note } : item))} /></div></div>)}</div>
        : <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted-foreground">Belum ada aksi bulan lalu di laporan ini.</p><Button type="button" variant="outline" size="sm" onClick={() => void pull("previous")} disabled={busy || conflict}>Impor aksi bulan lalu</Button></div>}
    </Section>
    <Section title="Rencana bulan depan" detail="Satu atau lebih tindakan konkret dengan PIC dan tenggat."><RowGroup id="f-actions" rows={content.actions} title="Tindakan" create={() => ({ action: "", pic: "", deadline: "" })} onChange={(rows) => change("actions", rows)} render={(row, update) => <><Field label="Tindakan" value={row.action} onChange={(action) => update({ ...row, action })} multiline /><Field label="PIC" value={row.pic} onChange={(pic) => update({ ...row, pic })} /><Field label="Tenggat" type="date" value={row.deadline} onChange={(deadline) => update({ ...row, deadline })} /></>} /></Section>
    <Section title="Keputusan C-level"><Toggle id="f-decisionsReviewed" label="Kebutuhan keputusan sudah diperiksa; kosong berarti tidak ada permintaan keputusan" checked={content.decisionsReviewed} onChange={(v) => change("decisionsReviewed", v)} /><RowGroup id="f-decisions" rows={content.decisions} title="Keputusan" create={() => ({ request: "", options: "", impact: "" })} onChange={(rows) => change("decisions", rows)} render={(row, update) => <><Field label="Keputusan yang diminta" value={row.request} onChange={(request) => update({ ...row, request })} multiline /><Field label="Opsi" value={row.options} onChange={(options) => update({ ...row, options })} multiline /><Field label="Dampak" value={row.impact} onChange={(impact) => update({ ...row, impact })} multiline /></>} /></Section>
    {content.division === "finance" && <Section id="f-finance" title="Laporan keuangan" detail="Laba rugi, arus kas, dan neraca memakai angka serta sumber sendiri; tandai belum dilacak bila dikonfirmasi.">{([ ["incomeStatement", "Laba rugi"], ["cashFlow", "Arus kas"], ["balanceSheet", "Neraca"] ] as const).map(([key, label]) => <div key={key} id={fieldId(`finance.${key}`)} className="space-y-3"><h3 className="font-semibold">{label}</h3><Field label={`Satuan ${label}`} value={content.finance[key].unit} onChange={(unit) => change("finance", { ...content.finance, [key]: { ...content.finance[key], unit } })} /><RowGroup id={fieldId(`finance.${key}.rows`)} rows={content.finance[key].rows} title={`Baris ${label}`} create={() => ({ label: "", value: null, source: "", state: "missing" as const })} onChange={(rows) => change("finance", { ...content.finance, [key]: { ...content.finance[key], rows } })} render={(row, update) => <><Field label="Nama pos" value={row.label} onChange={(label) => update({ ...row, label })} /><Choice label="Status" value={row.state} options={stateOptions} onChange={(state) => update({ ...row, state: state as ObservationState, value: state === "provided" ? row.value : null })} /><NumberField label="Nilai" value={row.value} disabled={row.state !== "provided"} onChange={(value) => update({ ...row, value })} /><Field label="Sumber" value={row.source} onChange={(source) => update({ ...row, source })} /></>} /></div>)}</Section>}
    <Section title="Rincian kanal & lampiran" detail="Simpan data mentah, kegiatan, dan referensi sebagai lampiran tanpa batas."><RowGroup id="f-channelBreakdowns" rows={content.channelBreakdowns} title="Kanal" create={() => ({ channel: "", metric: "", value: null, unit: "", source: "", state: "missing" as const })} onChange={(rows) => change("channelBreakdowns", rows)} render={(row, update) => <><Field label="Kanal" value={row.channel} onChange={(channel) => update({ ...row, channel })} /><Field label="Metrik" value={row.metric} onChange={(metric) => update({ ...row, metric })} /><Choice label="Status" value={row.state} options={stateOptions} onChange={(state) => update({ ...row, state: state as ObservationState, value: state === "provided" ? row.value : null })} /><NumberField label="Nilai" value={row.value} disabled={row.state !== "provided"} onChange={(value) => update({ ...row, value })} /><Field label="Satuan" value={row.unit} onChange={(unit) => update({ ...row, unit })} /><Field label="Sumber angka" value={row.source} onChange={(source) => update({ ...row, source })} /></>} /><RowGroup rows={content.activities} title="Kegiatan" create={() => ""} onChange={(rows) => change("activities", rows)} render={(row, update) => <div className="md:col-span-2"><Field label="Detail kegiatan" value={row} onChange={update} multiline /></div>} /><RowGroup id="f-appendices" rows={content.appendices} title="Lampiran" create={() => ({ title: "", content: "", source: "" })} onChange={(rows) => change("appendices", rows)} render={(row, update) => <><Field label="Judul" value={row.title} onChange={(title) => update({ ...row, title })} /><Field label="Sumber / referensi angka" value={row.source} onChange={(source) => update({ ...row, source })} /><div className="md:col-span-2"><Field label="Isi lampiran" value={row.content} onChange={(value) => update({ ...row, content: value })} multiline /></div></>} /></Section>
    <Section title="Catatan pembicara AI" detail="Draf AI bukan sumber fakta. Periksa dan sunting sebelum menyampaikan."><Field label="Catatan pembicara" value={content.aiNotes} onChange={(v) => change("aiNotes", v)} multiline /></Section>
    </fieldset>
    <Section title="Lihat dan ekspor versi tersimpan"><p className="max-w-prose text-sm text-muted-foreground">Simpan perubahan terlebih dahulu. Prompt presentasi dapat membantu klarifikasi draf; HTML final hanya tersedia setelah semua pertanyaan selesai.</p><div className="flex flex-wrap gap-2"><Button variant="outline" asChild disabled={dirty || busy}><Link aria-disabled={dirty || busy} tabIndex={dirty || busy ? -1 : undefined} href={dirty || busy ? "#" : `/report/${encodeURIComponent(bundle.domain.slug)}?period=${bundle.period}`}>Lihat laporan</Link></Button>{!dirty && !busy && <MarkdownExportDialog period={bundle.period} domains={[bundle.domain]} selectedDomain={bundle.domain.slug} />}{!dirty && !busy && bundle.ready && <Button variant="outline" asChild><a href={`/api/report/presentation?${params}`} target="_blank" rel="noopener noreferrer">Buka presentasi final</a></Button>}</div>{(dirty || busy) && <p className="text-sm text-muted-foreground">Ekspor tidak tersedia sampai draf disimpan.</p>}{!bundle.ready && !dirty && <p className="text-sm text-muted-foreground">Presentasi final belum tersedia: jawab pertanyaan di atas, lalu simpan.</p>}</Section>
    {/* Salinan tombol simpan yang menempel di bawah; outline berisi kartu agar primary tetap satu per layar. */}
    <div className="pointer-events-none sticky bottom-3 flex justify-end"><Button type="button" variant="outline" className="pointer-events-auto bg-card" onClick={() => void save()} disabled={busy || conflict || !dirty}>{busy ? "Memproses…" : "Simpan draf"}</Button></div>
  </div>;
}
