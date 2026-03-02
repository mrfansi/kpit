import { getAllDomains, getKPIsWithLatestEntry } from "@/lib/queries";
import { KPICard } from "@/components/kpi-card";
import { StatSummary } from "@/components/stat-summary";
import { DomainTabs } from "@/components/domain-tabs";
import { Separator } from "@/components/ui/separator";

export default async function OverviewPage() {
  const [domains, allKPIsWithEntries] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(),
  ]);

  const byDomain = domains.map((domain) => ({
    domain,
    kpisWithEntries: allKPIsWithEntries.filter((k) => k.kpi.domainId === domain.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview KPI</h1>
        <p className="text-muted-foreground text-sm mt-1">Ringkasan seluruh Key Performance Indicators</p>
      </div>

      <StatSummary kpisWithEntries={allKPIsWithEntries} />
      <DomainTabs domains={domains} />
      <Separator />

      {byDomain.map(({ domain, kpisWithEntries }) => (
        <section key={domain.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: domain.color }} />
            <h2 className="text-base font-semibold">{domain.name}</h2>
            <span className="text-xs text-muted-foreground">({kpisWithEntries.length} KPI)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpisWithEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">Belum ada KPI untuk domain ini.</p>
            ) : (
              kpisWithEntries.map(({ kpi, latestEntry }) => (
                <KPICard key={kpi.id} kpi={kpi} latestEntry={latestEntry} />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
