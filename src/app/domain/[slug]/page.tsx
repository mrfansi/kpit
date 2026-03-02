import { notFound } from "next/navigation";
import { getAllDomains, getDomainBySlug, getKPIsWithLatestEntry } from "@/lib/queries";
import { KPICard } from "@/components/kpi-card";
import { StatSummary } from "@/components/stat-summary";
import { DomainTabs } from "@/components/domain-tabs";
import { Separator } from "@/components/ui/separator";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const domains = await getAllDomains();
  return domains.map((d) => ({ slug: d.slug }));
}

export default async function DomainPage({ params }: Props) {
  const { slug } = await params;
  const [domain, domains] = await Promise.all([getDomainBySlug(slug), getAllDomains()]);
  if (!domain) notFound();

  const kpisWithEntries = await getKPIsWithLatestEntry(domain.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{domain.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">{domain.description ?? "KPI untuk domain ini"}</p>
      </div>

      <StatSummary kpisWithEntries={kpisWithEntries} />
      <DomainTabs domains={domains} activeSlug={slug} />
      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpisWithEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full">Belum ada KPI untuk domain ini.</p>
        ) : (
          kpisWithEntries.map(({ kpi, latestEntry }) => (
            <KPICard key={kpi.id} kpi={kpi} latestEntry={latestEntry} />
          ))
        )}
      </div>
    </div>
  );
}
