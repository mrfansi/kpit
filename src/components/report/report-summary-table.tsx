import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { TimelineProject } from "@/lib/db/schema";
import { getEffectiveLaunchDate, isManualLaunchDate } from "@/lib/launch-date";

interface ReportSummaryTableProps {
  projects: TimelineProject[];
}

export function ReportSummaryTable({ projects }: ReportSummaryTableProps) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold mb-4">Executive Summary</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-2.5 font-medium">Project</th>
              <th className="text-left px-4 py-2.5 font-medium">Progress</th>
              <th className="text-left px-4 py-2.5 font-medium">Mulai</th>
              <th className="text-left px-4 py-2.5 font-medium">Selesai</th>
              <th className="text-left px-4 py-2.5 font-medium">Est. Launch</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const launchDate = getEffectiveLaunchDate(project);
              const isManual = isManualLaunchDate(project);

              return (
                <tr key={project.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="font-medium">{project.name}</span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                        {project.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${project.progress}%`,
                            backgroundColor: project.color,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">
                        {project.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(parseISO(project.startDate), "dd MMM yy", {
                      locale: idLocale,
                    })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(parseISO(project.endDate), "dd MMM yy", {
                      locale: idLocale,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-emerald-600">
                      {format(parseISO(launchDate), "dd MMM yy", {
                        locale: idLocale,
                      })}
                    </span>
                    {isManual && (
                      <span
                        className="text-xs text-muted-foreground ml-1"
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
    </div>
  );
}
