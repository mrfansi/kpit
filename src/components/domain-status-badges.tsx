import { getKPIStatus, statusConfig } from "@/lib/kpi-status";
import type { KPI, KPIEntry } from "@/lib/db/schema";

interface DomainStatusBadgesProps {
  kpisWithEntries: { kpi: KPI; latestEntry: KPIEntry | null; effectiveTarget?: { target: number; thresholdGreen: number; thresholdYellow: number } }[];
}

export function DomainStatusBadges({ kpisWithEntries }: DomainStatusBadgesProps) {
  let green = 0, yellow = 0, red = 0;

  for (const { kpi, latestEntry, effectiveTarget } of kpisWithEntries) {
    const kpiWithTarget = effectiveTarget ? { ...kpi, ...effectiveTarget } : kpi;
    const status = getKPIStatus(latestEntry?.value, kpiWithTarget);
    if (status === "green") green++;
    else if (status === "yellow") yellow++;
    else if (status === "red") red++;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {green > 0 && (
        <span className={`flex items-center gap-0.5 font-medium ${statusConfig.green.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${statusConfig.green.solid}`} />
          <span className="num">{green}</span>
        </span>
      )}
      {yellow > 0 && (
        <span className={`flex items-center gap-0.5 font-medium ${statusConfig.yellow.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${statusConfig.yellow.solid}`} />
          <span className="num">{yellow}</span>
        </span>
      )}
      {red > 0 && (
        <span className={`flex items-center gap-0.5 font-medium ${statusConfig.red.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${statusConfig.red.solid}`} />
          <span className="num">{red}</span>
        </span>
      )}
    </div>
  );
}
