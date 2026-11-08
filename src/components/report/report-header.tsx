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
    <div className="mb-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Timeline Report</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Dibuat: <span className="num">{generatedAt}</span>
          </p>
        </div>
        <ReportPrintButton />
      </div>
      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        <div>
          <dt className="text-sm text-muted-foreground">Total Project:</dt>
          <dd className="num mt-1 text-3xl font-semibold leading-none">{projectCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Rata-rata Progress:</dt>
          <dd className="num mt-1 text-3xl font-semibold leading-none">{averageProgress}%</dd>
        </div>
      </dl>
    </div>
  );
}
