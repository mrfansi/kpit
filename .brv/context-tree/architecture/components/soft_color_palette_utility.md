---
title: Soft Color Palette Utility
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T20:01:03.229Z'
updatedAt: '2026-03-04T20:01:03.229Z'
---
## Raw Concept
**Task:**
Implement shared soft color palette utility for consistent UI color assignment

**Files:**
- src/lib/colors.ts
- src/components/domain-form.tsx
- src/components/timeline-project-form.tsx

**Timestamp:** 2026-03-05

**Author:** System

## Narrative
### Structure
Shared utility module in src/lib/colors.ts provides a curated list of soft pastel colors and a generator function `generateSoftColor()` to pick a random one.

### Highlights
Eliminated hardcoded palette duplication in domain-form and timeline-project-form. Forms now consistently support auto-generating a soft color for new entries.

### Examples
const autoColor = generateSoftColor(); // Returns a random hex string from SOFT_PALETTE

## Facts
- **color_palette**: Shared soft color palette is defined in src/lib/colors.ts [project]
- **color_utility**: generateSoftColor() picks a random color from the curated list [project]
