import { getAllTimelineProjects } from "@/lib/queries/timeline";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { auth } from "@/auth";

export const metadata = {
  title: "Timeline - KPI Dashboard",
};

export default async function TimelinePage() {
  const [projects, session] = await Promise.all([
    getAllTimelineProjects(),
    auth(),
  ]);

  return (
    <div className="-mx-4 lg:-mx-6 -my-4 lg:-my-6 h-[calc(100vh-3rem)] lg:h-screen">
      <GanttChart
        projects={projects}
        isAuthenticated={!!session?.user}
      />
    </div>
  );
}
