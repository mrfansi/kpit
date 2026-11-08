import { Suspense } from "react";
import { getActionPlanCounts, getAllDomains, getKPIsWithLatestEntry } from "@/lib/queries";
import { KPITable } from "@/components/kpi-table";
import { SummaryStrip } from "@/components/summary-strip";
import { AttentionBar } from "@/components/attention-bar";
import { DomainTabs } from "@/components/domain-tabs";
import { ExportButtons } from "@/components/export-buttons";
import { PeriodSelector } from "@/components/period-selector";
import { KPIFilterBar } from "@/components/kpi-filter-bar";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { EmptyState } from "@/components/empty-state";
import { DomainStatusBadges } from "@/components/domain-status-badges";
import { formatPeriodDate, defaultReportingPeriod } from "@/lib/period";
import { getKPIStatus } from "@/lib/kpi-status";
import { Pin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BatchCommentDraft } from "@/components/batch-comment-draft";
import { isAdminUser } from "@/lib/auth-utils";

interface Props {
  searchParams: Promise<{ period?: string; q?: string; status?: string }>;
}

export default async function OverviewPage({ searchParams }: Props) {
  const { period, q, status } = await searchParams;
  const selectedPeriod = period ?? defaultReportingPeriod();

  const [domains, allKPIsWithEntries, actionCounts, canEdit] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(undefined, selectedPeriod),
    getActionPlanCounts(),
    isAdminUser(),
  ]);
  const allKPIs = allKPIsWithEntries.map(({ kpi }) => kpi);

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

  // Pinned rows already render in the Dipinned section; keep them out of the per-domain tables (counts/badges still include them).
  const showPinned = pinnedWithEntries.length > 0;
  const byDomain = domains.map((domain) => {
    const kpisWithEntries = filtered.filter((k) => k.kpi.domainId === domain.id);
    return {
      domain,
      kpisWithEntries,
      tableRows: showPinned ? kpisWithEntries.filter(({ kpi }) => !kpi.isPinned) : kpisWithEntries,
    };
  }).filter(({ kpisWithEntries }) => !isFiltered || kpisWithEntries.length > 0);

  // Build kpiLatestPeriods map for smart period suggestion
  const kpiLatestPeriods: Record<number, string> = {};
  for (const { kpi, latestEntry } of allKPIsWithEntries) {
    if (latestEntry) kpiLatestPeriods[kpi.id] = latestEntry.periodDate;
  }
  // KPI yang belum punya entry untuk periode terpilih (latestEntry adalah entry terbaru <= periode).
  const missingKPIs = allKPIsWithEntries
    .filter(({ latestEntry }) => latestEntry?.periodDate !== selectedPeriod)
    .map(({ kpi }) => kpi);

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
    <div className="space-y-10">
      {/* Kepala layar + readout utama: satu blok, readout langsung di bawah judul. */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Overview KPI</h1>
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
              <Link href={`/report/all${selectedPeriod ? `?period=${selectedPeriod}` : ""}`}>
                <FileText aria-hidden />
                Laporan eksekutif
              </Link>
            </Button>
            <ExportButtons />
            {canEdit && <BatchCommentDraft periodDate={selectedPeriod ?? ""} />}
            {canEdit && <QuickEntryModal kpis={allKPIs.map(({ id, name }) => ({ id, name }))} kpiLatestPeriods={kpiLatestPeriods} />}
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
      </div>

      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense>
            <KPIFilterBar defaultQ={q} defaultStatus={status} />
          </Suspense>
          <DomainTabs domains={domains} />
        </div>

        {/* KPI yang dipinned */}
        {showPinned && (
          <section aria-labelledby="pinned-heading" className="space-y-3">
            <h2 id="pinned-heading" className="flex items-center gap-2 text-lg font-semibold">
              <Pin aria-hidden className="size-4 text-muted-foreground" />
              Disematkan
            </h2>
            <KPITable
              rows={pinnedWithEntries}
              actionCounts={actionCounts}
              selectedPeriod={selectedPeriod}
              canEdit={canEdit}
              emptyMessage=""
            />
          </section>
        )}

        {byDomain.map(({ domain, kpisWithEntries, tableRows }) => (
          <section key={domain.id} aria-labelledby={`domain-${domain.id}`} className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* Warna identitas domain (bukan status), sebagai kunci kecil persegi. */}
              <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: domain.color }} />
              <h2 id={`domain-${domain.id}`} className="text-lg font-semibold">{domain.name}</h2>
              <span className="num text-sm text-muted-foreground">
                {kpisWithEntries.length} KPI
              </span>
              <DomainStatusBadges kpisWithEntries={kpisWithEntries} />
            </div>
            <KPITable
              rows={tableRows}
              actionCounts={actionCounts}
              selectedPeriod={selectedPeriod}
              canEdit={canEdit}
              emptyMessage={
                isFiltered
                  ? "Tidak ada KPI yang cocok dengan filter."
                  : kpisWithEntries.length > 0
                    ? "Semua KPI domain ini ada di bagian Disematkan."
                    : "Belum ada KPI untuk domain ini."
              }
            />
          </section>
        ))}
        {isFiltered && byDomain.length === 0 && (
          <EmptyState title="Tidak ada KPI yang cocok dengan filter." description="Ubah atau hapus filter untuk melihat semua KPI." />
        )}
      </div>
    </div>
  );
}
