# Design: KPI Dashboard (kpit)

The locked system. Every Hallmark run reads this first and screens share it. Change it on purpose; the file is the rule.

## System
- Genre: modern-minimal
- Shape of the first page: app screen (sidebar shell kept: sixteen destinations, a sheet under `lg`)
- Theme: brand, the "panel instrumen" palette (vibe: "a measuring instrument, quiet chrome, loud readings")
- Axes: light/grotesk-sans/neutral · posture: restrained · modes: light+dark (next-themes `.dark` class)
- Signature: the KPI readout ledger. One KPI per row; the value set as a readout; a square-ended 0 to 125% gauge with a tick at 100%; status carried by the gauge fill and the percent, never by a side stripe.

## Tokens
`src/app/tokens.css` is the source of truth; `src/app/globals.css` only maps shadcn names (`--background`, `--primary`, …) onto these roles.
```css
:root {
  --color-paper: oklch(99% 0 0);  --color-paper-2: oklch(97.5% 0 0);  --color-paper-3: oklch(96% 0 0);  --color-surface: oklch(100% 0 0);
  --color-ink: oklch(18% 0 0);  --color-ink-2: oklch(25% 0 0);  --color-muted: oklch(51% 0 0);  --color-rule: oklch(90% 0 0);
  --color-edge: oklch(64% 0 0);  /* field edges, 3:1 */
  --color-accent: oklch(20% 0 0);  --color-accent-ink: oklch(99% 0 0);  --color-focus: oklch(40% 0 0);
  --success / --warning / --danger (+ -soft, -fill): the only hues, KPI status only, always via statusConfig.
  --font-display: Archivo;  --font-body: Archivo;  --font-outlier: JetBrains Mono (code only);
  --radius-card: 6px (surfaces);  controls 4px;  chips 2px;  --shadow-card: none;  --rule-hair: 1px;
}
```
Hue enters only as KPI status (`src/lib/kpi-status.ts`) or a domain/project identity colour from the database. Any other hue, raw palette class or literal is a bug.
The spacing scale, the type scale, the easings and the durations are the scaffold's and live in `tokens.css`.

## Type
- One family, Archivo variable (wght + wdth). Weights 400 and 600; 800 only for the wordmark (Archivo at 125% width).
- Figures: the `num` utility, Archivo at 87.5% width with tabular lining numerals. The one figure a region is about is the readout (`text-readout` or `text-3xl`, 600).
- Screen title `text-2xl` 600; section head `text-lg` 600; item title `text-base` 600; body 16px; table cells, controls and meta 14px. Labels are sentence case, never tracked capitals, never mono.

## Controls
- Primary: ink fill · 4px radius · 36px (32px `sm`), hit area widened to 44px · one per screen
- Secondary: outline (rule border, hover surface) or ghost · same radius and height
- Fields: card fill, constant 3:1 edge, focus is an inset outline, never a border change

## Surfaces
Whitespace, then a hairline, then a tinted well (`bg-paper-2`, no border), then a card (border, no shadow) only for independently interactive content. Tables are bare: horizontal rules, no outer border. No card in a card.

## Motion
- Character: still. Colour and opacity transitions at `--dur-micro`/`--dur-short`; no reveals; under reduced motion everything ends at once.

## Exports
`tokens.css` in this project. Tailwind v4 utilities come from its `@theme static` block plus the shadcn `@theme inline` map in `globals.css`.
