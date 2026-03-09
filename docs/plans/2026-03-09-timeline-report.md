# Timeline Report Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Halaman report presentasi timeline untuk management dengan executive summary table dan visual Gantt chart read-only.

**Architecture:** Server component `/timeline/report` yang fetch semua project dan render report lengkap. Gantt layout logic di-extract ke shared utility agar bisa dipakai oleh Gantt interaktif dan report. Print CSS via `@media print` untuk PDF export tanpa library tambahan.

**Tech Stack:** Next.js App Router, Tailwind CSS, date-fns, `@media print` CSS

---

### Task 1: Extract Gantt Layout Utility

Extract layout calculation dari `gantt-chart.tsx` ke shared utility sehingga bisa dipakai oleh report Gantt.

**Files:**
- Create: `src/lib/gantt-layout.ts`
- Modify: `src/components/gantt/gantt-chart.tsx:69-139`

**Step 1: Create `src/lib/gantt-layout.ts`**

```typescript
import {
  addDays,
  parseISO,
  format,
  differenceInDays,
  startOfMonth,
  startOfWeek,
  eachMonthOfInterval,
  eachWeekOfInterval,
  subDays,
  addMonths,
  isThisMonth,
  isThisWeek,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  type ViewMode,
  type GanttColumn,
  VIEW_MODE_CONFIG,
  ROW_HEIGHT,
} from "@/components/gantt/gantt-types";
import { getEffectiveLaunchDate } from "@/lib/launch-date";

interface LayoutProject {
  startDate: string;
  endDate: string;
  launchBufferDays: number;
  estimatedLaunchDate: string | null;
}

export interface GanttLayout {
  viewMode: ViewMode;
  config: (typeof VIEW_MODE_CONFIG)[ViewMode];
  snapStart: Date;
  columns: GanttColumn[];
  totalWidth: number;
  totalHeight: number;
  dateToX: (dateStr: string) => number;
}

export function computeGanttLayout(
  projects: LayoutProject[],
  viewMode: ViewMode,
  panOffset: number = 0
): GanttLayout {
  const config = VIEW_MODE_CONFIG[viewMode];

  let minDate: Date;
  let maxDate: Date;

  if (projects.length > 0) {
    const starts = projects.map((p) => parseISO(p.startDate));
    const ends = projects.map((p) => parseISO(p.endDate));
    const launches = projects.map((p) =>
      parseISO(getEffectiveLaunchDate(p))
    );
    minDate = new Date(Math.min(...starts.map((d) => d.getTime())));
    maxDate = new Date(
      Math.max(
        ...ends.map((d) => d.getTime()),
        ...launches.map((d) => d.getTime())
      )
    );
  } else {
    minDate = new Date();
    maxDate = addMonths(new Date(), 6);
  }

  const paddedStart = subDays(minDate, 14 + panOffset);
  const paddedEnd = addDays(maxDate, 30 + Math.abs(Math.min(0, panOffset)));

  let snapStart: Date;
  let intervals: Date[];

  if (viewMode === "week") {
    snapStart = startOfWeek(paddedStart, { weekStartsOn: 1 });
    const snapEnd = startOfWeek(addDays(paddedEnd, 7), { weekStartsOn: 1 });
    intervals = eachWeekOfInterval(
      { start: snapStart, end: snapEnd },
      { weekStartsOn: 1 }
    );
  } else {
    snapStart = startOfMonth(paddedStart);
    const snapEnd = startOfMonth(addMonths(paddedEnd, 1));
    intervals = eachMonthOfInterval({ start: snapStart, end: snapEnd });
  }

  const columns: GanttColumn[] = intervals.map((date, i) => ({
    label: format(date, config.headerFormat, { locale: idLocale }),
    x: i * config.colWidth,
    width: config.colWidth,
    isCurrentPeriod:
      viewMode === "month"
        ? isThisMonth(date)
        : isThisWeek(date, { weekStartsOn: 1 }),
  }));

  const totalWidth = columns.length * config.colWidth;
  const totalHeight = projects.length * ROW_HEIGHT;

  function dateToX(dateStr: string): number {
    const days = differenceInDays(parseISO(dateStr), snapStart);
    return (days / config.unitDays) * config.colWidth;
  }

  return {
    viewMode,
    config,
    snapStart,
    columns,
    totalWidth,
    totalHeight,
    dateToX,
  };
}
```

**Step 2: Update `src/components/gantt/gantt-chart.tsx` to use shared utility**

Replace the `useMemo` layout block (lines 69-139) with:

```typescript
import { computeGanttLayout } from "@/lib/gantt-layout";

// Inside component, replace the existing useMemo:
const layout = useMemo(
  () => computeGanttLayout(localProjects, viewMode, panOffset),
  [viewMode, localProjects, panOffset]
);
```

Remove the now-unused imports from gantt-chart.tsx:
- `differenceInDays`, `startOfMonth`, `startOfWeek`, `eachMonthOfInterval`, `eachWeekOfInterval`, `subDays`, `isThisMonth`, `isThisWeek`
- `id as idLocale` (keep if used elsewhere in the file — it IS used on line 303)

**Step 3: Verify the app still works**

