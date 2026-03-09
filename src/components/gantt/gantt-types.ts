export type ViewMode = "week" | "month";

export const VIEW_MODE_CONFIG: Record<
  ViewMode,
  { colWidth: number; headerFormat: string; unitDays: number }
> = {
  week: { colWidth: 120, headerFormat: "'W'w", unitDays: 7 },
  month: { colWidth: 180, headerFormat: "MMM yy", unitDays: 30 },
};

export const ROW_HEIGHT = 60;
export const HEADER_HEIGHT = 48;
export const ROW_LIST_WIDTH = 280;

export interface GanttColumn {
  label: string;
  x: number;
  width: number;
  isCurrentPeriod?: boolean;
}

export type DragMode = "move" | "resize-start" | "resize-end";
