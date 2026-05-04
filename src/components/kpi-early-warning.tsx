import { AlertTriangle, Clock, TrendingDown } from "lucide-react";
import type { KPIEarlyWarning } from "@/lib/kpi-warning";

interface KPIEarlyWarningProps {
  warning: KPIEarlyWarning | null;
}

const severityClass: Record<KPIEarlyWarning["severity"], string> = {
  high: "border-red-300 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-200",
  medium: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200",
  low: "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-200",
};

export function KPIEarlyWarning({ warning }: KPIEarlyWarningProps) {
  if (!warning) return null;

  const Icon = warning.severity === "low" ? Clock : warning.severity === "medium" ? TrendingDown : AlertTriangle;

  return (
    <div className={`rounded-lg border px-4 py-3 ${severityClass[warning.severity]}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold">Early Warning</h2>
            <p className="text-sm opacity-90">Sistem menyarankan action plan sebelum risiko KPI makin melebar.</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {warning.reasons.map((reason) => (
              <li key={reason} className="rounded-md bg-background/70 px-2 py-1 text-xs">
                {reason}
              </li>
            ))}
          </ul>
          <div className="rounded-md bg-background/70 px-3 py-2 text-sm">
            <p className="font-medium">{warning.suggestedAction.title}</p>
            <p className="mt-1 text-xs opacity-80">{warning.suggestedAction.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
