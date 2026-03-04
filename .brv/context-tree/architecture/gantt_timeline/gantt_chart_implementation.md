---
title: Gantt Chart Implementation
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: '2026-03-04T19:11:22.498Z'
updatedAt: '2026-03-04T19:16:14.334Z'
---
## Raw Concept
**Task:**
Implement interactive Gantt chart with drag-and-drop functionality

**Changes:**
- Moved state updates (setLocalProjects, startTransition) inside requestAnimationFrame to avoid "Cannot call startTransition while rendering" error
- Changed useMemo side-effect for syncing props to useEffect

**Files:**
- src/components/gantt/gantt-chart.tsx

**Flow:**
Drag Start -> MouseMove (Update dragState) -> MouseUp -> requestAnimationFrame -> Calculate Delta -> Update Local State -> Start Transition (Update DB)

**Timestamp:** 2026-03-04

## Narrative
### Structure
The Gantt chart uses a custom layout engine computed via useMemo. It supports month and week view modes. The chart is split into a fixed-width left panel for project names and a scrollable canvas for the timeline.

### Dependencies
Uses date-fns for date manipulation, lucide-react for icons, and custom hooks/components for Gantt logic.

### Highlights
Supports project moving and resizing via drag-and-drop. Drag operations are debounced using requestAnimationFrame to ensure smooth UI updates and avoid React state update conflicts during render.

### Rules
Rule 1: Always use requestAnimationFrame for drag-and-drop state processing.
Rule 2: Sync props with internal state using useEffect, not useMemo.
Rule 3: Use transitions for database updates to keep UI responsive.

## Facts
- **drag_state_management**: Drag-and-drop state updates must occur outside of render cycle [project]
- **prop_syncing**: Syncing props to internal state uses useEffect [project]
