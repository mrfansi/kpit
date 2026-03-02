import { getKPIStatus, type KPIStatus } from "@/lib/kpi-status";
import type { KPI, KPIEntry } from "@/lib/db/schema";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface StatSummaryProps {
  kpisWithEntries: { kpi: KPI; latestEntry: KPIEntry | null; effectiveTarget?: { target: number; thresholdGreen: number; thresholdYellow: number } }[];
}

export function StatSummary({ kpisWithEntries }: StatSummaryProps) {
  const counts: Record<KPIStatus, number> = { green: 0, yellow: 0, red: 0, "no-data": 0 };

  for (const { kpi, latestEntry, effectiveTarget } of kpisWithEntries) {
    const kpiWithTarget = effectiveTarget ? { ...kpi, ...effectiveTarget } : kpi;
    const status = getKPIStatus(latestEntry?.value, kpiWithTarget);
    counts[status]++;
  }

  const total = kpisWithEntries.length;

  const stats = [
    { label: "On Track", count: counts.green, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "At Risk", count: counts.yellow, icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Off Track", count: counts.red, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="flex gap-3 flex-wrap">
      {stats.map(({ label, count, icon: Icon, color, bg }) => (
        <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
          <span className={`text-sm font-semibold ${color}`}>{count}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
        <span className="text-sm font-semibold">{total}</span>
        <span className="text-sm text-muted-foreground">Total KPI</span>
      </div>
    </div>
  );
}
