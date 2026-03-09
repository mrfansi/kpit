import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ReportPrintButton } from "./report-print-button";

interface ReportHeaderProps {
  projectCount: number;
  averageProgress: number;
}

export function ReportHeader({ projectCount, averageProgress }: ReportHeaderProps) {
  const generatedAt = format(new Date(), "dd MMMM yyyy, HH:mm", { locale: idLocale });

  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold">Timeline Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dibuat: {generatedAt}
        </p>
        <div className="flex gap-4 mt-3 text-sm">
          <div>
            <span className="text-muted-foreground">Total Project:</span>{" "}
            <span className="font-medium">{projectCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Rata-rata Progress:</span>{" "}
            <span className="font-medium">{averageProgress}%</span>
          </div>
        </div>
      </div>
      <ReportPrintButton />
    </div>
  );
}
