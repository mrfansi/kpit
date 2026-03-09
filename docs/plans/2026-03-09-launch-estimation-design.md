# Launch Estimation for Timeline Projects

**Date:** 2026-03-09
**Status:** Approved

## Problem

Timeline projects have `startDate` and `endDate` representing the work period, but there's no way to track when a project is expected to launch (go-live). The launch date typically comes after the work period ends, accounting for QA, deployment prep, and other buffer activities.

## Design

### Approach: `launchBufferDays` + `estimatedLaunchDate`

Add two columns to `timeline_projects`:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `launchBufferDays` | integer | 7 | Days after `endDate` for auto-calculation |
| `estimatedLaunchDate` | text (YYYY-MM-DD) | null | Manual override; when set, ignores buffer calculation |

**Logic:**
- If `estimatedLaunchDate` is null → launch date = `endDate + launchBufferDays`
- If `estimatedLaunchDate` is set → use that value directly (manual override)
- When project is dragged/resized in Gantt (endDate changes) and no manual override → launch date auto-shifts

### Gantt Chart Visual

- **Per-row vertical line** (not full-height like today line) — only spans the project's row
- **Color**: emerald-500 (`#10b981`) — distinct from red today line
- **Label**: small badge above the line showing "Launch: DD MMM"
- **Position**: calculated using existing `dateToX()` function

```
 Projects        |  Jan    Feb    Mar    Apr    Mei
─────────────────|──────────────────────────────────
 📁 Project A    |  ████████████████░░░  |🚀
                 |  [=== bar ===]        ↑ launch marker
─────────────────|──────────────────────────────────
 📁 Project B    |       ████████████   |🚀
```

### Form UI

In the project edit dialog, add a "Launch Estimation" section:
- Number input for `bufferDays` (default 7)
- Read-only calculated date that updates when buffer or endDate changes
- Toggle "Override manual" → reveals date picker for manual override
- When manual override is active, buffer input is disabled/dimmed

### What Does NOT Change

- Drag-and-drop logic for project bars
- Existing layout engine (only extends `maxDate` if launch date exceeds current range)
- GanttTodayLine component
- Progress tracking and logs

## Files to Modify

1. `src/lib/db/schema.ts` — add columns to `timelineProjects`
2. `src/lib/validations/timeline.ts` — add validation for new fields
3. `src/lib/actions/timeline.ts` — handle new fields in create/update
4. `src/components/gantt/gantt-chart.tsx` — render launch markers per row
5. `src/components/gantt/gantt-launch-marker.tsx` — new component for the marker
6. `src/components/timeline-project-form.tsx` — add launch estimation section
7. DB migration for new columns
