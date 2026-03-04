---
title: Sortable KPI Table
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T18:14:08.481Z'
updatedAt: '2026-03-04T18:14:08.481Z'
---
## Raw Concept
**Task:**
Create SortableKPITable and SortableRow components

**Files:**
- src/components/sortable-kpi-table.tsx

**Flow:**
DndContext -> SortableContext (per domain) -> SortableRow

**Timestamp:** 2026-03-05

## Narrative
### Structure
SortableKPITable wraps a standard Table. It groups KPIs by domain and creates a SortableContext for each group to ensure reordering stays within boundaries.

### Dependencies
@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/modifiers, @dnd-kit/utilities

### Highlights
Optimistic updates via React state + useTransition. GripVertical icon used as drag handle via attributes and listeners.

### Examples
Usage in admin page: <SortableKPITable kpis={pagedKpis} domainMap={domainMap} />
