import { getAllDomains, getKPIsWithLatestEntry } from "@/lib/queries";
import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { getKPIStatus, statusConfig } from "@/lib/kpi-status";

export interface DataSnapshot {
  generatedAt: string;
  domains: {
    name: string;
    description: string;
    kpiCount: number;
    healthySummary: string;
  }[];
  kpis: {
    name: string;
    domain: string;
    unit: string;
    value: string;
    target: string;
    status: string;
    achievement: string;
    direction: string;
  }[];
  projects: {
    name: string;
    status: string;
    progress: number;
    startDate: string;
    endDate: string;
  }[];
}

export async function buildDataSnapshot(): Promise<DataSnapshot> {
  const [domains, kpisWithEntries, projects] = await Promise.all([
    getAllDomains(),
    getKPIsWithLatestEntry(),
    getAllTimelineProjects(),
  ]);

  const domainSummaries = domains.map((domain) => {
    const domainKpis = kpisWithEntries.filter(
      ({ kpi }) => kpi.domainId === domain.id
    );
    const statusCounts = { green: 0, yellow: 0, red: 0, noData: 0 };
    domainKpis.forEach(({ kpi, latestEntry, effectiveTarget }) => {
      const status = getKPIStatus(latestEntry?.value, {
        ...kpi,
        ...effectiveTarget,
      });
      if (status === "green") statusCounts.green++;
      else if (status === "yellow") statusCounts.yellow++;
      else if (status === "red") statusCounts.red++;
      else statusCounts.noData++;
    });

    return {
      name: domain.name,
      description: domain.description || "",
      kpiCount: domainKpis.length,
      healthySummary: `${statusCounts.green} hijau, ${statusCounts.yellow} kuning, ${statusCounts.red} merah, ${statusCounts.noData} tanpa data`,
    };
  });

  const kpiList = kpisWithEntries.map(
    ({ kpi, latestEntry, effectiveTarget }) => {
      const domain = domains.find((d) => d.id === kpi.domainId);
      const status = getKPIStatus(latestEntry?.value, {
        ...kpi,
        ...effectiveTarget,
      });
      const tgt = effectiveTarget ?? { target: kpi.target };

      return {
        name: kpi.name,
        domain: domain?.name || "Unknown",
        unit: kpi.unit,
        value: latestEntry ? String(latestEntry.value) : "N/A",
        target: String(tgt.target),
        status: statusConfig[status].label,
        achievement: latestEntry
          ? `${((latestEntry.value / (tgt.target || 1)) * 100).toFixed(1)}%`
          : "N/A",
        direction:
          kpi.direction === "lower_better"
            ? "rendah lebih baik"
            : "tinggi lebih baik",
      };
    }
  );

  const projectList = projects.map((p) => ({
    name: p.name,
    status: p.statusId ? String(p.statusId) : "Unknown",
    progress: p.progress,
    startDate: p.startDate,
    endDate: p.endDate,
  }));

  return {
    generatedAt: new Date().toISOString(),
    domains: domainSummaries,
    kpis: kpiList,
    projects: projectList,
  };
}

export function formatDataContext(snapshot: DataSnapshot): string {
  const domainText = snapshot.domains
    .map((d) => `- ${d.name} (${d.kpiCount} KPI): ${d.healthySummary}`)
    .join("\n");

  const kpiText = snapshot.kpis
    .map(
      (k) =>
        `- ${k.name} [${k.domain}]: aktual ${k.value} ${k.unit}, target ${k.target}, status ${k.status}, pencapaian ${k.achievement}`
    )
    .join("\n");

  const projectText =
    snapshot.projects.length > 0
      ? snapshot.projects
          .map(
            (p) =>
              `- ${p.name}: status ${p.status}, progress ${p.progress}%, ${p.startDate} - ${p.endDate}`
          )
          .join("\n")
      : "Tidak ada project timeline.";

  return `Data per ${snapshot.generatedAt}:

DOMAIN:
${domainText}

KPI:
${kpiText}

TIMELINE PROJECT:
${projectText}`;
}
