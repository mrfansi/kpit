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
    // MobileHeader sebenarnya tinggi 61px (py-3=24px + trigger size-9=36px + border-b=1px),
    // bukan 3rem/48px — selisihnya bikin Gantt melampaui viewport dan memicu scroll body.
    // dvh (bukan vh) supaya tidak meleset lagi saat address bar browser mobile muncul/hilang.
    <div className="-mx-4 lg:-mx-6 -my-4 lg:-my-6 h-[calc(100dvh-61px)] lg:h-screen">
      {/*
        Dulu ada `key` dari id/tanggal/progress di sini untuk memaksa GanttChart
        remount setiap data berubah. Key itu tidak memuat nama, status, warna,
        maupun deskripsi -- jadi hasil edit field-field tersebut tidak pernah
        tampil sampai halaman di-refresh manual. Remount juga membuang view mode,
        posisi pan, dan scroll setiap kali satu bar digeser.
        GanttChart sekarang menyinkronkan sendiri salinan lokalnya dari prop.
      */}
      <GanttChart projects={projects} statuses={statuses} canEdit={canEdit} />
    </div>
  );
}
