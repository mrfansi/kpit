# Timeline Gantt Enhancements — Design

**Date:** 2026-03-09

## Overview

Three enhancements to the timeline gantt chart: bar date labels, dynamic project statuses, and improved progress log UX.

## Feature 1: Start/End Dates on Gantt Bar

Display formatted dates at both ends of each project bar for quick visual reference.

- **Left end**: start date in "dd MMM" format (e.g. "01 Mar")
- **Right end**: end date in same format
- **Font**: 9px, semi-transparent color matching project color
- **Responsive**: hide dates when bar width < 120px to avoid overlap
- **Pointer events**: none (dates don't interfere with drag handles)

**Files affected:** `gantt-chart.tsx`

## Feature 2: Dynamic Project Statuses

### Database

New table `timeline_project_statuses`:
- `id` (integer, PK, autoincrement)
- `name` (text, required) — display name e.g. "On-Track"
- `slug` (text, required, unique) — e.g. "on_track"
- `color` (text, hex) — badge and visual hint color
- `sortOrder` (integer, default 0)
- `createdAt` (timestamp)

Column added to `timeline_projects`:
- `statusId` (integer, FK → timeline_project_statuses, nullable)

Seed data: Not Started (#9ca3af gray), On-Track (#3b82f6 blue), On-Hold (#f59e0b amber), Delayed (#ef4444 red), Launched (#22c55e green).

### Settings Page (`/admin/timeline/statuses`)

CRUD for status management:
- List all statuses with color preview and name
- Add new status (name + color picker)
- Edit existing status name/color
- Delete with protection (cannot delete if any project uses it)
- Reorder via sortOrder

### Left Panel Display

Badge below project name: colored dot + status label text. Uses color from status definition.

### Gantt Bar Visual Hints

Bar styling based on status color:
- Background: `{statusColor}20` (same pattern as current project color)
- Border: `2px solid {statusColor}`
- Special cases driven by slug:
  - `not_started`: opacity 50%, border dashed
  - `on_hold`: opacity 60%
  - All others: normal opacity, solid border

### Form Integration

Dropdown select in project form showing all available statuses from DB. Positioned below progress field.

## Feature 3: Progress Log Side Panel

### Trigger

ClipboardList icon appears on hover of project row in left panel, next to existing Pencil (edit) icon. Only visible when `isAuthenticated`.

### Layout

- Panel slides in from right side, width 360px
- Overlay on top of gantt canvas (z-index above bars, below dialogs)
- Header: project name + close button (X)
- Body: existing `TimelineProgressLog` component

### Behavior

- Single panel at a time — clicking different project replaces content
- Close via X button or clicking outside panel
- Fetch logs when panel opens (same as current dialog behavior)
- Panel state managed in `GanttChart` component: `logPanelProject: TimelineProject | null`

### Migration from Dialog

Progress log button in edit form dialog remains as secondary access point. Primary access moves to left panel icon.

## Files to Create/Modify

**New files:**
- `drizzle/0010_project_statuses.sql` — migration
- `src/app/admin/timeline/statuses/page.tsx` — settings page
- `src/components/gantt/gantt-log-panel.tsx` — side panel component
- `src/lib/queries/timeline-statuses.ts` — status queries
- `src/lib/actions/timeline-statuses.ts` — status CRUD actions
- `src/lib/validations/timeline-status.ts` — status validation schema

**Modified files:**
- `src/lib/db/schema.ts` — new table + FK
- `src/lib/validations/timeline.ts` — add statusId field
- `src/lib/actions/timeline.ts` — persist statusId
- `src/components/gantt/gantt-chart.tsx` — bar dates, status visuals, log panel
- `src/components/timeline-project-form.tsx` — status dropdown
- `src/components/gantt/gantt-types.ts` — ROW_HEIGHT increase if needed
