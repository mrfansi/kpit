import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getMonthlyReportBundle } from "@/lib/monthly-report-store";
import { REPORT_DIVISIONS, type ComputedReportValue, type ObservationState } from "@/lib/monthly-report-types";
import { defaultReportingPeriod, listLastNMonths } from "@/lib/period";
import { isValidCalendarDate } from "@/lib/date-utils";
import { PrintButton } from "@/components/print-button";
import { ReportPeriodSelector } from "@/components/report-period-selector";

interface Props {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ period?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  return { title: `Laporan bulanan — ${domain}` };
}

function value(state: ObservationState, amount: number | null, unit: string) {
  if (amount === null && state === "untracked") return "belum dilacak";
  if (amount === null) return "belum diberikan";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(amount)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}
function ReportValue({ result, unit }: { result: ComputedReportValue; unit: string }) {
  return <span>{value(result.state, result.value, unit)}<small className="block text-muted-foreground">Sumber: {result.source || "belum diberikan"}; target: {value(result.state, result.target, unit)} (sumber: {result.targetSource || "belum diberikan"}); perhitungan: {result.calculation || "belum diberikan"}</small></span>;
}

export default async function ReportPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const [{ domain }, { period }] = await Promise.all([params, searchParams]);
  const selectedPeriod = period ?? defaultReportingPeriod();
  if (!isValidCalendarDate(selectedPeriod) || !/^\d{4}-\d{2}-01$/.test(selectedPeriod)) notFound();
  const bundle = await getMonthlyReportBundle(domain, selectedPeriod);
  if (!bundle) notFound();
  const { content } = bundle;
  const query = `domain=${encodeURIComponent(domain)}&period=${selectedPeriod}`;
  const month = selectedPeriod.slice(0, 7);
  const previous = new Date(Date.UTC(Number(selectedPeriod.slice(0, 4)), Number(selectedPeriod.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  const misses = content.metrics.filter((metric) => bundle.metrics.find((row) => row.kpiId === metric.kpiId)?.missedTarget);
  const allMeasured = content.metrics.length > 0 && content.metrics.every((metric) => {
    const current = bundle.metrics.find((row) => row.kpiId === metric.kpiId)?.current;
    return current?.state === "provided" && current.value !== null && current.target !== null;
  });
  const statements = [
    ["Laba rugi", content.finance.incomeStatement],
    ["Arus kas", content.finance.cashFlow],
    ["Neraca", content.finance.balanceSheet],
  ] as const;
  return <article className="min-h-screen bg-background text-foreground p-4 sm:p-8 max-w-6xl mx-auto print:p-0 print:max-w-full print:bg-white print:text-black space-y-8">
    <header className="border-b-2 border-foreground pb-4 flex flex-wrap gap-4 justify-between">
      <div><p className="text-sm text-muted-foreground">Laporan bulanan divisi · {month}</p><h1 className="text-2xl font-bold">{content.division ? REPORT_DIVISIONS[content.division] : "Divisi belum dipilih"} — {bundle.domain.name}</h1><p className="text-sm">Revisi {bundle.revision} · {bundle.ready ? "Siap dipresentasikan" : "Draft — belum siap dipresentasikan"}</p></div>
      <div className="print:hidden flex flex-wrap items-start gap-2"><ReportPeriodSelector months={listLastNMonths(24)} selectedPeriod={selectedPeriod} /><PrintButton /><Link className="px-3 py-2 border rounded text-sm" href={`/admin/reports/monthly/${domain}?period=${selectedPeriod}`}>Edit laporan</Link></div>
    </header>
    {!bundle.ready && <section className="rounded-lg border border-amber-500 p-4" aria-label="Kelengkapan laporan"><h2 className="font-semibold">Periksa dan lengkapi sebelum presentasi</h2><ol className="list-decimal pl-6 mt-2">{bundle.questions.map((question) => <li key={question.id}>{question.question}</li>)}</ol></section>}
    <nav className="flex flex-wrap gap-3 print:hidden" aria-label="Ekspor laporan">
      <Link href={`/api/report/markdown?${query}&format=full`} className="underline">Markdown lengkap</Link>
      <Link href={`/api/report/markdown?${query}&format=brief`} className="underline">Ringkas</Link>
      <Link href={`/api/report/markdown?${query}&format=presentation`} className="underline">Prompt klarifikasi AI</Link>
      {bundle.ready && <Link href={`/api/report/presentation?${query}`} target="_blank" rel="noopener noreferrer" className="underline">Presentasi HTML</Link>}
    </nav>
    <section className="break-inside-avoid-page"><h2 className="text-xl font-semibold mb-2">1. Ringkasan eksekutif</h2><ul className="list-disc pl-6">{content.summary.map((point, index) => <li key={index}>{point}</li>)}<li><strong>Hasil paling tidak berjalan baik:</strong> {content.worstOutcome || "belum diberikan"}</li></ul><p className="text-xs text-muted-foreground mt-2">Sumber narasi dan angka: {content.narrativeSource || "belum diberikan"}</p></section>
    <section><h2 className="text-xl font-semibold mb-2">2. KPI vs target</h2><p className="text-sm text-muted-foreground mb-2">Daftar KPI bulanan tetap. Perubahan daftar: {content.kpiSetChangeNote || "tidak ada perubahan yang dikonfirmasi"}</p><div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr className="border-b-2"><th scope="col" className="p-2 text-left">KPI / definisi</th><th scope="col" className="p-2 text-left">Aktual, target, sumber dan rumus</th><th scope="col" className="p-2 text-left">Hasil</th></tr></thead><tbody>{content.metrics.map((metric) => { const result = bundle.metrics.find((row) => row.kpiId === metric.kpiId); return <tr key={metric.kpiId} className="border-b align-top"><td className="p-2"><strong>{metric.name}</strong><small className="block">{metric.definition}; agregasi {metric.aggregation || "belum ditetapkan"} — {metric.aggregationNote}</small></td><td className="p-2">{result ? <ReportValue result={result.current} unit={metric.unit} /> : "belum dihitung"}</td><td className="p-2">{result?.missedTarget ? "Meleset dari target" : "—"}</td></tr>; })}</tbody></table></div></section>
    <section><h2 className="text-xl font-semibold mb-2">3. Tren MoM dan YTD</h2><p className="text-sm text-muted-foreground mb-2">Sebelumnya {previous}; kini {month}; YTD Januari–{month}. Aturan agregasi dan sumber ditampilkan per metrik.</p><div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr className="border-b-2"><th className="p-2 text-left">KPI</th><th className="p-2 text-left">Sebelumnya</th><th className="p-2 text-left">Kini</th><th className="p-2 text-left">MoM</th><th className="p-2 text-left">YTD</th></tr></thead><tbody>{content.metrics.map((metric) => { const result = bundle.metrics.find((row) => row.kpiId === metric.kpiId); return <tr key={metric.kpiId} className="border-b align-top"><th scope="row" className="p-2 text-left">{metric.name}</th><td className="p-2">{result && <ReportValue result={result.previous} unit={metric.unit} />}</td><td className="p-2">{result && <ReportValue result={result.current} unit={metric.unit} />}</td><td className="p-2">{result?.momPercent == null ? "tidak dapat dihitung" : <>{result.momPercent.toFixed(2)}%<small className="block text-muted-foreground">Dihitung dari aktual {previous} dan {month}; sumber: {result.previous.source}; {result.current.source}</small></>}</td><td className="p-2">{result && <ReportValue result={result.ytd} unit={metric.unit} />}</td></tr>; })}</tbody></table></div></section>
    {content.division === "finance" && statements.map(([title, statement]) => <section key={title}><h2 className="text-xl font-semibold mb-2">{title}</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Pos</th><th className="text-left p-2">Aktual</th><th className="text-left p-2">Sumber</th></tr></thead><tbody>{statement.rows.map((row, index) => <tr key={index} className="border-b"><td className="p-2">{row.label}</td><td className="p-2">{value(row.state, row.value, statement.unit)}</td><td className="p-2">{row.source || "belum diberikan"}</td></tr>)}</tbody></table></div></section>)}
    <section className="break-inside-avoid-page"><h2 className="text-xl font-semibold">4. Penyebab deviasi dan bukti</h2>{misses.length ? <ul className="list-disc pl-6">{misses.map((metric) => <li key={metric.kpiId}><strong>{metric.name}</strong>: {metric.deviationCause || "belum diberikan"}; bukti: {metric.deviationEvidence || "belum diberikan"}</li>)}</ul> : <p>{allMeasured ? "Semua KPI terukur memenuhi target." : "Tidak dapat dinilai; metrik belum dilacak atau belum lengkap."}</p>}<p className="text-xs text-muted-foreground">Sumber: {content.narrativeSource || "belum diberikan"}</p></section>
    <section className="break-inside-avoid-page"><h2 className="text-xl font-semibold">5. Isu, risiko, eskalasi</h2>{content.risks.length ? <ul className="list-disc pl-6">{content.risks.map((risk, index) => <li key={index}>{risk.issue}; dampak: {risk.impact}; perlu turun tangan: {risk.escalationOwner}</li>)}</ul> : <p>{content.risksReviewed ? "Tidak ada risiko yang dilaporkan." : "Risiko belum ditinjau."}</p>}<p className="text-xs text-muted-foreground">Sumber: {content.narrativeSource || "belum diberikan"}</p></section>
    <section className="break-inside-avoid-page"><h2 className="text-xl font-semibold">6. Rencana bulan depan</h2><ul className="list-disc pl-6">{content.actions.map((action, index) => <li key={index}>{action.action}; PIC: {action.pic}; tenggat: {action.deadline}</li>)}</ul><p className="text-xs text-muted-foreground">Sumber: {content.narrativeSource || "belum diberikan"}</p></section>
    {(content.decisions.length > 0 || !content.decisionsReviewed) && <section className="break-inside-avoid-page"><h2 className="text-xl font-semibold">7. Keputusan C-level</h2>{content.decisions.length ? <ul className="list-disc pl-6">{content.decisions.map((decision, index) => <li key={index}>{decision.request}; pilihan: {decision.options}; dampak: {decision.impact}</li>)}</ul> : <p>Belum dikonfirmasi.</p>}<p className="text-xs text-muted-foreground">Sumber: {content.narrativeSource || "belum diberikan"}</p></section>}
    <section><h2 className="text-xl font-semibold">Rekonsiliasi lintas divisi</h2>{bundle.reconciliations.length ? <ul className="list-disc pl-6">{bundle.reconciliations.map((item) => <li key={item.metricKey}>{item.metricKey}: {item.state}; {item.detail}. {item.peers.map((peer) => `${peer.domainName}: ${peer.value === null ? "belum diberikan" : value("provided", peer.value, peer.unit)} (sumber: ${peer.source})`).join("; ")}</li>)}</ul> : <p>Tidak ada metrik bersama yang dideklarasikan.</p>}</section>
    {content.aiNotes.trim() && <section><h2 className="text-xl font-semibold">Catatan presenter — draft bantuan AI, bukan sumber fakta</h2><p className="whitespace-pre-wrap">{content.aiNotes}</p><p className="text-xs">Sumber fakta asli: {content.narrativeSource || "belum diberikan"}</p><ul className="text-xs">{content.metrics.map((metric) => { const current = bundle.metrics.find((row) => row.kpiId === metric.kpiId)?.current; return <li key={metric.kpiId}>{metric.name}: {current?.source || "belum diberikan"}; target: {current?.targetSource || "belum diberikan"}</li>; })}</ul></section>}
    <section className="border-t pt-4"><h2 className="text-xl font-semibold mb-2">Lampiran — tidak termasuk slide inti</h2>{content.metrics.map((metric) => <div key={metric.kpiId} className="mb-6"><h3 className="font-semibold">{metric.name}: riwayat bulanan</h3><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{["Bulan", "Aktual", "Target", "Sumber aktual", "Sumber target", "Pembilang", "Penyebut"].map((name) => <th key={name} className="p-2 text-left">{name}</th>)}</tr></thead><tbody>{metric.observations.map((row) => <tr key={row.month} className="border-b"><td className="p-2">{row.month}</td><td className="p-2">{value(row.state, row.actual, metric.unit)}</td><td className="p-2">{value(row.state, row.target, metric.unit)}</td><td className="p-2">{row.source}</td><td className="p-2">{row.targetSource}</td><td className="p-2">{row.numerator ?? "—"}</td><td className="p-2">{row.denominator ?? "—"}</td></tr>)}</tbody></table></div></div>)}<h3 className="font-semibold">Channel</h3><ul className="list-disc pl-6">{content.channelBreakdowns.map((row, index) => <li key={index}>{row.channel} — {row.metric}: {value(row.state, row.value, row.unit)}; sumber: {row.source}</li>)}</ul><h3 className="font-semibold mt-4">Aktivitas</h3><ul className="list-disc pl-6">{content.activities.map((item, index) => <li key={index}>{item}</li>)}</ul>{content.appendices.map((item, index) => <div key={index} className="mt-4"><h3 className="font-semibold">{item.title}</h3><p className="whitespace-pre-wrap">{item.content}</p><p className="text-xs">Sumber: {item.source}</p></div>)}</section>
    <p className="text-xs text-muted-foreground">Sumber aktivitas lampiran: {content.narrativeSource || "belum diberikan"}</p>
    <footer className="border-t pt-4 text-sm text-muted-foreground print:hidden"><Link href={`/domain/${domain}`} className="underline">Kembali ke domain</Link></footer>
  </article>;
}
