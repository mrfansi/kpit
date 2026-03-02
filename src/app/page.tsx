import { Suspense } from "react";
import { getAllDomains, getAllKPIs, getEntriesForPeriod, getPinnedKPIs, getKPIsWithLatestEntry } from "@/lib/queries";
import { KPICard } from "@/components/kpi-card";
import { StatSummary } from "@/components/stat-summary";
import { DomainTabs } from "@/components/domain-tabs";
import { ExportButtons } from "@/components/export-buttons";
import { PeriodSelector } from "@/components/period-selector";
import { KPIFilterBar } from "@/components/kpi-filter-bar";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { CompletenessTracker } from "@/components/completeness-tracker";
import { KPIAlertBanner } from "@/components/kpi-alert-banner";
import { DomainStatusBadges } from "@/components/domain-status-badges";
import { Separator } from "@/components/ui/separator";
import { formatPeriodDate, listLastNMonths } from "@/lib/period";
import { getKPIStatus } from "@/lib/kpi-status";
import { Pin } from "lucide-react";

interface Props {
  searchParams: Promise<{ period?: string; q?: string; status?: string }>;
}

export default async function OverviewPage({ searchParams }: Props) {
  const { period, q, status } = await searchParams;

  const months = listLastNMonths(12);
  const selectedPeriod = period ?? months[0]?.value;

  const [domains, allKPIsWithEntries, allKPIs, entriesForPeriod] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(undefined, selectedPeriod),
    getAllKPIs(),
    getEntriesForPeriod(selectedPeriod ?? ""),
  ]);

  // Filter by search query and status
  const filtered = allKPIsWithEntries.filter(({ kpi, latestEntry, effectiveTarget }) => {
    if (q && !kpi.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (status) {
      const kpiWithTarget = effectiveTarget ? { ...kpi, ...effectiveTarget } : kpi;
      const kpiStatus = getKPIStatus(latestEntry?.value, kpiWithTarget);
      if (kpiStatus !== status) return false;
    }
    return true;
  });

  const isFiltered = Boolean(q || status);

  // Pinned KPIs (from filtered set)
  const pinnedWithEntries = !isFiltered
    ? allKPIsWithEntries.filter(({ kpi }) => kpi.isPinned)
    : [];

  const byDomain = domains.map((domain) => ({
    domain,
    kpisWithEntries: filtered.filter((k) => k.kpi.domainId === domain.id),
  })).filter(({ kpisWithEntries }) => !isFiltered || kpisWithEntries.length > 0);

  // Build kpiLatestPeriods map for smart period suggestion
  const kpiLatestPeriods: Record<number, string> = {};
  for (const { kpi, latestEntry } of allKPIsWithEntries) {
    if (latestEntry) kpiLatestPeriods[kpi.id] = latestEntry.periodDate;
  }
  const redKPIs = allKPIsWithEntries
    .filter(({ kpi, latestEntry, effectiveTarget }) => {
      const kpiWithTarget = effectiveTarget ? { ...kpi, ...effectiveTarget } : kpi;
      return getKPIStatus(latestEntry?.value, kpiWithTarget) === "red";
    })
    .map(({ kpi, latestEntry, effectiveTarget }) => ({
      kpi,
      latestEntry,
      effectiveTarget,
      domainName: domains.find((d) => d.id === kpi.domainId)?.name ?? "",
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Overview KPI</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Data per{" "}
            <span className="font-medium text-foreground">
              {selectedPeriod ? formatPeriodDate(selectedPeriod, "MMMM yyyy") : "—"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Suspense>
            <PeriodSelector defaultValue={selectedPeriod} />
          </Suspense>
          <ExportButtons />
          <QuickEntryModal kpis={allKPIs} kpiLatestPeriods={kpiLatestPeriods} />
        </div>
      </div>

      <StatSummary kpisWithEntries={allKPIsWithEntries} />

      <KPIAlertBanner redKPIs={redKPIs} />

      <CompletenessTracker kpis={allKPIs} entriesForPeriod={entriesForPeriod} period={selectedPeriod ?? ""} />

      <Suspense>
        <KPIFilterBar defaultQ={q} defaultStatus={status} />
      </Suspense>

      <DomainTabs domains={domains} />
      <Separator />

      {/* Pinned KPIs section */}
      {pinnedWithEntries.length > 0 && !isFiltered && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold">KPI Dipinned</h2>
            <span className="text-xs text-muted-foreground">({pinnedWithEntries.length} KPI)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedWithEntries.map(({ kpi, latestEntry, sparklineEntries, effectiveTarget }) => (
              <KPICard key={kpi.id} kpi={kpi} latestEntry={latestEntry} sparklineEntries={sparklineEntries} effectiveTarget={effectiveTarget} />
            ))}
          </div>
          <Separator />
        </section>
      )}

      {byDomain.map(({ domain, kpisWithEntries }) => (
        <section key={domain.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: domain.color }} />
            <h2 className="text-base font-semibold">{domain.name}</h2>
            <span className="text-xs text-muted-foreground">({kpisWithEntries.length} KPI)</span>
            <DomainStatusBadges kpisWithEntries={kpisWithEntries} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpisWithEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">
                {isFiltered ? "Tidak ada KPI yang cocok dengan filter." : "Belum ada KPI untuk domain ini."}
              </p>
            ) : (
              kpisWithEntries.map(({ kpi, latestEntry, sparklineEntries, effectiveTarget }) => (
                <KPICard key={kpi.id} kpi={kpi} latestEntry={latestEntry} sparklineEntries={sparklineEntries} effectiveTarget={effectiveTarget} />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