Run: `pnpm dev`
Open: `http://localhost:3000/timeline`
Expected: Gantt chart renders identically to before. Drag, resize, view mode switch all work.

**Step 4: Commit**

```bash
git add src/lib/gantt-layout.ts src/components/gantt/gantt-chart.tsx
git commit -m "refactor: extract gantt layout computation to shared utility"
```

---

### Task 2: Report Page & Header

Create the report page and header component.

**Files:**
- Create: `src/app/timeline/report/page.tsx`
- Create: `src/components/report/report-header.tsx`
- Create: `src/components/report/report-print-button.tsx`

**Step 1: Create `src/components/report/report-print-button.tsx`**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function ReportPrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="w-3.5 h-3.5 mr-1.5" />
      Print / Save PDF
    </Button>
  );
}
```

**Step 2: Create `src/components/report/report-header.tsx`**

```typescript
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
```

**Step 3: Create `src/app/timeline/report/page.tsx`**

```typescript
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
      {/* Summary table and Gantt chart will be added in next tasks */}
      {projects.length === 0 && (
        <p className="text-muted-foreground text-center py-12">
          Belum ada project timeline.
        </p>
      )}
    </div>
  );
}
```

**Step 4: Verify**

Run: `pnpm dev`
Open: `http://localhost:3000/timeline/report`
Expected: Header renders with title, date, stats, and print button. Print button triggers browser print dialog.

**Step 5: Commit**

```bash
git add src/app/timeline/report/page.tsx src/components/report/report-header.tsx src/components/report/report-print-button.tsx
git commit -m "feat(report): add timeline report page with header"
```

---

### Task 3: Executive Summary Table

**Files:**
- Create: `src/components/report/report-summary-table.tsx`
- Modify: `src/app/timeline/report/page.tsx`

**Step 1: Create `src/components/report/report-summary-table.tsx`**

```typescript
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
                    {format(parseISO(project.startDate), "dd MMM yy", { locale: idLocale })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(parseISO(project.endDate), "dd MMM yy", { locale: idLocale })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-emerald-600">
                      {format(parseISO(launchDate), "dd MMM yy", { locale: idLocale })}
                    </span>
                    {isManual && (
                      <span className="text-xs text-muted-foreground ml-1" title="Manual override">
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
```

**Step 2: Add table to report page**

In `src/app/timeline/report/page.tsx`, add import and render:

```typescript
import { ReportSummaryTable } from "@/components/report/report-summary-table";

// Inside the return, after ReportHeader:
{projects.length > 0 && (
  <ReportSummaryTable projects={projects} />
)}
```

**Step 3: Verify**

Open: `http://localhost:3000/timeline/report`
Expected: Table shows all projects with color dot, name, progress bar, dates, and launch date.

**Step 4: Commit**

```bash
git add src/components/report/report-summary-table.tsx src/app/timeline/report/page.tsx
git commit -m "feat(report): add executive summary table"
```

---

### Task 4: Report Gantt Chart (Read-Only)

**Files:**
- Create: `src/components/report/report-gantt.tsx`
- Modify: `src/app/timeline/report/page.tsx`

**Step 1: Create `src/components/report/report-gantt.tsx`**

```typescript
"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { TimelineProject } from "@/lib/db/schema";
import { computeGanttLayout } from "@/lib/gantt-layout";
import { getEffectiveLaunchDate, isManualLaunchDate } from "@/lib/launch-date";
import { GanttHeader } from "@/components/gantt/gantt-header";
import { GanttGrid } from "@/components/gantt/gantt-grid";
import { GanttTodayLine } from "@/components/gantt/gantt-today-line";
import { GanttLaunchMarker } from "@/components/gantt/gantt-launch-marker";
import { ROW_HEIGHT } from "@/components/gantt/gantt-types";

interface ReportGanttProps {
  projects: TimelineProject[];
}

export function ReportGantt({ projects }: ReportGanttProps) {
  const layout = useMemo(
    () => computeGanttLayout(projects, "month", 0),
    [projects]
  );

  if (projects.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Timeline Gantt Chart</h2>
      <div className="border rounded-lg overflow-auto">
        <div style={{ width: layout.totalWidth, minHeight: "100%" }}>
          <GanttHeader columns={layout.columns} totalWidth={layout.totalWidth} />

          <div className="relative" style={{ height: layout.totalHeight }}>
            <GanttGrid columns={layout.columns} totalHeight={layout.totalHeight} />
            <GanttTodayLine
              x={layout.dateToX(format(new Date(), "yyyy-MM-dd"))}
              totalHeight={layout.totalHeight}
            />

            {/* Project bars */}
            {projects.map((project, rowIndex) => {
              const x = layout.dateToX(project.startDate);
              const xEnd = layout.dateToX(project.endDate);
              const barWidth = Math.max(xEnd - x + layout.config.colWidth * 0.15, 24);
              const y = rowIndex * ROW_HEIGHT + 8;
              const barHeight = ROW_HEIGHT - 16;

              return (
                <div
                  key={project.id}
                  className="absolute rounded-lg shadow-sm group"
                  style={{
                    left: x,
                    top: y,
                    width: barWidth,
                    height: barHeight,
                    backgroundColor: `${project.color}20`,
                    border: `2px solid ${project.color}`,
                  }}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute inset-0 rounded-md pointer-events-none"
                    style={{
                      width: `${project.progress}%`,
                      backgroundColor: `${project.color}35`,
                    }}
                  />

                  {/* Project name */}
                  <div className="absolute inset-0 flex items-center px-2.5">
                    <span className="text-xs font-medium truncate text-foreground">
                      {project.name}
                    </span>
                  </div>

                  {/* Hover tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-muted-foreground mt-1">
                        Progress: {project.progress}%
                      </p>
                      <p className="text-muted-foreground">
                        {format(parseISO(project.startDate), "dd MMM yy", { locale: idLocale })}
                        {" — "}
                        {format(parseISO(project.endDate), "dd MMM yy", { locale: idLocale })}
                      </p>
                      <p className="text-emerald-600">
                        Launch: {format(parseISO(getEffectiveLaunchDate(project)), "dd MMM yy", { locale: idLocale })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Launch markers */}
            {projects.map((project, rowIndex) => {
              const launchDate = getEffectiveLaunchDate(project);
              const launchX = layout.dateToX(launchDate);
              const y = rowIndex * ROW_HEIGHT + 8;
              const markerHeight = ROW_HEIGHT - 16;

              return (
                <GanttLaunchMarker
                  key={`launch-${project.id}`}
                  x={launchX}
                  y={y}
                  height={markerHeight}
                  launchDate={launchDate}
                  isManualOverride={isManualLaunchDate(project)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add Gantt to report page**

In `src/app/timeline/report/page.tsx`, add import and render after summary table:

```typescript
import { ReportGantt } from "@/components/report/report-gantt";

