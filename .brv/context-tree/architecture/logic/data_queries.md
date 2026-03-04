---
title: Data Queries
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T18:03:48.368Z'
updatedAt: '2026-03-04T18:03:48.368Z'
---
## Raw Concept
**Task:**
Database abstractions for KPI management

**Changes:**
- Fixed timezone bug in getPeriodComparisonEntries: Now parses year/month directly from string to determine MoM and YoY periods

**Files:**
- src/lib/queries.ts

**Flow:**
Parse current period -> Calculate prevMonth/prevYear dates -> Fetch latest entries for those dates

**Timestamp:** 2026-03-04

## Narrative
### Structure
Provides functions for domain, KPI, entry, target, and comment retrieval using Drizzle ORM.

### Highlights
Supports complex batching for dashboard views (latest entries, sparklines, and target overrides in parallel queries).

### Rules
Rule 1: MoM comparison uses currentMonth - 1.
Rule 2: YoY comparison uses currentYear - 1.
