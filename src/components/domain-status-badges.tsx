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
    // Jumlah per status ditulis seperti legenda readout: angka berwarna status + label, bukan titik atau kotak tanpa nama.
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      {green > 0 && (
        <span>
          <span className={`num font-semibold ${statusConfig.green.color}`}>{green}</span>{" "}
          <span className="text-muted-foreground">{statusConfig.green.label}</span>
        </span>
      )}
      {yellow > 0 && (
        <span>
          <span className={`num font-semibold ${statusConfig.yellow.color}`}>{yellow}</span>{" "}
          <span className="text-muted-foreground">{statusConfig.yellow.label}</span>
        </span>
      )}
      {red > 0 && (
        <span>
          <span className={`num font-semibold ${statusConfig.red.color}`}>{red}</span>{" "}
          <span className="text-muted-foreground">{statusConfig.red.label}</span>
        </span>
      )}
    </div>
  );
}
