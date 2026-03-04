---
title: Timeline Project Form
tags: []
keywords: []
importance: 60
recency: 1
maturity: draft
updateCount: 2
createdAt: '2026-03-04T19:21:13.796Z'
updatedAt: '2026-03-04T19:57:03.504Z'
---
## Raw Concept
**Task:**
Implement UI improvements for project creation and editing

**Changes:**
- Replaced manual color picker with auto-generated soft pastel color palette
- Added refresh button to regenerate project colors
- Implemented manual color override using native color picker
- Syncs selected color to form data via hidden input

**Files:**
- src/components/timeline-project-form.tsx

**Flow:**
Initialize with random soft color -> User can refresh color or override manually -> Submit form with color value

**Timestamp:** 2026-03-05

## Narrative
### Structure
The timeline project form uses a predefined SOFT_PALETTE for consistent, readable project colors. The color selection UI includes a swatch that reflects the current color, a hidden input for form submission, and a refresh button for new projects.

### Highlights
Color selection is restricted to a curated palette of 12 soft pastel colors for better visual accessibility and aesthetics.

### Rules
Rule 1: New projects must be assigned a random color from SOFT_PALETTE
Rule 2: Edit mode preserves existing project color
Rule 3: Manual color override is supported via native color input

### Examples
SOFT_PALETTE includes: #7C9EF5 (blue), #F5A27C (orange), #7CE0B8 (mint), etc.
