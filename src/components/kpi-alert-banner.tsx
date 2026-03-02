"use client";

import { useState } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatValue } from "@/lib/period";
import Link from "next/link";
import type { KPI, KPIEntry } from "@/lib/db/schema";

interface AlertItem {
  kpi: KPI;
  latestEntry: KPIEntry | null;
  domainName: string;
  effectiveTarget?: { target: number };
}

interface KPIAlertBannerProps {
  redKPIs: AlertItem[];
}

export function KPIAlertBanner({ redKPIs }: KPIAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed || redKPIs.length === 0) return null;

  const visible = expanded ? redKPIs : redKPIs.slice(0, 3);

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">
            {redKPIs.length} KPI Off Track
          </span>
          <span className="text-xs text-red-600/70 dark:text-red-400/70">— perlu perhatian segera</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-600 hover:text-red-800 dark:text-red-400 -mt-0.5"
          onClick={() => setDismissed(true)}
          title="Tutup"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {visible.map(({ kpi, latestEntry, domainName, effectiveTarget }) => (
          <Link
            key={kpi.id}
            href={`/kpi/${kpi.id}`}
            className="flex items-center justify-between px-3 py-2 rounded-md bg-red-100/60 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-red-800 dark:text-red-300 truncate">{kpi.name}</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/60">{domainName}</p>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-xs font-bold text-red-700 dark:text-red-400">
                {latestEntry ? formatValue(latestEntry.value, kpi.unit) : "—"}
              </p>
              <p className="text-xs text-red-500/70">
                target {formatValue((effectiveTarget ?? kpi).target, kpi.unit)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {redKPIs.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 px-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3 mr-1" />Sembunyikan</>
          ) : (
            <><ChevronDown className="w-3 h-3 mr-1" />Lihat {redKPIs.length - 3} lainnya</>
          )}
        </Button>
      )}
    </div>
  );
}
