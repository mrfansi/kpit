import { AlertTriangle, Clock, TrendingDown } from "lucide-react";
import type { KPIEarlyWarning } from "@/lib/kpi-warning";

interface KPIEarlyWarningProps {
  warning: KPIEarlyWarning | null;
}

const severityClass: Record<KPIEarlyWarning["severity"], string> = {
  high: "border-danger bg-danger-soft text-danger",
  medium: "border-warning bg-warning-soft text-warning",
  low: "border-border bg-muted text-muted-foreground",
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
