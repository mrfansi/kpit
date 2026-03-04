---
title: KPI Management and Sorting
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: '2026-03-04T18:09:25.181Z'
updatedAt: '2026-03-04T18:14:08.479Z'
---
## Raw Concept
**Task:**
Implement drag-and-drop KPI sorting using @dnd-kit

**Changes:**
- Replaced manual up/down buttons with drag-and-drop UI
- Added bulkReorderKPIs server action for batch updates
- Updated createKPI to automatically assign next sortOrder
- Added normalizeSortOrder utility for domain-scoped ranking

**Files:**
- src/lib/actions/kpi.ts
- src/components/sortable-kpi-table.tsx

**Flow:**
Drag start -> optimistic UI update -> handleDragEnd -> bulkReorderKPIs (server action) -> revalidatePath

**Timestamp:** 2026-03-05

## Narrative
### Structure
Sorting is domain-scoped. Every KPI belongs to a domainId and holds a sortOrder relative to its siblings in the same domain.

### Highlights
Uses @dnd-kit for accessible drag-and-drop. Server-side persistence via bulkReorderKPIs ensures data consistency after reordering.

### Rules
Rule 1: KPIs can only be reordered within the same domain.
Rule 2: Drag is restricted to the vertical axis.
Rule 3: New KPIs are appended to the end of their domain list (max sortOrder + 1).
