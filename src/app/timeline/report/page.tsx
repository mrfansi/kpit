import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { ReportHeader } from "@/components/report/report-header";

export const metadata = {
  title: "Timeline Report - KPI Dashboard",
};

export default async function TimelineReportPage() {
  const projects = await getAllTimelineProjects();

  const averageProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
        )
      : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-10">
      <ReportHeader
        projectCount={projects.length}
        averageProgress={averageProgress}
      />
      {projects.length === 0 && (
        <p className="text-muted-foreground text-center py-12">
          Belum ada project timeline.
        </p>
      )}
    </div>
  );
}
