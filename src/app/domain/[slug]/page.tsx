import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getActionPlanCountsByKPIIds, getAllDomains, getDomainBySlug, getEntriesForPeriod, getKPIsWithLatestEntry } from "@/lib/queries";
import { KPITable } from "@/components/kpi-table";
import { SummaryStrip } from "@/components/summary-strip";
import { AttentionBar } from "@/components/attention-bar";
import { DomainTabs } from "@/components/domain-tabs";
import { ExportButtons } from "@/components/export-buttons";
import { EmptyState } from "@/components/empty-state";
import { PeriodSelector } from "@/components/period-selector";
import { KPIFilterBar } from "@/components/kpi-filter-bar";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { formatPeriodDate, defaultReportingPeriod } from "@/lib/period";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import Link from "next/link";
import { getKPIStatus, getAchievementPct, statusConfig } from "@/lib/kpi-status";
import { formatValue } from "@/lib/period";
import { DomainAISummary } from "@/components/domain/domain-ai-summary";
import { isAdminUser } from "@/lib/auth-utils";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ period?: string; q?: string; status?: string }>;
}

export default async function DomainPage({ params, searchParams }: Props) {
  const [{ slug }, { period, q, status }] = await Promise.all([params, searchParams]);
  const selectedPeriod = period ?? defaultReportingPeriod();

  const [domain, domains] = await Promise.all([getDomainBySlug(slug), getAllDomains()]);
  if (!domain) notFound();

  const [kpisWithEntries, entriesForPeriod, canEdit] = await Promise.all([
    getKPIsWithLatestEntry(domain.id, selectedPeriod),
    getEntriesForPeriod(selectedPeriod ?? ""),
    isAdminUser(),
  ]);
  const actionCounts = await getActionPlanCountsByKPIIds(kpisWithEntries.map(({ kpi }) => kpi.id));

  // KPI domain ini yang off track / belum diisi untuk periode terpilih.
  const entryKpiIds = new Set(entriesForPeriod.map((e) => e.kpiId));
  const missingKPIs = kpisWithEntries
    .map(({ kpi }) => kpi)
    .filter((kpi) => !entryKpiIds.has(kpi.id));

  const redKPIs = kpisWithEntries
    .filter(({ kpi, latestEntry, effectiveTarget }) => {
      const withTarget = effectiveTarget ? { ...kpi, ...effectiveTarget } : kpi;
      return getKPIStatus(latestEntry?.value, withTarget) === "red";
    })
    .map(({ kpi, latestEntry, effectiveTarget }) => ({
      kpi,
      latestEntry,
      effectiveTarget,
      domainName: domain.name,
    }));

  const filtered = kpisWithEntries.filter(({ kpi, latestEntry, effectiveTarget }) => {
    if (q && !kpi.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (status) {
      const kpiWithTarget = effectiveTarget ? { ...kpi, ...effectiveTarget } : kpi;
      const kpiStatus = getKPIStatus(latestEntry?.value, kpiWithTarget);
      if (kpiStatus !== status) return false;
    }
    return true;
  });

  const isFiltered = Boolean(q || status);

  const kpiLatestPeriods: Record<number, string> = {};
  for (const { kpi, latestEntry } of kpisWithEntries) {
    if (latestEntry) kpiLatestPeriods[kpi.id] = latestEntry.periodDate;
  }

  const statusCounts = { healthy: 0, warning: 0, critical: 0, noData: 0 };
  const domainAIKpis = kpisWithEntries.map(({ kpi, latestEntry, effectiveTarget }) => {
    const kpiWithTarget = effectiveTarget ? { ...kpi, ...effectiveTarget } : kpi;
    const kpiStatus = getKPIStatus(latestEntry?.value, kpiWithTarget);
    if (kpiStatus === "green") statusCounts.healthy++;
    else if (kpiStatus === "yellow") statusCounts.warning++;
    else if (kpiStatus === "red") statusCounts.critical++;
    else statusCounts.noData++;

    const tgt = effectiveTarget ?? { target: kpi.target };
    const pct = latestEntry
      ? getAchievementPct(latestEntry.value, tgt.target, kpi.direction)
      : null;

    return {
      name: kpi.name,
      actual: latestEntry ? formatValue(latestEntry.value, kpi.unit) : "N/A",
      target: formatValue(tgt.target, kpi.unit),
      achievement: pct !== null ? `${pct}%` : "N/A",
      status: statusConfig[kpiStatus].label,
      trend: "stabil",
    };
  });

  const domainSummaryData = {
    domainName: domain.name,
    domainDescription: domain.description || "",
    period: selectedPeriod ?? "",
    healthyCount: statusCounts.healthy,
    warningCount: statusCounts.warning,
    criticalCount: statusCounts.critical,
    noDataCount: statusCounts.noData,
    kpis: domainAIKpis,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{domain.name}</h1>
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
            <Link href={`/report/${slug}${selectedPeriod ? `?period=${selectedPeriod}` : ""}`}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Scorecard PDF
            </Link>
          </Button>
          <ExportButtons domainSlug={slug} />
          {canEdit && (
            <QuickEntryModal kpis={kpisWithEntries.map(({ kpi }) => kpi)} kpiLatestPeriods={kpiLatestPeriods} />
          )}
        </div>
      </div>

      <DomainAISummary requestData={domainSummaryData} />

      <SummaryStrip kpisWithEntries={kpisWithEntries} />

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
        <DomainTabs domains={domains} activeSlug={slug} />
      </div>

      {filtered.length === 0 && !isFiltered ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <KPITable
            rows={filtered}
            actionCounts={actionCounts}
            selectedPeriod={selectedPeriod}
            canEdit={canEdit}
            emptyMessage="Tidak ada KPI yang cocok dengan filter."
          />
        </div>
      )}
    </div>
  );
}
