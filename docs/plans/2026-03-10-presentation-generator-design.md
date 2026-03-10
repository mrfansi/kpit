# KPI Report Presentation Generator

**Date:** 2026-03-10
**Status:** Approved

## Overview

Generate interactive HTML presentations from KPI Report data. Standalone HTML file with animations, SVG charts, AI narratives, and keyboard navigation. Supports both live presentation and PDF export via browser print.

## Target Audience

Both executive and operational teams. Executive summary at the start, detailed per-domain slides after.

## Trigger

Button "Presentasi" on `/report/all` page, next to existing Print button. Opens generated HTML in a new tab.

## Slide Structure

1. **Title** — "Laporan KPI [Periode]", date, org name, hero SVG illustration
2. **Executive Summary** — Animated gauge (health score), animated donut chart (status distribution), MoM trend bars, AI narrative (typewriter effect)
3. **Per Domain (1 slide each)** — Domain name + icon + color, animated bar chart (achievement%), hover-detail KPI table, animated SVG sparklines, status badges, AI insight (fade-in), domain-themed SVG illustration
4. **KPI Perlu Perhatian** — Card layout per problematic KPI, slide-up animation, animated delta counters, red/yellow visual coding
5. **Penutup** — Animated summary counters, goal-themed SVG illustration

## Navigation & Interaction

- Arrow keys left/right for slide navigation
- Click navigation
- `F` key for fullscreen
- Progress bar at bottom
- Slide transition: translateX + opacity (300ms)
- Hover tooltips on all data points

## Architecture

### Data Flow

```
User clicks "Presentasi" on /report/all
  -> GET /api/report/presentation?period=2026-03-01
  -> Server queries: KPIs, entries, comparisons, domains
  -> Server calls AI narrative per domain (parallel)
  -> Server renders HTML string with all data embedded
  -> Response: Content-Type text/html
  -> Browser opens in new tab -> presentation mode
```

### New Files

1. `src/app/api/report/presentation/route.ts` — API route, data fetching + HTML assembly
2. `src/lib/presentation/slides.ts` — Functions to generate each slide type
3. `src/lib/presentation/styles.ts` — CSS string (animations, layout, responsive)
4. `src/lib/presentation/charts.ts` — SVG generators (gauge, donut, bar chart, sparkline)
5. `src/lib/presentation/illustrations.ts` — SVG illustrations per theme
6. `src/lib/presentation/engine.ts` — JavaScript for navigation, animation triggers, fullscreen, keyboard

### Dependencies

None. Pure HTML + CSS + JS + inline SVG.

### AI Integration

- Reuse pattern from existing `/api/report/narrative`
- Parallel API calls: 1 per domain + 1 executive summary
- Fallback: data summary without narrative if AI fails

### Auth

Requires active session (same as existing reports).

## Visual Design

### Colors

- Slide background: gradient #0f172a -> #1e293b
- Text: #f8fafc (white)
- Accent: domain.color from database
- Status: green (#22c55e), yellow (#eab308), red (#ef4444)
- Card background: rgba(255,255,255,0.08)

### Typography

- System font stack (Inter preferred, sans-serif fallback)
- Title: 3rem bold
- Heading: 2rem semibold
- Body: 1rem
- Large numbers: 4rem bold with gradient text

### Animations

- Counter: 0 to value (800ms)
- Bar chart: width 0% to value (600ms, staggered)
- Sparkline: stroke-dashoffset draw (1s)
- Donut: stroke-dasharray rotation (800ms)
- Gauge: rotate 0 to angle (1s ease-out)
- Cards: translateY + opacity staggered (400ms, 100ms delay)
- Typewriter: AI text per character (30ms/char)

### Print Mode (@media print)

- White background, black text
- All animations disabled
- 1 slide per page (page-break-after: always)
- 16:9 aspect ratio maintained
- Charts rendered at final state
