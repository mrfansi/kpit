---
title: KPI Management and Sorting
tags: []
related: [architecture/logic/data_queries.md, architecture/structure/repository_layout.md]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 2
createdAt: '2026-03-04T18:09:25.181Z'
updatedAt: '2026-11-04T11:52:28.562Z'
consolidated_at: '2026-11-04T11:52:40.712Z'
consolidated_from: [{date: '2026-11-04T11:52:40.712Z', path: architecture/logic/kpi_sorting.md, reason: 'Both document KPI reordering via sortOrder in the same domain scope and the same src/lib/actions/kpi.ts server actions. kpi_sorting.md describes the superseded manual up/down buttons (reorder-kpi-buttons.tsx, reorderKPI) while kpi_management_and_sorting.md describes the replacement @dnd-kit drag-and-drop (sortable-kpi-table.tsx, bulkReorderKPIs, normalizeSortOrder). Over 50% overlap; merge into the richer file while preserving the historical manual-reordering approach as temporal context.'}]
---
## Reason
Consolidated KPI sorting knowledge: original manual up/down reordering (2026-03-04) superseded by @dnd-kit drag-and-drop (2026-03-05)

## Raw Concept
**Task:**
Implement domain-scoped KPI sorting, evolving from manual up/down buttons to drag-and-drop with @dnd-kit

**Changes:**
- (2026-03-04) Added `sortOrder` column in the `kpis` table and `ReorderKPIButtons` component for manual up/down reordering
- (2026-03-05) Replaced manual up/down buttons with drag-and-drop UI (@dnd-kit)
- (2026-03-05) Added bulkReorderKPIs server action for batch updates
- (2026-03-05) Updated createKPI to automatically assign next sortOrder
- (2026-03-05) Added normalizeSortOrder utility for domain-scoped ranking

**Files:**
- src/lib/actions/kpi.ts
- src/components/sortable-kpi-table.tsx
- src/components/reorder-kpi-buttons.tsx (superseded legacy UI)
- src/lib/queries.ts

**Flow:**
Current: Drag start -> optimistic UI update -> handleDragEnd -> bulkReorderKPIs (server action) -> revalidatePath
Legacy: Admin clicks up/down -> reorderKPI server action -> swap sortOrder in DB -> revalidatePath -> UI updates

**Timestamp:** 2026-03-05

## Narrative
### Structure
Sorting is domain-scoped. Every KPI belongs to a domainId and holds a sortOrder relative to its siblings in the same domain. The `sortOrder` column in the `kpis` table maintains custom ordering. As of 2026-03-05 the primary UI is `SortableKPITable` (src/components/sortable-kpi-table.tsx) using @dnd-kit; the earlier `ReorderKPIButtons` component (src/components/reorder-kpi-buttons.tsx) with `reorderKPI(id, "up"|"down")` is the superseded approach.

### Dependencies
Drizzle ORM for database operations, Next.js Server Actions for reordering logic, @dnd-kit for accessible drag-and-drop.

### Highlights
Uses @dnd-kit for accessible drag-and-drop. Server-side persistence via bulkReorderKPIs ensures data consistency after reordering. The legacy path swapped `sortOrder` between adjacent active KPIs within the same domain and fell back to alphabetical sorting (`kpis.name`) if `sortOrder` values were identical.

### Rules
Rule 1: KPIs can only be reordered within the same domain.
Rule 2: Drag is restricted to the vertical axis.
Rule 3: New KPIs are appended to the end of their domain list (max sortOrder + 1).
Rule 4: Only active KPIs are considered during reordering.
Rule 5: Legacy swap required an adjacent sibling in the requested direction (up/down).

### Examples
Legacy: reorderKPI(id, "up") finds the sibling with the next smallest sortOrder and swaps their values.
Current: handleDragEnd -> bulkReorderKPIs(orderedIds) persists the new domain-scoped ranking, then revalidatePath refreshes the table.
