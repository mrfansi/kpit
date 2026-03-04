---
title: Period Comparison
tags: []
related: [architecture/components/trend_chart.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T17:58:25.998Z'
updatedAt: '2026-03-04T17:58:25.998Z'
---
## Raw Concept
**Task:**
Implement period-over-period comparison (MoM, YoY)

**Files:**
- src/components/period-comparison.tsx
- src/lib/period.ts

**Flow:**
Current Entry + Previous Entry -> Calculate Delta -> Render Trending Icon

**Timestamp:** 2026-03-04

## Narrative
### Structure
Delta component calculates absolute and percentage differences between time periods.

### Dependencies
Lucide React (TrendingUp, TrendingDown, Minus), date-fns (for period formatting)

### Highlights
Supports "lower is better" KPIs (e.g., expenses, errors) by inverting color logic. Handles zero-value cases to avoid division by zero.

### Rules
Rule 1: If current or comparison value is null, return em-dash (—).
Rule 2: Green color indicates improvement (up for regular KPIs, down for "lowerBetter" KPIs).
Rule 3: Percentage is formatted to 1 decimal place.
