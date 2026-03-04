---
title: Forecasting Logic
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: '2026-03-04T17:58:26.002Z'
updatedAt: '2026-03-04T18:03:48.366Z'
---
## Raw Concept
**Task:**
Calculate linear regression-based KPI forecasts

**Changes:**
- Fixed timezone off-by-one bug: addMonths now parses YYYY-MM directly from string instead of using Date object conversion
- Consistent projections: Forecast now uses all entries instead of range-filtered subset for more stable slopes

**Files:**
- src/lib/forecast.ts

**Flow:**
Sort entries by date -> Map to [index, value] pairs -> Calculate linear regression (slope/intercept) -> Generate future points

**Timestamp:** 2026-03-04

## Narrative
### Structure
Implements Simple Linear Regression (Least Squares) to project future values.

### Highlights
Projects 3 future months by default. Ensures projected values never drop below zero using Math.max(0, ...).

### Rules
Rule 1: Minimum 2 entries required for calculation.
Rule 2: Dates are normalized to the 1st of the month (YYYY-MM-01).

### Examples
addMonths("2024-12-01", 1) -> "2025-01-01"
