---
title: Gantt Timeline Implementation
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T19:03:20.057Z'
updatedAt: '2026-03-04T19:03:20.057Z'
---
## Raw Concept
**Task:**
Implement Gantt chart timeline feature

**Changes:**
- Added timeline_projects, timeline_tasks, timeline_milestones, timeline_task_dependencies DB tables
- Implemented custom Gantt chart component using Tailwind/CSS
- Added drag-to-resize and drag-to-move functionality using native mouse events
- Added support for view modes: day, week, month
- Implemented dependency SVG arrows and milestones support

**Files:**
- src/components/gantt/gantt-chart.tsx
- src/lib/db/schema.ts
- src/lib/actions/timeline.ts
- src/lib/queries/timeline.ts
- src/components/gantt/gantt-types.ts

**Flow:**
data loaded via getFullTimelineData -> GanttChart component renders rows and tasks -> interaction (drag/resize) -> updateTaskDates server action -> revalidatePath

**Timestamp:** 2026-03-04

## Narrative
### Structure
The Gantt chart is implemented as a custom component in src/components/gantt/. It uses native mouse events for drag-and-drop interactions instead of external libraries like @dnd-kit. The layout engine calculates X/Y positions based on view modes (day, week, month).

### Dependencies
Uses date-fns for date calculations. Database schema is in src/lib/db/schema.ts.

### Highlights
Supports project-task hierarchy, task dependencies (finish-to-start), milestones with project-specific Y-positioning, and responsive view modes.

### Rules
Rule 1: All timeline-related DB updates must trigger revalidateTimeline() (revalidating /timeline and /admin/timeline).
Rule 2: Drag-and-drop interactions are restricted to authenticated users only.
Rule 3: Task start date cannot be after end date.

### Examples
Drag interactions trigger handleBarMouseDown, which sets up mousemove and mouseup listeners to calculate and persist date changes.

## Facts
- **view_modes**: Gantt timeline supports day, week, and month views [project]
- **drag_interaction_method**: Drag-and-drop uses native mouse events [project]
- **dependency_type**: Task dependencies are 'finish-to-start' [project]
