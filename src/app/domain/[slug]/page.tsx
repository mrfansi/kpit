import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getActionPlanCounts, getAllDomains, getKPIsWithLatestEntry } from "@/lib/queries";
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
import { BatchCommentDraft } from "@/components/batch-comment-draft";
import { auth } from "@/auth";
import { canAccessAdminRoute } from "@/lib/admin-access";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ period?: string; q?: string; status?: string }>;
}

export default async function DomainPage({ params, searchParams }: Props) {
  const [{ slug }, { period, q, status }] = await Promise.all([params, searchParams]);
  const selectedPeriod = period ?? defaultReportingPeriod();

  // Domain list is tiny and already loaded by the layout (cached), so no separate slug lookup.
  const domains = await getAllDomains();
  const domain = domains.find((d) => d.slug === slug);
  if (!domain) notFound();

  const [kpisWithEntries, actionCounts, session] = await Promise.all([
    getKPIsWithLatestEntry(domain.id, selectedPeriod),
    getActionPlanCounts(domain.id),
    auth(),
  ]);
  const canEdit = canAccessAdminRoute(session?.user?.role);

  // KPI domain ini yang belum diisi untuk periode terpilih (latestEntry adalah entry terbaru <= periode).
  const missingKPIs = kpisWithEntries
    .filter(({ latestEntry }) => latestEntry?.periodDate !== selectedPeriod)
    .map(({ kpi }) => kpi);

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
    <div className="space-y-10">
      {/* Kepala layar + readout domain: satu blok, readout langsung di bawah judul. */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{domain.name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Posisi per{" "}
              <span className="num font-semibold text-foreground">
                {selectedPeriod ? formatPeriodDate(selectedPeriod, "MMMM yyyy") : "-"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Suspense>
              <PeriodSelector defaultValue={selectedPeriod} />
            </Suspense>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/report/${slug}${selectedPeriod ? `?period=${selectedPeriod}` : ""}`}>
                <FileText aria-hidden />
                Laporan bulanan
              </Link>
            </Button>
            <ExportButtons domainSlug={slug} />
            {canEdit && (
              <BatchCommentDraft domainId={domain.id} periodDate={selectedPeriod ?? ""} />
            )}
            {canEdit && (
              <QuickEntryModal kpis={kpisWithEntries.map(({ kpi }) => kpi)} kpiLatestPeriods={kpiLatestPeriods} />
            )}
          </div>
        </div>

        <SummaryStrip kpisWithEntries={kpisWithEntries} />

        {session?.user && <DomainAISummary requestData={domainSummaryData} />}

        {!isFiltered && (
          <AttentionBar
            redKPIs={redKPIs}
            missingKPIs={missingKPIs}
            period={selectedPeriod ?? ""}
            canEdit={canEdit}
          />
        )}
      </div>

      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense>
            <KPIFilterBar defaultQ={q} defaultStatus={status} />
          </Suspense>
          <DomainTabs domains={domains} activeSlug={slug} />
        </div>

        {filtered.length === 0 && !isFiltered ? (
          <EmptyState />
        ) : (
          <KPITable
            rows={filtered}
            actionCounts={actionCounts}
            selectedPeriod={selectedPeriod}
            canEdit={canEdit}
            emptyMessage="Tidak ada KPI yang cocok dengan filter."
          />
        )}
      </div>
    </div>
  );
}
