---
title: Layout and Navigation
tags: []
related: [architecture/structure/repository_layout.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-04T18:21:19.243Z'
updatedAt: '2026-03-04T18:21:19.243Z'
---
## Raw Concept
**Task:**
Define global layout and responsive navigation components

**Changes:**
- Made desktop sidebar sticky with independent scroll for navigation
- Implemented responsive MobileHeader using Sheet component (w-64)
- Added user info, account link, and logout button to navigation footers
- Integrated ThemeToggle into Sidebar and MobileHeader

**Files:**
- src/app/layout.tsx
- src/components/sidebar.tsx
- src/components/mobile-header.tsx

**Flow:**
RootLayout -> MobileHeader (mobile) + Sidebar (desktop) + Main Content

**Timestamp:** 2026-03-05

## Narrative
### Structure
The application uses a standard sidebar layout. `RootLayout` manages the overall grid: `MobileHeader` is visible on screens < lg, while `Sidebar` is hidden. On screens >= lg, `Sidebar` is shown and `MobileHeader` (specifically its hamburger menu) is effectively replaced by the desktop sidebar.

### Highlights
Navigation is dynamically populated from database domains. Admin links are conditionally rendered based on authentication status. The layout supports print mode by hiding navigation elements using `print:hidden`.

### Rules
Rule 1: Use `sticky top-0` for headers and sidebars to maintain visibility during scroll
Rule 2: Ensure navigation footers contain account management and theme controls
Rule 3: Use `overflow-y-auto` on navigation lists to prevent layout breaking with many domains

### Examples
Desktop Sidebar: `<aside className="w-56 shrink-0 border-r bg-background flex flex-col h-screen sticky top-0 print:hidden">`

## Facts
- **sidebar_layout**: Desktop sidebar uses sticky positioning with h-screen and overflow-y-auto for the nav [project]
- **mobile_nav_width**: Mobile navigation uses a Sheet component with a 64-unit width [project]
- **navigation_footer**: Theme toggle and user info are integrated into both sidebar and mobile sheet footers [project]
