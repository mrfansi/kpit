import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { TimelineProject, TimelineProjectStatus } from "@/lib/db/schema";
import { getEffectiveLaunchDate, isManualLaunchDate } from "@/lib/launch-date";

interface ReportSummaryTableProps {
  projects: TimelineProject[];
  statuses: TimelineProjectStatus[];
}

const th = "py-2 pr-4 text-left text-sm font-normal whitespace-nowrap text-muted-foreground";

export function ReportSummaryTable({ projects, statuses }: ReportSummaryTableProps) {
  return (
    <section aria-labelledby="timeline-summary-heading" className="mb-10 space-y-3">
      <h2 id="timeline-summary-heading" className="text-lg font-semibold">Executive summary</h2>
      {/* Tabel polos: garis horizontal saja. overflow-x-auto menyisakan cara
          menjangkau kolom yang keluar layar di ponsel. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className={th}>Project</th>
              <th className={th}>Progress</th>
              <th className={th}>Status</th>
              <th className={`${th} hidden sm:table-cell print:table-cell`}>Mulai</th>
              <th className={`${th} hidden sm:table-cell print:table-cell`}>Selesai</th>
              <th className={`${th} pr-0`}>Est. launch</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const launchDate = getEffectiveLaunchDate(project);
              const isManual = isManualLaunchDate(project);
              const status = statuses.find((s) => s.id === project.statusId);

              return (
                <tr key={project.id} className="border-b align-top last:border-b-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      {/* Warna identitas proyek dari DB, sebagai kunci persegi kecil. */}
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="font-semibold">{project.name}</span>
                    </div>
                    {project.description && (
                      <p className="mt-0.5 ml-5 text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden bg-secondary">
                        <div
                          className="h-full"
                          style={{
                            width: `${project.progress}%`,
                            backgroundColor: project.color,
                          }}
                        />
                      </div>
                      <span className="num w-9 text-sm text-muted-foreground">
                        {project.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {status ? status.name : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="num hidden py-3 pr-4 whitespace-nowrap text-muted-foreground sm:table-cell print:table-cell">
                    {format(parseISO(project.startDate), "dd MMM yy", {
                      locale: idLocale,
                    })}
                  </td>
                  <td className="num hidden py-3 pr-4 whitespace-nowrap text-muted-foreground sm:table-cell print:table-cell">
                    {format(parseISO(project.endDate), "dd MMM yy", {
                      locale: idLocale,
                    })}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <span className="num font-semibold">
                      {format(parseISO(launchDate), "dd MMM yy", {
                        locale: idLocale,
                      })}
                    </span>
                    {isManual && (
                      <span
                        className="ml-1 text-sm text-muted-foreground"
                        title="Manual override"
                      >
                        (manual)
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
