import { getKPIStatus, type KPIStatus } from "@/lib/kpi-status";
import type { KPI, KPIEntry } from "@/lib/db/schema";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from "lucide-react";

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
  const tracked = total - counts["no-data"];
  const onTrackPct = tracked > 0 ? Math.round((counts.green / tracked) * 100) : null;

  const stats = [
    { label: "On Track", count: counts.green, icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
    { label: "At Risk", count: counts.yellow, icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/40" },
    { label: "Off Track", count: counts.red, icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
    { label: "No Data", count: counts["no-data"], icon: MinusCircle, color: "text-muted-foreground", bg: "bg-secondary" },
  ];

  return (
    <div className="space-y-3">
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

      {onTrackPct !== null && tracked > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Health Score</span>
            <span className={`font-semibold ${onTrackPct >= 80 ? "text-green-600" : onTrackPct >= 50 ? "text-yellow-600" : "text-red-600"}`}>
              {onTrackPct}% on track
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden flex">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${(counts.green / total) * 100}%` }} />
            <div className="h-full bg-yellow-500 transition-all" style={{ width: `${(counts.yellow / total) * 100}%` }} />
            <div className="h-full bg-red-500 transition-all" style={{ width: `${(counts.red / total) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
