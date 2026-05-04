import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { getAllStatuses } from "@/lib/queries/timeline-statuses";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { auth } from "@/auth";

export const metadata = {
  title: "Timeline - KPI Dashboard",
};

export default async function TimelinePage() {
  const [projects, statuses, session] = await Promise.all([
    getAllTimelineProjects(),
    getAllStatuses(),
    auth(),
  ]);

  return (
    <div className="-mx-4 lg:-mx-6 -my-4 lg:-my-6 h-[calc(100vh-3rem)] lg:h-screen">
      <GanttChart
        key={projects.map((project) => `${project.id}:${project.startDate}:${project.endDate}:${project.progress}`).join("|")}
        projects={projects}
        statuses={statuses}
        isAuthenticated={!!session?.user}
      />
    </div>
  );
}