// After ReportSummaryTable:
{projects.length > 0 && (
  <ReportGantt projects={projects} />
)}
```

**Step 3: Verify**

Open: `http://localhost:3000/timeline/report`
Expected: Gantt chart renders below table. Project bars visible with colors. Hover shows tooltip with details. Launch markers visible. No drag/resize/edit. Today line visible.

**Step 4: Commit**

```bash
git add src/components/report/report-gantt.tsx src/app/timeline/report/page.tsx
git commit -m "feat(report): add read-only Gantt chart with hover tooltips"
```

---

### Task 5: Print CSS

**Files:**
- Create: `src/app/timeline/report/report-print.css`
- Modify: `src/app/timeline/report/page.tsx`

**Step 1: Create `src/app/timeline/report/report-print.css`**

```css
@media print {
  /* Force background colors to print */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Landscape for better Gantt readability */
  @page {
    size: A4 landscape;
    margin: 1cm;
  }

  /* Hide interactive elements */
  .print\:hidden {
    display: none !important;
  }

  /* Remove shadows and borders for cleaner print */
  .shadow-sm,
  .shadow-lg {
    box-shadow: none !important;
  }

  /* Ensure Gantt chart starts on new page if needed */
  .print-break-before {
    break-before: page;
  }

  /* Hide hover tooltips in print */
  .group-hover\:opacity-100 {
    opacity: 0 !important;
  }

  /* Adjust body padding */
  body {
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Hide navigation sidebar if present */
  nav,
  aside,
  header:not(.report-header) {
    display: none !important;
  }
}
```

**Step 2: Import CSS in report page**

In `src/app/timeline/report/page.tsx`, add at the top:

```typescript
import "./report-print.css";
```

Also add `print-break-before` class to the Gantt section wrapper. Update the Gantt rendering:

```typescript
{projects.length > 0 && (
  <div className="print-break-before">
    <ReportGantt projects={projects} />
  </div>
)}
```

**Step 3: Verify**

Open: `http://localhost:3000/timeline/report`
Click "Print / Save PDF" button.
Expected: Print preview shows landscape layout. Colors preserved. Print button hidden. Summary table on first page. Gantt chart starts on second page if needed. No tooltips visible in print.

**Step 4: Commit**

```bash
git add src/app/timeline/report/report-print.css src/app/timeline/report/page.tsx
git commit -m "feat(report): add print CSS for PDF export"
```

---

### Task 6: Navigation Link

Add a link from the timeline page to the report page.

**Files:**
- Modify: `src/components/gantt/gantt-toolbar.tsx`

**Step 1: Read current toolbar**

Read `src/components/gantt/gantt-toolbar.tsx` to understand existing structure.

**Step 2: Add report link**

Add a link button to the toolbar:

```typescript
import Link from "next/link";
import { FileText } from "lucide-react";

// In the toolbar, add before or after existing buttons:
<Link href="/timeline/report" target="_blank">
  <Button variant="outline" size="sm">
    <FileText className="w-3.5 h-3.5 mr-1.5" />
    Report
  </Button>
</Link>
```

**Step 3: Verify**

Open: `http://localhost:3000/timeline`
Expected: "Report" button visible in toolbar. Clicking opens report page in new tab.

**Step 4: Commit**

```bash
git add src/components/gantt/gantt-toolbar.tsx
git commit -m "feat(report): add report link to timeline toolbar"
```
