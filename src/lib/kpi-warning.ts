import { differenceInMonths, parseISO } from "date-fns";
import { getKPIStatus, type KPIDirection } from "@/lib/kpi-status";

export type KPIWarningSeverity = "low" | "medium" | "high";

interface WarningKPI {
  name: string;
  unit: string;
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
  direction?: KPIDirection;
}

interface WarningEntry {
  value: number;
  periodDate: string;
}

export interface KPIEarlyWarning {
  severity: KPIWarningSeverity;
  reasons: string[];
  suggestedAction: {
    title: string;
    description: string;
  };
}

export function getKPIEarlyWarning({
  kpi,
  latestEntry,
  previousEntry,
  today = new Date(),
}: {
  kpi: WarningKPI;
  latestEntry: WarningEntry | null;
  previousEntry?: WarningEntry | null;
  today?: Date;
}): KPIEarlyWarning | null {
  const reasons: string[] = [];
  const status = getKPIStatus(latestEntry?.value, kpi);

  if (status === "red") reasons.push("KPI off track");
  if (status === "yellow") reasons.push("KPI at risk");

  const worsening = latestEntry && previousEntry
    ? kpi.direction === "lower_better"
      ? latestEntry.value > previousEntry.value
      : latestEntry.value < previousEntry.value
    : false;
  if (worsening) reasons.push("Tren memburuk dari periode sebelumnya");

  const stale = latestEntry
    ? differenceInMonths(today, parseISO(latestEntry.periodDate)) >= 2
    : false;
  if (stale) reasons.push("Data KPI sudah lama belum diperbarui");

  if (reasons.length === 0) return null;

  const severity: KPIWarningSeverity = status === "red"
    ? "high"
    : status === "yellow" || worsening
      ? "medium"
      : "low";

  return {
    severity,
    reasons,
    suggestedAction: {
      title: status === "red"
        ? `Investigasi KPI ${kpi.name} yang off track`
        : `Tindak lanjut KPI ${kpi.name}`,
      description: `Early warning: ${reasons.join("; ")}. Review penyebab, tetapkan langkah perbaikan, dan update progres sebelum deadline.`,
    },
  };
}
