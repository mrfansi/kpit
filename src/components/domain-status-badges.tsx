import { getKPIStatus } from "@/lib/kpi-status";
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
        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          {green}
        </span>
      )}
      {yellow > 0 && (
        <span className="flex items-center gap-0.5 text-yellow-600 dark:text-yellow-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
          {yellow}
        </span>
      )}
      {red > 0 && (
        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          {red}
        </span>
      )}
    </div>
  );
}
