import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAllDomains, getDomainBySlug, getKPIsByDomain, getKPIsWithLatestEntry } from "@/lib/queries";
import { KPICard } from "@/components/kpi-card";
import { StatSummary } from "@/components/stat-summary";
import { DomainTabs } from "@/components/domain-tabs";
import { ExportButtons } from "@/components/export-buttons";
import { EmptyState } from "@/components/empty-state";
import { PeriodSelector } from "@/components/period-selector";
import { KPIFilterBar } from "@/components/kpi-filter-bar";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { Separator } from "@/components/ui/separator";
import { formatPeriodDate, listLastNMonths } from "@/lib/period";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import Link from "next/link";
import { getKPIStatus } from "@/lib/kpi-status";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ period?: string; q?: string; status?: string }>;
}

export default async function DomainPage({ params, searchParams }: Props) {
  const [{ slug }, { period, q, status }] = await Promise.all([params, searchParams]);

  const months = listLastNMonths(12);
  const selectedPeriod = period ?? months[0]?.value;

  const [domain, domains] = await Promise.all([getDomainBySlug(slug), getAllDomains()]);
  if (!domain) notFound();

  const [kpisWithEntries, domainKPIs] = await Promise.all([
    getKPIsWithLatestEntry(domain.id, selectedPeriod),
    getKPIsByDomain(domain.id),
  ]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{domain.name}</h1>
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
          <Button variant="outline" size="sm" asChild>
            <Link href={`/report/${slug}${selectedPeriod ? `?period=${selectedPeriod}` : ""}`}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Scorecard PDF
            </Link>
          </Button>
          <ExportButtons domainSlug={slug} />
          <QuickEntryModal kpis={domainKPIs} kpiLatestPeriods={kpiLatestPeriods} />
        </div>
      </div>

      <StatSummary kpisWithEntries={kpisWithEntries} />

      <Suspense>
        <KPIFilterBar defaultQ={q} defaultStatus={status} />
      </Suspense>

      <DomainTabs domains={domains} activeSlug={slug} />
      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full">
            {isFiltered ? (
              <p className="text-sm text-muted-foreground">Tidak ada KPI yang cocok dengan filter.</p>
            ) : (
              <EmptyState />
            )}
          </div>
        ) : (
          filtered.map(({ kpi, latestEntry, sparklineEntries, effectiveTarget }) => (
            <KPICard key={kpi.id} kpi={kpi} latestEntry={latestEntry} sparklineEntries={sparklineEntries} effectiveTarget={effectiveTarget} />
          ))
        )}
      </div>
    </div>
  );
}
