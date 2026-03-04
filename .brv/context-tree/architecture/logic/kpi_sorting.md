---
title: KPI Sorting
tags: []
related: [architecture/logic/data_queries.md, architecture/structure/repository_layout.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T18:07:36.193Z'
updatedAt: '2026-03-04T18:07:36.193Z'
---
## Raw Concept
**Task:**
Implement manual KPI reordering within domains

**Files:**
- src/components/reorder-kpi-buttons.tsx
- src/lib/actions/kpi.ts
- src/lib/queries.ts

**Flow:**
Admin clicks up/down -> reorderKPI server action -> swap sortOrder in DB -> revalidatePath -> UI updates

**Timestamp:** 2026-03-04

## Narrative
### Structure
Uses a `sortOrder` column in the `kpis` table to maintain custom ordering. The `ReorderKPIButtons` component provides the UI for shifting items.

### Dependencies
Drizzle ORM for database operations, Next.js Server Actions for reordering logic.

### Highlights
Supports swapping `sortOrder` between adjacent active KPIs within the same domain. Falls back to alphabetical sorting (`kpis.name`) if `sortOrder` is identical.

### Rules
Rule 1: Reordering is scoped to the KPI's domain.
Rule 2: Only active KPIs are considered during reordering.
Rule 3: Swapping requires an adjacent sibling in the requested direction (up/down).

### Examples
reorderKPI(id, "up") finds the sibling with the next smallest sortOrder and swaps their values.
