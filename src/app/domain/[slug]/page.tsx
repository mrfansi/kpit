import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAllDomains, getDomainBySlug, getKPIsWithLatestEntry } from "@/lib/queries";
import { KPICard } from "@/components/kpi-card";
import { StatSummary } from "@/components/stat-summary";
import { DomainTabs } from "@/components/domain-tabs";
import { ExportButtons } from "@/components/export-buttons";
import { EmptyState } from "@/components/empty-state";
import { PeriodSelector } from "@/components/period-selector";
import { Separator } from "@/components/ui/separator";
import { formatPeriodDate, listLastNMonths } from "@/lib/period";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ period?: string }>;
}

export default async function DomainPage({ params, searchParams }: Props) {
  const [{ slug }, { period }] = await Promise.all([params, searchParams]);

  const months = listLastNMonths(12);
  const selectedPeriod = period ?? months[0]?.value;

  const [domain, domains] = await Promise.all([getDomainBySlug(slug), getAllDomains()]);
  if (!domain) notFound();

  const kpisWithEntries = await getKPIsWithLatestEntry(domain.id, selectedPeriod);

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
          <ExportButtons domainSlug={slug} />
        </div>
      </div>

      <StatSummary kpisWithEntries={kpisWithEntries} />
      <DomainTabs domains={domains} activeSlug={slug} />
      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpisWithEntries.length === 0 ? (
          <div className="col-span-full"><EmptyState /></div>
        ) : (
          kpisWithEntries.map(({ kpi, latestEntry }) => (
            <KPICard key={kpi.id} kpi={kpi} latestEntry={latestEntry} />
          ))
        )}
      </div>
    </div>
  );
}
