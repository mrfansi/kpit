import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { getAllStatuses } from "@/lib/queries/timeline-statuses";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { isAdminUser } from "@/lib/auth-utils";

export const metadata = {
  title: "Timeline - KPI Dashboard",
};

export default async function TimelinePage() {
  const [projects, statuses, canEdit] = await Promise.all([
    getAllTimelineProjects(),
    getAllStatuses(),
    isAdminUser(),
  ]);

  return (
    <div className="-mx-4 lg:-mx-6 -my-4 lg:-my-6 h-[calc(100vh-3rem)] lg:h-screen">
      <GanttChart
        key={projects.map((project) => `${project.id}:${project.startDate}:${project.endDate}:${project.progress}`).join("|")}
        projects={projects}
        statuses={statuses}
        canEdit={canEdit}
      />
    </div>
  );
}
