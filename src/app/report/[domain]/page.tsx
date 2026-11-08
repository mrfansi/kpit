import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { auth } from "@/auth";
import { getMonthlyReportBundle } from "@/lib/monthly-report-store";
import { REPORT_DIVISIONS, type ComputedReportValue, type ObservationState } from "@/lib/monthly-report-types";
import { defaultReportingPeriod, listLastNMonths } from "@/lib/period";
import { isValidCalendarDate } from "@/lib/date-utils";
import { statusConfig } from "@/lib/kpi-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { ReportPeriodSelector } from "@/components/report-period-selector";

interface Props {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ period?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  return { title: `Laporan bulanan: ${domain}` };
}

function value(state: ObservationState, amount: number | null, unit: string) {
  if (amount === null && state === "untracked") return "belum dilacak";
  if (amount === null) return "belum diberikan";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(amount)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}
function ReportValue({ result, unit }: { result: ComputedReportValue; unit: string }) {
  return <span><span className="num text-base font-semibold">{value(result.state, result.value, unit)}</span><small className="mt-0.5 block text-xs text-muted-foreground">Sumber: {result.source || "belum diberikan"}; target: <span className="num">{value(result.state, result.target, unit)}</span> (sumber: {result.targetSource || "belum diberikan"}); perhitungan: {result.calculation || "belum diberikan"}</small></span>;
}

