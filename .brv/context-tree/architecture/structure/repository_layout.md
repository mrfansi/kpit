---
title: Repository Layout
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T17:50:46.652Z'
updatedAt: '2026-03-04T17:50:46.652Z'
---
## Raw Concept
**Task:**
Document repository folder structure

**Files:**
- src/
- drizzle/
- docs/
- public/

**Flow:**
src/app (routes) -> src/components (UI) -> src/lib (logic) -> src/lib/db (data)

**Timestamp:** 2026-03-04

## Narrative
### Structure
The project follows a modern Next.js App Router structure:
- `src/app/`: Route handlers and page layouts
- `src/components/`: Reusable UI components (shadcn/ui style)
- `src/lib/`: Core business logic, utilities, and database clients
- `drizzle/`: Database migrations and snapshots
- `docs/`: Design documents and implementation plans
- `public/`: Static assets

### Dependencies
Next.js 15+, Drizzle ORM, SQLite, Tailwind CSS

### Highlights
Uses Drizzle ORM for SQLite management. Components are highly modularized. Logic is centralized in the `lib` directory for testability and reuse.
