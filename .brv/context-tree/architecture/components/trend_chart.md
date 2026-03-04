---
title: Trend Chart
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: '2026-03-04T17:58:07.185Z'
updatedAt: '2026-03-04T18:03:48.363Z'
---
## Raw Concept
**Task:**
Visualize KPI historical trends and forecasts

**Changes:**
- Fixed bridge point duplication: Merged forecast value into last actual data point to ensure line continuity without duplicate x-axis entries
- Improved date formatting for chart axis and tooltips

**Files:**
- src/components/trend-chart.tsx

**Flow:**
Actual data mapping -> Bridge point injection -> Forecast data mapping -> Recharts LineChart rendering

**Timestamp:** 2026-03-04

## Narrative
### Structure
Uses Recharts LineChart with two overlapping Line components: one for "Actual" (solid) and one for "Forecast" (dashed).

### Dependencies
Depends on KPIEntry and ForecastPoint types, utilizes UI chart components for container and tooltips.

### Highlights
Includes a ReferenceLine for the target value. The "bridge" logic ensures the forecast line starts exactly where the actual line ends by adding a forecast value to the last actual entry.

### Rules
Rule 1: If no entries exist, return empty state message.
Rule 2: Forecast line must be dashed (strokeDasharray="5 3").
Rule 3: Target line must be labeled and dashed.