const th = "py-2 pr-4 text-left text-sm font-normal whitespace-nowrap text-muted-foreground";
const td = "py-2.5 pr-4";
const h2 = "text-lg font-semibold";
const list = "max-w-[65ch] list-disc space-y-1.5 pl-5 text-base";
const source = "text-xs text-muted-foreground";

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
  const divisionName = content.division ? REPORT_DIVISIONS[content.division] : "Divisi belum dipilih";
  // Judul = divisi; nama domain hanya disebut di baris konteks bila berbeda (hindari gema "X, X").
  const showDomainName = bundle.domain.name !== divisionName;
  return <article className="mx-auto max-w-5xl space-y-10 print:max-w-full">
    <header>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{divisionName}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Laporan bulanan divisi{showDomainName && <>, {bundle.domain.name}</>}, <span className="num font-semibold text-foreground">{month}</span></p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="num text-muted-foreground">Revisi {bundle.revision}</span>
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 print:bg-transparent print:px-0">{bundle.ready ? "Siap dipresentasikan" : "Draft, belum siap dipresentasikan"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <ReportPeriodSelector months={listLastNMonths(24)} selectedPeriod={selectedPeriod} />
          <PrintButton />
          {session.user.role === "admin" && <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/reports/monthly/${domain}?period=${selectedPeriod}`}><Pencil aria-hidden />Edit laporan</Link>
          </Button>}
        </div>
      </div>

    </header>

    {!bundle.ready && <section className="space-y-2 rounded-card bg-paper-2 p-4 print:bg-transparent print:p-0" aria-label="Kelengkapan laporan"><h2 className="text-base font-semibold">Periksa dan lengkapi sebelum presentasi</h2><ol className="max-w-[65ch] list-decimal space-y-1 pl-5 text-sm">{bundle.questions.map((question) => <li key={question.id}>{question.question}</li>)}</ol></section>}

    <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm print:hidden" aria-label="Ekspor laporan">
      <Link href={`/api/report/markdown?${query}&format=full`} className="underline underline-offset-4">Markdown lengkap</Link>
      <Link href={`/api/report/markdown?${query}&format=brief`} className="underline underline-offset-4">Ringkas</Link>
      <Link href={`/api/report/markdown?${query}&format=presentation`} className="underline underline-offset-4">Prompt klarifikasi AI</Link>
      {bundle.ready && <Link href={`/api/report/presentation?${query}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Presentasi HTML</Link>}
    </nav>

    <section className="space-y-3 break-inside-avoid-page"><h2 className={h2}>1. Ringkasan eksekutif</h2><ul className={list}>{content.summary.map((point, index) => <li key={index}>{point}</li>)}<li><strong className="font-semibold">Hasil paling tidak berjalan baik:</strong> {content.worstOutcome || "belum diberikan"}</li></ul><p className={source}>Sumber narasi dan angka: {content.narrativeSource || "belum diberikan"}</p></section>

    <section className="space-y-3"><div><h2 className={h2}>2. KPI vs target</h2><p className="mt-1 text-sm text-muted-foreground">Daftar KPI bulanan tetap. Perubahan daftar: {content.kpiSetChangeNote || "tidak ada perubahan yang dikonfirmasi"}</p></div><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="border-b"><th scope="col" className={th}>KPI / definisi</th><th scope="col" className={th}>Aktual, target, sumber dan rumus</th><th scope="col" className={cn(th, "pr-0")}>Hasil</th></tr></thead><tbody>{content.metrics.map((metric) => { const result = bundle.metrics.find((row) => row.kpiId === metric.kpiId); return <tr key={metric.kpiId} className="border-b align-top last:border-b-0"><td className={td}><strong className="font-semibold">{metric.name}</strong><small className="mt-0.5 block text-xs text-muted-foreground">{metric.definition}; agregasi {metric.aggregation || "belum ditetapkan"}{metric.aggregationNote ? `: ${metric.aggregationNote}` : ""}</small></td><td className={td}>{result ? <ReportValue result={result.current} unit={metric.unit} /> : "belum dihitung"}</td><td className="py-2.5 whitespace-nowrap">{result?.missedTarget ? <span className={statusConfig.red.color}>Meleset dari target</span> : <span className="text-muted-foreground">-</span>}</td></tr>; })}</tbody></table></div></section>

    <section className="space-y-3"><div><h2 className={h2}>3. Tren MoM dan YTD</h2><p className="mt-1 text-sm text-muted-foreground">Sebelumnya <span className="num">{previous}</span>; kini <span className="num">{month}</span>; YTD Januari sampai <span className="num">{month}</span>. Aturan agregasi dan sumber ditampilkan per metrik.</p></div><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="border-b"><th className={th}>KPI</th><th className={th}>Sebelumnya</th><th className={th}>Kini</th><th className={th}>MoM</th><th className={cn(th, "pr-0")}>YTD</th></tr></thead><tbody>{content.metrics.map((metric) => { const result = bundle.metrics.find((row) => row.kpiId === metric.kpiId); return <tr key={metric.kpiId} className="border-b align-top last:border-b-0"><th scope="row" className={cn(td, "min-w-44 text-left font-semibold")}>{metric.name}</th><td className={td}>{result && <ReportValue result={result.previous} unit={metric.unit} />}</td><td className={td}>{result && <ReportValue result={result.current} unit={metric.unit} />}</td><td className={td}>{result?.momPercent == null ? <span className="text-muted-foreground">tidak dapat dihitung</span> : <><span className="num font-semibold whitespace-nowrap">{result.momPercent > 0 ? "+" : result.momPercent < 0 ? "\u2212" : ""}{Math.abs(result.momPercent).toFixed(2)}%</span><small className="mt-0.5 block text-xs text-muted-foreground">Dihitung dari aktual {previous} dan {month}; sumber: {result.previous.source}; {result.current.source}</small></>}</td><td className="py-2.5">{result && <ReportValue result={result.ytd} unit={metric.unit} />}</td></tr>; })}</tbody></table></div></section>

    {content.division === "finance" && statements.map(([title, statement]) => <section key={title} className="space-y-3"><h2 className={h2}>{title}</h2><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="border-b"><th className={th}>Pos</th><th className={cn(th, "text-right")}>Aktual</th><th className={cn(th, "pr-0")}>Sumber</th></tr></thead><tbody>{statement.rows.map((row, index) => <tr key={index} className="border-b last:border-b-0"><td className={td}>{row.label}</td><td className={cn(td, "num text-right whitespace-nowrap")}>{value(row.state, row.value, statement.unit)}</td><td className="py-2.5 text-muted-foreground">{row.source || "belum diberikan"}</td></tr>)}</tbody></table></div></section>)}

    <section className="space-y-3 break-inside-avoid-page"><h2 className={h2}>4. Penyebab deviasi dan bukti</h2>{misses.length ? <ul className={list}>{misses.map((metric) => <li key={metric.kpiId}><strong className="font-semibold">{metric.name}</strong>: {metric.deviationCause || "belum diberikan"}; bukti: {metric.deviationEvidence || "belum diberikan"}</li>)}</ul> : <p className="max-w-[65ch] text-base">{allMeasured ? "Semua KPI terukur memenuhi target." : "Tidak dapat dinilai; metrik belum dilacak atau belum lengkap."}</p>}<p className={source}>Sumber: {content.narrativeSource || "belum diberikan"}</p></section>

    <section className="space-y-3 break-inside-avoid-page"><h2 className={h2}>5. Isu, risiko, eskalasi</h2>{content.risks.length ? <ul className={list}>{content.risks.map((risk, index) => <li key={index}>{risk.issue}; dampak: {risk.impact}; perlu turun tangan: {risk.escalationOwner}</li>)}</ul> : <p className="max-w-[65ch] text-base">{content.risksReviewed ? "Tidak ada risiko yang dilaporkan." : "Risiko belum ditinjau."}</p>}<p className={source}>Sumber: {content.narrativeSource || "belum diberikan"}</p></section>

    <section className="space-y-3 break-inside-avoid-page"><h2 className={h2}>6. Rencana bulan depan</h2><ul className={list}>{content.actions.map((action, index) => <li key={index}>{action.action}; PIC: {action.pic}; tenggat: <span className="num">{action.deadline}</span></li>)}</ul><p className={source}>Sumber: {content.narrativeSource || "belum diberikan"}</p></section>

    {(content.decisions.length > 0 || !content.decisionsReviewed) && <section className="space-y-3 break-inside-avoid-page"><h2 className={h2}>7. Keputusan C-level</h2>{content.decisions.length ? <ul className={list}>{content.decisions.map((decision, index) => <li key={index}>{decision.request}; pilihan: {decision.options}; dampak: {decision.impact}</li>)}</ul> : <p className="max-w-[65ch] text-base">Belum dikonfirmasi.</p>}<p className={source}>Sumber: {content.narrativeSource || "belum diberikan"}</p></section>}

    <section className="space-y-3"><h2 className={h2}>Rekonsiliasi lintas divisi</h2>{bundle.reconciliations.length ? <ul className={list}>{bundle.reconciliations.map((item) => <li key={item.metricKey}>{item.metricKey}: {item.state}; {item.detail}. {item.peers.map((peer) => `${peer.domainName}: ${peer.value === null ? "belum diberikan" : value("provided", peer.value, peer.unit)} (sumber: ${peer.source})`).join("; ")}</li>)}</ul> : <p className="max-w-[65ch] text-base">Tidak ada metrik bersama yang dideklarasikan.</p>}</section>

    {content.aiNotes.trim() && <section className="space-y-3"><h2 className={h2}>Catatan presenter: draft bantuan AI, bukan sumber fakta</h2><p className="max-w-[65ch] text-base whitespace-pre-wrap">{content.aiNotes}</p><p className={source}>Sumber fakta asli: {content.narrativeSource || "belum diberikan"}</p><ul className="space-y-0.5 text-xs text-muted-foreground">{content.metrics.map((metric) => { const current = bundle.metrics.find((row) => row.kpiId === metric.kpiId)?.current; return <li key={metric.kpiId}>{metric.name}: {current?.source || "belum diberikan"}; target: {current?.targetSource || "belum diberikan"}</li>; })}</ul></section>}

    <section className="space-y-6 border-t pt-6"><h2 className={h2}>Lampiran (tidak termasuk slide inti)</h2>{content.metrics.map((metric) => <div key={metric.kpiId} className="space-y-2"><h3 className="text-base font-semibold">{metric.name}: riwayat bulanan</h3><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="border-b">{["Bulan", "Aktual", "Target", "Sumber aktual", "Sumber target", "Pembilang", "Penyebut"].map((name) => <th key={name} className={th}>{name}</th>)}</tr></thead><tbody>{metric.observations.map((row) => <tr key={row.month} className="border-b last:border-b-0"><td className="num py-2 pr-4 whitespace-nowrap">{row.month}</td><td className="num py-2 pr-4 whitespace-nowrap">{value(row.state, row.actual, metric.unit)}</td><td className="num py-2 pr-4 whitespace-nowrap text-muted-foreground">{value(row.state, row.target, metric.unit)}</td><td className="py-2 pr-4">{row.source}</td><td className="py-2 pr-4">{row.targetSource}</td><td className="num py-2 pr-4">{row.numerator ?? <span className="text-muted-foreground">-</span>}</td><td className="num py-2">{row.denominator ?? <span className="text-muted-foreground">-</span>}</td></tr>)}</tbody></table></div></div>)}<div className="space-y-2"><h3 className="text-base font-semibold">Channel</h3><ul className={list}>{content.channelBreakdowns.map((row, index) => <li key={index}>{row.channel}, {row.metric}: <span className="num">{value(row.state, row.value, row.unit)}</span>; sumber: {row.source}</li>)}</ul></div><div className="space-y-2"><h3 className="text-base font-semibold">Aktivitas</h3><ul className={list}>{content.activities.map((item, index) => <li key={index}>{item}</li>)}</ul></div>{content.appendices.map((item, index) => <div key={index} className="space-y-2"><h3 className="text-base font-semibold">{item.title}</h3><p className="max-w-[65ch] text-base whitespace-pre-wrap">{item.content}</p><p className={source}>Sumber: {item.source}</p></div>)}</section>

    <p className={source}>Sumber aktivitas lampiran: {content.narrativeSource || "belum diberikan"}</p>
    <footer className="border-t pt-4 text-sm text-muted-foreground print:hidden"><Link href={`/domain/${domain}`} className="underline underline-offset-4">Kembali ke domain</Link></footer>
  </article>;
}
