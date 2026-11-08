"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { MarkdownExportDialog } from "@/components/report/markdown-export-dialog";
import { REPORT_DIVISIONS, type ComputedReportValue, type MonthlyReportBundle, type MonthlyReportContent, type MonthlyReportMetric, type MonthlyObservation, type ObservationState } from "@/lib/monthly-report-types";
import { statusConfig } from "@/lib/kpi-status";
import { ChevronRight } from "lucide-react";

const inputClass = "min-w-0 space-y-1.5";
const sectionClass = "space-y-4 border-t pt-6";
// Select native disamakan dengan Input: tepi 3:1 konstan, fokus = outline inset.
const selectClass = "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm font-normal outline-2 outline-offset-[-3px] outline-transparent transition-colors duration-[var(--dur-micro)] focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55";
const stateOptions: { value: ObservationState; label: string }[] = [
  { value: "missing", label: "Belum diketahui" }, { value: "provided", label: "Tersedia" }, { value: "untracked", label: "Belum dilacak (dikonfirmasi)" },
];

function Field({ label, value, onChange, multiline = false, hint, type = "text" }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; hint?: string; type?: string }) {
  return <div className={inputClass}><Label className="block">{label}{multiline
    ? <Textarea className="mt-1.5 font-normal" value={value} onChange={(e) => onChange(e.target.value)} />
    : <Input className={type === "date" ? "num mt-1.5 font-normal" : "mt-1.5 font-normal"} type={type} value={value} onChange={(e) => onChange(e.target.value)} />}</Label>{hint && <p className="text-sm text-muted-foreground">{hint}</p>}</div>;
}
function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <div className={inputClass}><Label className="block">{label}<select className={`${selectClass} mt-1.5`} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Label></div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <Label className="flex max-w-prose items-start gap-2.5 font-normal leading-5"><input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></Label>;
}
function NumberField({ label, value, onChange, disabled = false }: { label: string; value: number | null; onChange: (value: number | null) => void; disabled?: boolean }) {
  return <div className={inputClass}><Label className="block">{label}<Input className="num mt-1.5 font-normal" type="number" step="any" disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} /></Label></div>;
}
function Section({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return <section className={sectionClass}><div><h2 className="text-lg font-semibold">{title}</h2>{detail && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{detail}</p>}</div>{children}</section>;
}
function RowGroup<T>({ rows, title, create, onChange, render, maxRows }: { rows: T[]; title: string; create: () => T; onChange: (rows: T[]) => void; render: (row: T, update: (row: T) => void, index: number) => React.ReactNode; maxRows?: number }) {
  return <div className="space-y-3">{rows.map((row, index) => <div key={index} className="space-y-3 rounded-card bg-paper-2 p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-base font-semibold">{title} <span className="num">{index + 1}</span></h3><Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Hapus ${title} ${index + 1}`}>Hapus</Button></div><div className="grid gap-3 md:grid-cols-2">{render(row, (next) => onChange(rows.map((item, i) => i === index ? next : item)), index)}</div></div>)}<Button type="button" variant="outline" size="sm" disabled={maxRows !== undefined && rows.length >= maxRows} onClick={() => onChange([...rows, create()])}>Tambah {title.toLowerCase()}</Button></div>;
}
function observationLabel(month: string, period: string) {
  const label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T00:00:00Z`));
  const [year, m] = period.split("-").map(Number);
  const previous = new Date(Date.UTC(year, m - 2, 1)).toISOString().slice(0, 10);
  return `${label}${month === period ? " (bulan laporan)" : month === previous ? " (bulan sebelumnya)" : ""}`;
}
function computedText(item: ComputedReportValue) {
  return item.state === "provided" ? item.value ?? "belum dihitung" : item.state === "untracked" ? "belum dilacak" : "belum lengkap";
}
function MetricEditor({ metric, computed, period, onChange }: { metric: MonthlyReportMetric; computed: MonthlyReportBundle["metrics"][number] | undefined; period: string; onChange: (metric: MonthlyReportMetric) => void }) {
  function observation(index: number, next: MonthlyObservation) { onChange({ ...metric, observations: metric.observations.map((item, i) => i === index ? next : item) }); }
  const renderedMonths = new Set(metric.observations.map((item) => item.month));
  const [year, month] = period.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
  const missingMonths = [previous, period].filter((item) => !renderedMonths.has(item));
  // Disclosure = konten interaktif sendiri: kartu ber-border dengan padding pada summary dan isi.
  return <details className="group rounded-card border" open={metric.definitionConfirmed ? undefined : true}><summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3"><ChevronRight aria-hidden className="size-4 shrink-0 self-center text-muted-foreground group-open:rotate-90" /><span className="font-semibold">{metric.name}</span><span className="text-sm text-muted-foreground">{metric.unit || "satuan belum diisi"}</span>{computed?.missedTarget && <span className={`rounded-sm px-1.5 py-0.5 text-xs font-semibold ${statusConfig.red.bg} ${statusConfig.red.color}`}>target belum tercapai</span>}</summary><div className="space-y-5 border-t px-4 py-4">
    <div className="grid gap-3 md:grid-cols-2"><Field label="Nama KPI" value={metric.name} onChange={(name) => onChange({ ...metric, name })} /><Field label="Satuan" value={metric.unit} onChange={(unit) => onChange({ ...metric, unit })} /><Field label="Definisi KPI" value={metric.definition} onChange={(definition) => onChange({ ...metric, definition })} multiline /><Choice label="Arah target" value={metric.direction} onChange={(direction) => onChange({ ...metric, direction: direction as MonthlyReportMetric["direction"] })} options={[{ value: "higher_better", label: "Semakin tinggi semakin baik" }, { value: "lower_better", label: "Semakin rendah semakin baik" }]} /></div>
    <Toggle label="Definisi dan target KPI sudah diperiksa; bila belum jelas atau berubah, sudah dikonfirmasi dengan CEO sebelum dinyatakan final" checked={metric.definitionConfirmed} onChange={(definitionConfirmed) => onChange({ ...metric, definitionConfirmed })} />
    <div className="grid gap-3 md:grid-cols-2"><Choice label="Aturan agregasi YTD" value={metric.aggregation ?? ""} onChange={(aggregation) => onChange({ ...metric, aggregation: aggregation ? aggregation as MonthlyReportMetric["aggregation"] : null })} options={[{ value: "", label: "Pilih aturan" }, { value: "sum", label: "Jumlah bulanan" }, { value: "average", label: "Rata-rata bulanan" }, { value: "latest", label: "Nilai terakhir (posisi akhir bulan)" }, { value: "ratio", label: "Rasio pembilang / penyebut" }]} /><Field label="Penjelasan agregasi / cakupan pengukuran" value={metric.aggregationNote} onChange={(aggregationNote) => onChange({ ...metric, aggregationNote })} multiline /></div>
    <div className="grid gap-3 md:grid-cols-2"><Field label="Kunci metrik bersama (opsional)" value={metric.sharedMetricKey} onChange={(sharedMetricKey) => onChange({ ...metric, sharedMetricKey })} hint="Gunakan kunci sama untuk angka yang dilaporkan lintas divisi." /><Field label="Catatan rekonsiliasi definisi dan sumber" value={metric.reconciliationNote} onChange={(reconciliationNote) => onChange({ ...metric, reconciliationNote })} multiline /></div>
    <Toggle label="Saya sudah memeriksa apakah metrik ini dipakai bersama divisi lain" checked={metric.sharingReviewed} onChange={(sharingReviewed) => onChange({ ...metric, sharingReviewed })} />
    <div className="grid gap-3 md:grid-cols-2"><Field label="Penyebab deviasi target (jika meleset)" value={metric.deviationCause} onChange={(deviationCause) => onChange({ ...metric, deviationCause })} multiline /><Field label="Bukti / referensi deviasi" value={metric.deviationEvidence} onChange={(deviationEvidence) => onChange({ ...metric, deviationEvidence })} multiline /></div>
    <div><h3 className="text-base font-semibold">Riwayat bulanan</h3><p className="mt-1 max-w-prose text-sm text-muted-foreground">Isi setiap bulan untuk YTD. Kosong berarti belum diketahui; nol adalah angka sah. Untuk rasio, isi pembilang dan penyebut beserta sumbernya.</p></div>
    {missingMonths.length > 0 && <p className="text-sm text-destructive">Bulan <span className="num">{missingMonths.join(", ")}</span> belum ada di snapshot. Muat ulang untuk memulihkan cakupan KPI.</p>}
    {metric.observations.map((row, index) => <div key={row.month} className="space-y-3 border-t pt-4"><h4 className="text-sm font-semibold">{observationLabel(row.month, period)}</h4><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Choice label="Status angka" value={row.state} onChange={(state) => observation(index, { ...row, state: state as ObservationState, actual: state === "provided" ? row.actual : null })} options={stateOptions} />
      <NumberField label="Realisasi" value={row.actual} disabled={row.state !== "provided"} onChange={(actual) => observation(index, { ...row, actual })} />
      <NumberField label="Target" value={row.target} onChange={(target) => observation(index, { ...row, target })} />
      <Field label="Sumber realisasi" value={row.source} onChange={(source) => observation(index, { ...row, source })} />
      <Field label="Sumber target" value={row.targetSource} onChange={(targetSource) => observation(index, { ...row, targetSource })} />
      {metric.aggregation === "ratio" && <><NumberField label="Pembilang" value={row.numerator} disabled={row.state !== "provided"} onChange={(numerator) => observation(index, { ...row, numerator })} /><NumberField label="Penyebut" value={row.denominator} disabled={row.state !== "provided"} onChange={(denominator) => observation(index, { ...row, denominator })} /></>}
    </div></div>)}
    {computed && <div className="space-y-2"><p className="text-sm font-semibold">Hitungan tersimpan</p><dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm sm:grid-cols-3 sm:gap-x-8">
      {([["Bulan ini", computed.current], ["Bulan lalu", computed.previous], ["YTD", computed.ytd]] as const).map(([term, item]) => <div key={term} className="col-span-2 grid grid-cols-subgrid sm:col-span-1 sm:flex sm:flex-col sm:gap-0.5"><dt className="text-muted-foreground">{term}</dt><dd className={item.state === "provided" && item.value !== null ? "num font-semibold" : "text-muted-foreground"}>{computedText(item)}</dd></div>)}
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
  const params = new URLSearchParams({ domain: bundle.domain.slug, period: bundle.period });
  function change<K extends keyof MonthlyReportContent>(key: K, value: MonthlyReportContent[K]) {
    const next = { ...contentRef.current, [key]: value };
    contentRef.current = next;
    setContent(next);
    setDirty(true);
    setNotice("");
    setAiQuestions(null);
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
      if (contentRef.current === snapshot) { contentRef.current = saved.content; setContent(saved.content); setDirty(false); }
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
  return <div className="max-w-6xl space-y-10 pb-12">
    <div className="space-y-4">
      <PageHeader title={`Laporan bulanan: ${bundle.domain.name}`} description={<>Periode <span className="num">{bundle.period}</span>, revisi <span className="num">{bundle.revision}</span>{bundle.updatedAt ? <>, diperbarui <span className="num">{new Date(bundle.updatedAt).toLocaleString("id-ID")}</span></> : ", belum disimpan"}</>} actions={<Button variant="outline" size="sm" asChild><Link href={`/admin/reports/monthly?period=${bundle.period}`}>Semua domain</Link></Button>} />
      <div className="flex flex-wrap items-center gap-2 border-y py-3">
        <div className="mr-auto"><span className={`inline-block rounded-sm px-2 py-0.5 text-sm ${dirty ? "border border-edge" : "bg-secondary"}`}>{dirty ? "Perubahan belum disimpan" : bundle.ready ? "Siap untuk presentasi final" : <>Draf, <span className="num">{questionCount}</span> pertanyaan terbuka</>}</span></div>
        <Button type="button" variant="outline" onClick={() => void assist()} disabled={busy || conflict}>{busy ? "Memproses…" : "Periksa / Bantu dengan AI"}</Button>
        <Button type="button" onClick={() => void save()} disabled={busy || conflict || !dirty}>{busy ? "Memproses…" : "Simpan draf"}</Button>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card bg-danger-soft p-3 text-sm text-danger"><p>{error}</p>{conflict && <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>Muat versi terbaru</Button>}</div>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    </div>
    <section className="space-y-3 rounded-card bg-paper-2 p-4 sm:p-5" aria-label="Kelengkapan laporan"><h2 className="text-lg font-semibold">Pertanyaan yang perlu dijawab</h2><p className="max-w-prose text-sm text-muted-foreground">{dirty ? "Pertanyaan berikut dari versi tersimpan; simpan untuk menghitung ulang." : "Angka belum dilacak boleh dikonfirmasi, bukan diganti perkiraan."}</p>{(aiQuestions ?? bundle.questions).length ? <ul className="max-w-prose list-disc space-y-1.5 pl-5 text-sm">{(aiQuestions ?? bundle.questions).map((q) => <li key={q.id}>{q.question} <span className="text-xs text-muted-foreground">({q.path})</span></li>)}</ul> : <p className="text-sm">Tidak ada pertanyaan terbuka pada versi tersimpan.</p>}</section>
    {bundle.reconciliations.length > 0 && <section className="space-y-3" aria-labelledby="reconciliation-title"><h2 id="reconciliation-title" className="text-lg font-semibold">Rekonsiliasi lintas divisi</h2>{bundle.reconciliations.map((item) => <div key={item.metricKey} className="space-y-1 border-t pt-3 text-sm"><p className="font-semibold">{item.metricKey}: <span className={item.state === "conflict" ? "text-destructive" : "font-normal text-muted-foreground"}>{item.state === "matched" ? "Cocok" : item.state === "conflict" ? "Selisih, perlu dikoreksi" : "Menunggu divisi lain"}</span></p><p className="max-w-prose">{item.detail}</p><ul className="flex flex-wrap gap-x-6 gap-y-1">{item.peers.map((peer) => <li key={peer.domainId}><Link className="underline underline-offset-4" href={`/admin/reports/monthly?period=${bundle.period}#domain-${peer.domainId}`}>{peer.domainName}</Link>: <span className="num">{peer.value ?? "belum tersedia"}</span> {peer.unit} <span className="text-muted-foreground">({peer.source || "tanpa sumber"})</span></li>)}</ul></div>)}</section>}
    <fieldset disabled={busy || conflict} className="min-w-0 space-y-10">
    <Section title="Ringkasan eksekutif" detail="Dua sampai empat poin utama lain ditambah satu hal paling tidak berjalan baik (total 3 sampai 5 poin); cantumkan sumber angka dalam narasi.">
      <Choice label="Divisi laporan" value={content.division ?? ""} onChange={(division) => change("division", division ? division as MonthlyReportContent["division"] : null)} options={[{ value: "", label: "Pilih divisi secara eksplisit" }, ...Object.entries(REPORT_DIVISIONS).map(([value, label]) => ({ value, label }))]} />
      <RowGroup rows={content.summary} title="Poin utama lain" maxRows={4} create={() => ""} onChange={(rows) => change("summary", rows)} render={(text, update) => <div className="md:col-span-2"><Field label="Isi poin" value={text} onChange={update} multiline /></div>} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Satu hal paling tidak berjalan baik periode ini" value={content.worstOutcome} onChange={(v) => change("worstOutcome", v)} multiline />
        <Field label="Sumber angka pada ringkasan, isu, tindakan, dan keputusan" value={content.narrativeSource} onChange={(v) => change("narrativeSource", v)} multiline hint="Cantumkan referensi asal untuk setiap angka dalam narasi." />
      </div>
      <Field label="Alasan perubahan set KPI dari bulan sebelumnya" value={content.kpiSetChangeNote} onChange={(v) => change("kpiSetChangeNote", v)} multiline hint="Isi bila indikator bertambah, hilang, atau definisinya berubah." />
    </Section>
    <p className="text-sm text-muted-foreground">Perubahan di sini hanya mengubah snapshot laporan bulanan tersimpan, bukan entri KPI asal. Laporan dan presentasi memakai snapshot ini setelah disimpan.</p>
    <Section title="KPI, target, MoM & YTD" detail="Klik setiap KPI untuk mengisi definisi, sumber, riwayat bulanan, target, agregasi, dan bukti deviasi.">{content.metrics.length ? content.metrics.map((metric, index) => <MetricEditor key={metric.kpiId} metric={metric} computed={bundle.metrics.find((item) => item.kpiId === metric.kpiId)} period={bundle.period} onChange={(next) => change("metrics", content.metrics.map((item, i) => i === index ? next : item))} />) : <p className="text-sm text-muted-foreground">Belum ada KPI aktif untuk domain ini. Tambahkan KPI melalui Kelola KPI, lalu muat ulang laporan.</p>}</Section>
    <Section title="Isu, risiko & eskalasi"><Toggle label="Daftar risiko sudah diperiksa; kosong berarti tidak ada risiko yang perlu dilaporkan" checked={content.risksReviewed} onChange={(v) => change("risksReviewed", v)} /><RowGroup rows={content.risks} title="Risiko" create={() => ({ issue: "", impact: "", escalationOwner: "" })} onChange={(rows) => change("risks", rows)} render={(row, update) => <><Field label="Isu / risiko" value={row.issue} onChange={(issue) => update({ ...row, issue })} multiline /><Field label="Dampak" value={row.impact} onChange={(impact) => update({ ...row, impact })} multiline /><Field label="Pemilik eskalasi" value={row.escalationOwner} onChange={(escalationOwner) => update({ ...row, escalationOwner })} /></>} /></Section>
    <Section title="Rencana bulan depan" detail="Satu atau lebih tindakan konkret dengan PIC dan tenggat."><RowGroup rows={content.actions} title="Tindakan" create={() => ({ action: "", pic: "", deadline: "" })} onChange={(rows) => change("actions", rows)} render={(row, update) => <><Field label="Tindakan" value={row.action} onChange={(action) => update({ ...row, action })} multiline /><Field label="PIC" value={row.pic} onChange={(pic) => update({ ...row, pic })} /><Field label="Tenggat" type="date" value={row.deadline} onChange={(deadline) => update({ ...row, deadline })} /></>} /></Section>
    <Section title="Keputusan C-level"><Toggle label="Kebutuhan keputusan sudah diperiksa; kosong berarti tidak ada permintaan keputusan" checked={content.decisionsReviewed} onChange={(v) => change("decisionsReviewed", v)} /><RowGroup rows={content.decisions} title="Keputusan" create={() => ({ request: "", options: "", impact: "" })} onChange={(rows) => change("decisions", rows)} render={(row, update) => <><Field label="Keputusan yang diminta" value={row.request} onChange={(request) => update({ ...row, request })} multiline /><Field label="Opsi" value={row.options} onChange={(options) => update({ ...row, options })} multiline /><Field label="Dampak" value={row.impact} onChange={(impact) => update({ ...row, impact })} multiline /></>} /></Section>
    {content.division === "finance" && <Section title="Laporan keuangan" detail="Laba rugi, arus kas, dan neraca memakai angka serta sumber sendiri; tandai belum dilacak bila dikonfirmasi.">{([ ["incomeStatement", "Laba rugi"], ["cashFlow", "Arus kas"], ["balanceSheet", "Neraca"] ] as const).map(([key, label]) => <div key={key} className="space-y-3"><h3 className="font-semibold">{label}</h3><Field label={`Satuan ${label}`} value={content.finance[key].unit} onChange={(unit) => change("finance", { ...content.finance, [key]: { ...content.finance[key], unit } })} /><RowGroup rows={content.finance[key].rows} title={`Baris ${label}`} create={() => ({ label: "", value: null, source: "", state: "missing" as const })} onChange={(rows) => change("finance", { ...content.finance, [key]: { ...content.finance[key], rows } })} render={(row, update) => <><Field label="Nama pos" value={row.label} onChange={(label) => update({ ...row, label })} /><Choice label="Status" value={row.state} options={stateOptions} onChange={(state) => update({ ...row, state: state as ObservationState, value: state === "provided" ? row.value : null })} /><NumberField label="Nilai" value={row.value} disabled={row.state !== "provided"} onChange={(value) => update({ ...row, value })} /><Field label="Sumber" value={row.source} onChange={(source) => update({ ...row, source })} /></>} /></div>)}</Section>}
    <Section title="Rincian kanal & lampiran" detail="Simpan data mentah, kegiatan, dan referensi sebagai lampiran tanpa batas."><RowGroup rows={content.channelBreakdowns} title="Kanal" create={() => ({ channel: "", metric: "", value: null, unit: "", source: "", state: "missing" as const })} onChange={(rows) => change("channelBreakdowns", rows)} render={(row, update) => <><Field label="Kanal" value={row.channel} onChange={(channel) => update({ ...row, channel })} /><Field label="Metrik" value={row.metric} onChange={(metric) => update({ ...row, metric })} /><Choice label="Status" value={row.state} options={stateOptions} onChange={(state) => update({ ...row, state: state as ObservationState, value: state === "provided" ? row.value : null })} /><NumberField label="Nilai" value={row.value} disabled={row.state !== "provided"} onChange={(value) => update({ ...row, value })} /><Field label="Satuan" value={row.unit} onChange={(unit) => update({ ...row, unit })} /><Field label="Sumber angka" value={row.source} onChange={(source) => update({ ...row, source })} /></>} /><RowGroup rows={content.activities} title="Kegiatan" create={() => ""} onChange={(rows) => change("activities", rows)} render={(row, update) => <div className="md:col-span-2"><Field label="Detail kegiatan" value={row} onChange={update} multiline /></div>} /><RowGroup rows={content.appendices} title="Lampiran" create={() => ({ title: "", content: "", source: "" })} onChange={(rows) => change("appendices", rows)} render={(row, update) => <><Field label="Judul" value={row.title} onChange={(title) => update({ ...row, title })} /><Field label="Sumber / referensi angka" value={row.source} onChange={(source) => update({ ...row, source })} /><div className="md:col-span-2"><Field label="Isi lampiran" value={row.content} onChange={(value) => update({ ...row, content: value })} multiline /></div></>} /></Section>
    <Section title="Catatan pembicara AI" detail="Draf AI bukan sumber fakta. Periksa dan sunting sebelum menyampaikan."><Field label="Catatan pembicara" value={content.aiNotes} onChange={(v) => change("aiNotes", v)} multiline /></Section>
    </fieldset>
    <Section title="Lihat dan ekspor versi tersimpan"><p className="max-w-prose text-sm text-muted-foreground">Simpan perubahan terlebih dahulu. Prompt presentasi dapat membantu klarifikasi draf; HTML final hanya tersedia setelah semua pertanyaan selesai.</p><div className="flex flex-wrap gap-2"><Button variant="outline" asChild disabled={dirty || busy}><Link aria-disabled={dirty || busy} tabIndex={dirty || busy ? -1 : undefined} href={dirty || busy ? "#" : `/report/${encodeURIComponent(bundle.domain.slug)}?period=${bundle.period}`}>Lihat laporan</Link></Button>{!dirty && !busy && <MarkdownExportDialog period={bundle.period} domains={[bundle.domain]} selectedDomain={bundle.domain.slug} />}{!dirty && !busy && bundle.ready && <Button variant="outline" asChild><a href={`/api/report/presentation?${params}`} target="_blank" rel="noopener noreferrer">Buka presentasi final</a></Button>}</div>{(dirty || busy) && <p className="text-sm text-muted-foreground">Ekspor tidak tersedia sampai draf disimpan.</p>}{!bundle.ready && !dirty && <p className="text-sm text-muted-foreground">Presentasi final belum tersedia: jawab pertanyaan di atas, lalu simpan.</p>}</Section>
    {/* Salinan tombol simpan yang menempel di bawah; outline berisi kartu agar primary tetap satu per layar. */}
    <div className="pointer-events-none sticky bottom-3 flex justify-end"><Button type="button" variant="outline" className="pointer-events-auto bg-card" onClick={() => void save()} disabled={busy || conflict || !dirty}>{busy ? "Memproses…" : "Simpan draf"}</Button></div>
  </div>;
}
