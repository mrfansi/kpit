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
