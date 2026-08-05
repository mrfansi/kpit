import { Suspense } from "react";
import { getActionPlanCountsByKPIIds, getAllDomains, getAllKPIs, getEntriesForPeriod, getKPIsWithLatestEntry } from "@/lib/queries";
import { KPITable } from "@/components/kpi-table";
import { SummaryStrip } from "@/components/summary-strip";
import { AttentionBar } from "@/components/attention-bar";
import { DomainTabs } from "@/components/domain-tabs";
import { ExportButtons } from "@/components/export-buttons";
import { PeriodSelector } from "@/components/period-selector";
import { KPIFilterBar } from "@/components/kpi-filter-bar";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { DomainStatusBadges } from "@/components/domain-status-badges";
import { formatPeriodDate, defaultReportingPeriod } from "@/lib/period";
import { getKPIStatus } from "@/lib/kpi-status";
import { Pin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isAdminUser } from "@/lib/auth-utils";

interface Props {
  searchParams: Promise<{ period?: string; q?: string; status?: string }>;
}

export default async function OverviewPage({ searchParams }: Props) {
  const { period, q, status } = await searchParams;
  const selectedPeriod = period ?? defaultReportingPeriod();

  const [domains, allKPIsWithEntries, allKPIs, entriesForPeriod, canEdit] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(undefined, selectedPeriod),
    getAllKPIs(),
    getEntriesForPeriod(selectedPeriod ?? ""),
    isAdminUser(),
  ]);
  const actionCounts = await getActionPlanCountsByKPIIds(allKPIsWithEntries.map(({ kpi }) => kpi.id));

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
  // KPI yang belum punya entry untuk periode terpilih.
  const entryKpiIds = new Set(entriesForPeriod.map((e) => e.kpiId));
  const missingKPIs = allKPIs.filter((k) => !entryKpiIds.has(k.id));

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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview KPI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Posisi per{" "}
            <span className="num font-medium text-foreground">
              {selectedPeriod ? formatPeriodDate(selectedPeriod, "MMMM yyyy") : "—"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <Suspense>
            <PeriodSelector defaultValue={selectedPeriod} />
          </Suspense>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/report/all${selectedPeriod ? `?period=${selectedPeriod}` : ""}`}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Executive Report
            </Link>
          </Button>
          <ExportButtons />
          {canEdit && <QuickEntryModal kpis={allKPIs} kpiLatestPeriods={kpiLatestPeriods} />}
        </div>
      </div>

      <SummaryStrip kpisWithEntries={allKPIsWithEntries} />

      {!isFiltered && (
        <AttentionBar
          redKPIs={redKPIs}
          missingKPIs={missingKPIs}
          period={selectedPeriod ?? ""}
          canEdit={canEdit}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Suspense>
          <KPIFilterBar defaultQ={q} defaultStatus={status} />
        </Suspense>
        <DomainTabs domains={domains} />
      </div>

      {/* KPI yang dipinned */}
      {pinnedWithEntries.length > 0 && !isFiltered && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Pin className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Dipinned
            </h2>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <KPITable
              rows={pinnedWithEntries}
              actionCounts={actionCounts}
              selectedPeriod={selectedPeriod}
              canEdit={canEdit}
              emptyMessage=""
            />
          </div>
        </section>
      )}

      {byDomain.map(({ domain, kpisWithEntries }) => (
        <section key={domain.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: domain.color }} />
            <h2 className="text-sm font-semibold">{domain.name}</h2>
            <span className="num text-xs text-muted-foreground">
              {kpisWithEntries.length} KPI
            </span>
            <DomainStatusBadges kpisWithEntries={kpisWithEntries} />
          </div>
          <div className="overflow-hidden rounded-lg border">
            <KPITable
              rows={kpisWithEntries}
              actionCounts={actionCounts}
              selectedPeriod={selectedPeriod}
              canEdit={canEdit}
              emptyMessage={
                isFiltered
                  ? "Tidak ada KPI yang cocok dengan filter."
                  : "Belum ada KPI untuk domain ini."
              }
            />
          </div>
        </section>
      ))}
    </div>
  );
}
