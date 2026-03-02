import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { KPI, KPIEntry } from "@/lib/db/schema";

interface CompletenessTrackerProps {
  kpis: KPI[];
  entriesForPeriod: KPIEntry[];
  period: string;
}

export function CompletenessTracker({ kpis, entriesForPeriod, period }: CompletenessTrackerProps) {
  const entryKpiIds = new Set(entriesForPeriod.map((e) => e.kpiId));
  const missing = kpis.filter((k) => !entryKpiIds.has(k.id));

  if (missing.length === 0) return null;

  return (
    <Card className="border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="w-4 h-4" />
          {missing.length} KPI belum ada data untuk periode ini
          <Badge variant="outline" className="ml-auto text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
            {kpis.length - missing.length}/{kpis.length} lengkap
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {missing.map((kpi) => (
            <Link key={kpi.id} href={`/kpi/${kpi.id}`}>
              <Badge
                variant="outline"
                className="text-xs cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700"
              >
                {kpi.name}
              </Badge>
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Klik nama KPI untuk input data, atau gunakan{" "}
          <Link href={`/admin/input?period=${period}`} className="underline text-primary">
            Input Data massal
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
