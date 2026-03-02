import { notFound } from "next/navigation";
import { getDomainBySlug, getKPIsWithLatestEntry } from "@/lib/queries";
import { getAchievementPct, getKPIStatus, statusConfig } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, listLastNMonths } from "@/lib/period";
import { BarChart2, TrendingUp, Users, Settings } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { ReportPeriodSelector } from "@/components/report-period-selector";
import type { Metadata } from "next";

const domainIconMap: Record<string, React.ElementType> = { TrendingUp, Users, Settings, BarChart2 };

interface Props {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ period?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  return { title: domain ? `Scorecard ${domain.name}` : "Scorecard" };
}

export default async function ReportPage({ params, searchParams }: Props) {
  const [{ domain: slug }, { period }] = await Promise.all([params, searchParams]);

  const months = listLastNMonths(12);
  const selectedPeriod = period ?? months[0]?.value;

  const domain = await getDomainBySlug(slug);
  if (!domain) notFound();

  const kpisWithEntries = await getKPIsWithLatestEntry(domain.id, selectedPeriod);

  const now = new Date();
  const printDate = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const periodLabel = selectedPeriod ? formatPeriodDate(selectedPeriod, "MMMM yyyy") : "—";
  const Icon = domainIconMap[domain.icon] ?? BarChart2;

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-4xl mx-auto print:p-0 print:max-w-full">
      {/* Header */}
      <header className="flex items-start justify-between border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8" style={{ color: domain.color }} />
          <div>
            <h1 className="text-2xl font-bold">KPI Scorecard — {domain.name}</h1>
            <p className="text-sm text-gray-500">{domain.description ?? "Laporan performa KPI"}</p>
          </div>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Periode: <strong className="text-black">{periodLabel}</strong></p>
          <p>Dicetak: {printDate}</p>
        </div>
      </header>

      {/* Summary counts */}
      <div className="flex gap-6 mb-6 text-sm">
        {(["green", "yellow", "red", "no-data"] as const).map((s) => {
          const count = kpisWithEntries.filter(({ kpi, latestEntry, effectiveTarget }) =>
            getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget }) === s
          ).length;
          const cfg = statusConfig[s];
          if (count === 0) return null;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-full ${s === "green" ? "bg-green-500" : s === "yellow" ? "bg-yellow-500" : s === "red" ? "bg-red-500" : "bg-gray-300"}`} />
              <span>{count} {cfg.label}</span>
            </div>
          );
        })}
        <span className="ml-auto text-gray-400">{kpisWithEntries.length} KPI total</span>
      </div>

      {/* KPI Table */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-2 pr-4 font-semibold">KPI</th>
            <th className="text-right py-2 px-4 font-semibold">Nilai Aktual</th>
            <th className="text-right py-2 px-4 font-semibold">Target</th>
            <th className="text-right py-2 px-4 font-semibold">Pencapaian</th>
            <th className="text-center py-2 pl-4 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {kpisWithEntries.map(({ kpi, latestEntry, effectiveTarget }) => {
            const tgt = effectiveTarget;
            const status = getKPIStatus(latestEntry?.value, { ...kpi, ...tgt });
            const pct = getAchievementPct(latestEntry?.value, tgt.target);
            const cfg = statusConfig[status];
            const statusDot = status === "green" ? "bg-green-500" : status === "yellow" ? "bg-yellow-400" : status === "red" ? "bg-red-500" : "bg-gray-300";

            return (
              <tr key={kpi.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-2.5 pr-4">
                  <div className="font-medium">{kpi.name}</div>
                  {kpi.description && <div className="text-xs text-gray-400 truncate max-w-xs">{kpi.description}</div>}
                </td>
                <td className="text-right py-2.5 px-4 font-semibold">
                  {latestEntry ? formatValue(latestEntry.value, kpi.unit) : "—"}
                </td>
                <td className="text-right py-2.5 px-4 text-gray-500">
                  {formatValue(tgt.target, kpi.unit)}
                </td>
                <td className="text-right py-2.5 px-4">
                  {pct !== null ? `${pct}%` : "—"}
                </td>
                <td className="py-2.5 pl-4">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusDot}`} />
                    <span className="text-xs">{cfg.label}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
        <span>KPI Dashboard — {domain.name}</span>
        <span>Generated {printDate}</span>
      </footer>

      <div className="mt-8 flex gap-3 print:hidden">
        <PrintButton />
        <ReportPeriodSelector months={listLastNMonths(24)} selectedPeriod={selectedPeriod ?? ""} />
        <a
          href={`/domain/${domain.slug}`}
          className="px-4 py-2 border text-sm rounded hover:bg-gray-50 transition-colors"
        >
          ← Kembali
        </a>
      </div>
    </div>
  );
}
