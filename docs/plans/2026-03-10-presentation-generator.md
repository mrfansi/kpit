# KPI Report Presentation Generator — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Presentasi" button to the Executive Report page that generates a standalone, interactive HTML presentation with animated charts, AI narratives per domain, and keyboard navigation.

**Architecture:** Server-side HTML generation via a Next.js API route (`/api/report/presentation`). The route fetches all KPI data and domain info, calls the AI service in parallel for per-domain insights, then assembles a single self-contained HTML document with inline CSS, JS, and SVG. No external dependencies.

**Tech Stack:** Next.js API routes, inline HTML/CSS/JS, SVG charts, Gemini AI (existing integration)

**Design doc:** `docs/plans/2026-03-10-presentation-generator-design.md`

---

## Task 1: Presentation Styles Module

**Files:**
- Create: `src/lib/presentation/styles.ts`

**Step 1: Create the styles module**

This module exports a single function that returns the full CSS string for the presentation. All animations, layout, typography, and print styles live here.

```typescript
// src/lib/presentation/styles.ts

export function getPresentationStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-start: #0f172a;
      --bg-end: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --card-bg: rgba(255,255,255,0.08);
      --card-border: rgba(255,255,255,0.12);
      --green: #22c55e;
      --yellow: #eab308;
      --red: #ef4444;
      --blue: #3b82f6;
    }

    html, body {
      width: 100%; height: 100%; overflow: hidden;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, var(--bg-start), var(--bg-end));
      color: var(--text);
    }

    /* Slide container */
    .slides-wrapper {
      position: relative; width: 100vw; height: 100vh; overflow: hidden;
    }
    .slide {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      padding: 4rem 6rem;
      opacity: 0; transform: translateX(60px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
    }
    .slide.active {
      opacity: 1; transform: translateX(0); pointer-events: auto;
    }
    .slide.prev {
      opacity: 0; transform: translateX(-60px);
    }

    /* Typography */
    .title-huge { font-size: 3rem; font-weight: 900; line-height: 1.1; }
    .title-large { font-size: 2rem; font-weight: 700; }
    .title-medium { font-size: 1.5rem; font-weight: 600; }
    .text-body { font-size: 1rem; line-height: 1.6; color: var(--text-muted); }
    .text-small { font-size: 0.875rem; color: var(--text-muted); }
    .number-huge {
      font-size: 4rem; font-weight: 900;
      background: linear-gradient(135deg, var(--green), var(--blue));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Cards */
    .card {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 1rem; padding: 1.5rem;
    }

    /* Status badges */
    .badge { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-green { background: rgba(34,197,94,0.15); color: var(--green); }
    .badge-yellow { background: rgba(234,179,8,0.15); color: var(--yellow); }
    .badge-red { background: rgba(239,68,68,0.15); color: var(--red); }

    /* Grid layouts */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .flex-center { display: flex; align-items: center; justify-content: center; }
    .flex-col { display: flex; flex-direction: column; }
    .gap-1 { gap: 0.5rem; } .gap-2 { gap: 1rem; } .gap-3 { gap: 1.5rem; }
    .w-full { width: 100%; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .mt-1 { margin-top: 0.5rem; } .mt-2 { margin-top: 1rem; } .mt-3 { margin-top: 1.5rem; }
    .mb-1 { margin-bottom: 0.5rem; } .mb-2 { margin-bottom: 1rem; }

    /* Table */
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--card-border); }
    .data-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .data-table tr:hover td { background: rgba(255,255,255,0.03); }
    .data-table .text-right { text-align: right; }

    /* Tooltip */
    .tooltip-wrap { position: relative; cursor: pointer; }
    .tooltip-wrap .tooltip {
      position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%) translateY(-4px);
      background: #1e293b; border: 1px solid var(--card-border); border-radius: 0.5rem;
      padding: 0.5rem 0.75rem; font-size: 0.75rem; white-space: nowrap;
      opacity: 0; pointer-events: none; transition: opacity 0.2s;
      z-index: 100;
    }
    .tooltip-wrap:hover .tooltip { opacity: 1; }

    /* Progress bar at bottom */
    .progress-bar {
      position: fixed; bottom: 0; left: 0; height: 3px;
      background: linear-gradient(90deg, var(--green), var(--blue));
      transition: width 0.3s ease; z-index: 50;
    }

    /* Slide counter */
    .slide-counter {
      position: fixed; bottom: 1rem; right: 2rem;
      font-size: 0.75rem; color: var(--text-muted); z-index: 50;
    }

    /* Navigation hints */
    .nav-hint {
      position: fixed; bottom: 1rem; left: 2rem;
      font-size: 0.75rem; color: var(--text-muted); z-index: 50;
      opacity: 0.5;
    }

    /* Animations */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes countUp { from { opacity: 0; } to { opacity: 1; } }
    @keyframes drawLine {
      from { stroke-dashoffset: var(--line-length, 1000); }
      to { stroke-dashoffset: 0; }
    }
    @keyframes growBar {
      from { width: 0%; }
      to { width: var(--bar-width); }
    }
    @keyframes rotateGauge {
      from { transform: rotate(-90deg); }
      to { transform: rotate(var(--gauge-angle)); }
    }
    @keyframes fillDonut {
      from { stroke-dasharray: 0 100; }
      to { stroke-dasharray: var(--donut-value) 100; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes typewriter {
      from { width: 0; }
      to { width: 100%; }
    }

    .animate-in { animation: fadeInUp 0.5s ease forwards; }
    .animate-delay-1 { animation-delay: 0.1s; opacity: 0; }
    .animate-delay-2 { animation-delay: 0.2s; opacity: 0; }
    .animate-delay-3 { animation-delay: 0.3s; opacity: 0; }
    .animate-delay-4 { animation-delay: 0.4s; opacity: 0; }
    .animate-delay-5 { animation-delay: 0.5s; opacity: 0; }
    .animate-delay-6 { animation-delay: 0.6s; opacity: 0; }

    .bar-animate {
      width: 0%; animation: growBar 0.6s ease forwards;
      animation-play-state: paused;
    }
    .slide.active .bar-animate { animation-play-state: running; }

    .sparkline-animate {
      stroke-dasharray: var(--line-length, 1000);
      stroke-dashoffset: var(--line-length, 1000);
      animation: drawLine 1s ease forwards;
      animation-play-state: paused;
    }
    .slide.active .sparkline-animate { animation-play-state: running; }

    .donut-animate {
      stroke-dasharray: 0 100;
      animation: fillDonut 0.8s ease forwards;
      animation-play-state: paused;
    }
    .slide.active .donut-animate { animation-play-state: running; }

    .card-animate {
      opacity: 0; animation: slideUp 0.4s ease forwards;
      animation-play-state: paused;
    }
    .slide.active .card-animate { animation-play-state: running; }

    /* Print styles */
    @media print {
      html, body { overflow: visible; background: white; color: black; }
      .slides-wrapper { position: static; overflow: visible; }
      .slide {
        position: static; opacity: 1 !important; transform: none !important;
        pointer-events: auto; page-break-after: always;
        width: 100%; height: auto; min-height: 100vh;
        padding: 2rem; background: white; color: black;
      }
      .slide.prev { opacity: 1 !important; transform: none !important; }
      .progress-bar, .slide-counter, .nav-hint { display: none; }
      .number-huge { -webkit-text-fill-color: #0f172a; color: #0f172a; }
      .card { background: #f8fafc; border-color: #e2e8f0; }
      .text-body, .text-small, .data-table th { color: #475569; }
      .badge-green { background: #dcfce7; color: #166534; }
      .badge-yellow { background: #fef9c3; color: #854d0e; }
      .badge-red { background: #fee2e2; color: #991b1b; }
      .bar-animate, .sparkline-animate, .donut-animate, .card-animate {
        animation: none !important; opacity: 1 !important;
      }
      .bar-animate { width: var(--bar-width) !important; }
      .sparkline-animate { stroke-dashoffset: 0 !important; }
      .donut-animate { stroke-dasharray: var(--donut-value) 100 !important; }
    }
  `;
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/presentation/styles.ts`

**Step 3: Commit**

```bash
git add src/lib/presentation/styles.ts
git commit -m "feat(presentation): add CSS styles module with animations and print support"
```

---

## Task 2: SVG Chart Generators

**Files:**
- Create: `src/lib/presentation/charts.ts`

**Step 1: Create the charts module**

This module provides pure functions that return SVG strings for gauge, donut, bar chart, and sparkline.

```typescript
// src/lib/presentation/charts.ts

/**
 * Gauge chart — semicircle showing a percentage value.
 * Used for health score on executive summary slide.
 */
export function svgGauge(opts: {
  value: number;       // 0-100
  size?: number;       // default 200
  color?: string;      // default green
  label?: string;
}): string {
  const { value, size = 200, color = "#22c55e", label } = opts;
  const r = size * 0.4;
  const circumference = Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2 + 10;

  return `<svg width="${size}" height="${size * 0.65}" viewBox="0 0 ${size} ${size * 0.65}">
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
      fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="12" stroke-linecap="round"/>
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
      fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      style="--gauge-angle: ${(value / 100) * 180 - 90}deg;"
      class="donut-animate" />
    <text x="${cx}" y="${cy - 15}" text-anchor="middle" fill="${color}"
      font-size="${size * 0.18}" font-weight="900">${value}%</text>
    ${label ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#94a3b8"
      font-size="${size * 0.07}">${label}</text>` : ""}
  </svg>`;
}

/**
 * Donut chart — shows distribution of categories.
 * Used for status distribution (green/yellow/red/no-data).
 */
export function svgDonut(opts: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}): string {
  const { segments, size = 180 } = opts;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return `<svg width="${size}" height="${size}"></svg>`;

  const r = 15.9155; // makes circumference ~100
  let cumulativeOffset = 25; // start at top
  const paths = segments.map((seg, i) => {
    const pct = (seg.value / total) * 100;
    const path = `<circle cx="50%" cy="50%" r="${r}" fill="none"
      stroke="${seg.color}" stroke-width="8"
      stroke-dasharray="${pct} ${100 - pct}"
      stroke-dashoffset="-${cumulativeOffset}"
      style="--donut-value: ${pct};"
      class="donut-animate" />`;
    cumulativeOffset += pct;
    return path;
  });

  const legend = segments
    .filter((s) => s.value > 0)
    .map((seg, i) =>
      `<div class="tooltip-wrap" style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:0.75rem;">
        <span style="width:8px;height:8px;border-radius:50%;background:${seg.color};display:inline-block;"></span>
        ${seg.value} ${seg.label}
        <span class="tooltip">${seg.label}: ${seg.value} (${total > 0 ? Math.round((seg.value / total) * 100) : 0}%)</span>
      </div>`
    )
    .join("");

  return `<div style="text-align:center;">
    <svg width="${size}" height="${size}" viewBox="0 0 42 42">
      <circle cx="50%" cy="50%" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8"/>
      ${paths.join("\n")}
      <text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="white" font-size="6" font-weight="700">${total}</text>
    </svg>
    <div style="margin-top:0.5rem;">${legend}</div>
  </div>`;
}

/**
 * Horizontal bar chart — one bar per KPI showing achievement %.
 * Used on domain slides.
 */
export function svgBarChart(opts: {
  items: { label: string; value: number; maxValue?: number; color: string; tooltip?: string }[];
}): string {
  const { items } = opts;
  const maxVal = Math.max(...items.map((i) => i.maxValue ?? i.value), 100);

  const rows = items
    .map((item, i) => {
      const widthPct = Math.min((item.value / maxVal) * 100, 100);
      return `<div class="tooltip-wrap" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
        <span style="width:140px;font-size:0.75rem;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.label}</span>
        <div style="flex:1;height:24px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
          <div class="bar-animate" style="height:100%;background:${item.color};border-radius:4px;--bar-width:${widthPct}%;animation-delay:${i * 0.1}s;display:flex;align-items:center;padding-left:8px;">
            <span style="font-size:0.7rem;font-weight:600;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.3);">${item.value}%</span>
          </div>
        </div>
        ${item.tooltip ? `<span class="tooltip">${item.tooltip}</span>` : ""}
      </div>`;
    })
    .join("");

  return `<div class="w-full">${rows}</div>`;
}

/**
 * Inline sparkline SVG — mini trend line.
 * Used in domain KPI tables.
 */
export function svgSparkline(opts: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}): string {
  const { values, width = 120, height = 32, color = "#22c55e" } = opts;
  if (values.length < 2) return `<svg width="${width}" height="${height}"></svg>`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  // Estimate path length for animation
  const pathLength = values.length * 15;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      style="--line-length:${pathLength};" class="sparkline-animate"/>
  </svg>`;
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit src/lib/presentation/charts.ts`

**Step 3: Commit**

```bash
git add src/lib/presentation/charts.ts
git commit -m "feat(presentation): add SVG chart generators (gauge, donut, bar, sparkline)"
```

---

## Task 3: SVG Illustrations

**Files:**
- Create: `src/lib/presentation/illustrations.ts`

**Step 1: Create the illustrations module**

Returns decorative SVG illustrations for each slide type.

```typescript
// src/lib/presentation/illustrations.ts

/** Abstract data visualization graphic for title slide */
export function illustrationHero(): string {
  return `<svg width="300" height="200" viewBox="0 0 300 200" fill="none">
    <rect x="20" y="120" width="30" height="60" rx="4" fill="rgba(34,197,94,0.3)"/>
    <rect x="60" y="80" width="30" height="100" rx="4" fill="rgba(34,197,94,0.5)"/>
    <rect x="100" y="100" width="30" height="80" rx="4" fill="rgba(59,130,246,0.4)"/>
    <rect x="140" y="60" width="30" height="120" rx="4" fill="rgba(59,130,246,0.6)"/>
    <rect x="180" y="90" width="30" height="90" rx="4" fill="rgba(168,85,247,0.4)"/>
    <rect x="220" y="40" width="30" height="140" rx="4" fill="rgba(168,85,247,0.6)"/>
    <polyline points="35,115 75,75 115,95 155,55 195,85 235,35"
      stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="35" cy="115" r="3" fill="white"/>
    <circle cx="75" cy="75" r="3" fill="white"/>
    <circle cx="115" cy="95" r="3" fill="white"/>
    <circle cx="155" cy="55" r="3" fill="white"/>
    <circle cx="195" cy="85" r="3" fill="white"/>
    <circle cx="235" cy="35" r="3" fill="white"/>
  </svg>`;
}

/** Chart-themed illustration for domain slides */
export function illustrationDomain(color: string): string {
  return `<svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <rect x="8" y="45" width="12" height="27" rx="3" fill="${color}" opacity="0.4"/>
    <rect x="24" y="30" width="12" height="42" rx="3" fill="${color}" opacity="0.6"/>
    <rect x="40" y="35" width="12" height="37" rx="3" fill="${color}" opacity="0.5"/>
    <rect x="56" y="15" width="12" height="57" rx="3" fill="${color}" opacity="0.8"/>
    <line x1="4" y1="72" x2="76" y2="72" stroke="${color}" stroke-width="1" opacity="0.3"/>
  </svg>`;
}

/** Warning-themed illustration for attention slide */
export function illustrationAttention(): string {
  return `<svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <path d="M40 12L72 68H8L40 12Z" stroke="rgba(239,68,68,0.5)" stroke-width="2" fill="rgba(239,68,68,0.1)"/>
    <line x1="40" y1="30" x2="40" y2="50" stroke="rgba(239,68,68,0.7)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="40" cy="58" r="2" fill="rgba(239,68,68,0.7)"/>
  </svg>`;
}

/** Target/goal illustration for closing slide */
export function illustrationGoal(): string {
  return `<svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="50" stroke="rgba(34,197,94,0.2)" stroke-width="2"/>
    <circle cx="60" cy="60" r="35" stroke="rgba(34,197,94,0.3)" stroke-width="2"/>
    <circle cx="60" cy="60" r="20" stroke="rgba(34,197,94,0.5)" stroke-width="2"/>
    <circle cx="60" cy="60" r="6" fill="rgba(34,197,94,0.8)"/>
    <line x1="20" y1="30" x2="55" y2="58" stroke="rgba(59,130,246,0.4)" stroke-width="1.5"/>
    <polygon points="55,58 50,50 58,54" fill="rgba(59,130,246,0.4)"/>
  </svg>`;
}
```

**Step 2: Commit**

```bash
git add src/lib/presentation/illustrations.ts
git commit -m "feat(presentation): add SVG illustrations for slide decoration"
```

---

## Task 4: Slide Navigation Engine (JavaScript)

**Files:**
- Create: `src/lib/presentation/engine.ts`

**Step 1: Create the engine module**

This returns a JavaScript string that handles keyboard navigation, animation triggers, fullscreen, and progress bar updates.

```typescript
// src/lib/presentation/engine.ts

/**
 * Returns the JavaScript string to embed in the HTML presentation.
 * Handles slide navigation, animations, fullscreen, and counter animations.
 */
export function getPresentationEngine(totalSlides: number): string {
  return `
    (function() {
      let current = 0;
      const total = ${totalSlides};
      const slides = document.querySelectorAll('.slide');
      const progressBar = document.getElementById('progress-bar');
      const counterEl = document.getElementById('slide-counter');

      function showSlide(index) {
        slides.forEach((slide, i) => {
          slide.classList.remove('active', 'prev');
          if (i === index) slide.classList.add('active');
          else if (i < index) slide.classList.add('prev');
        });
        if (progressBar) progressBar.style.width = ((index + 1) / total * 100) + '%';
        if (counterEl) counterEl.textContent = (index + 1) + ' / ' + total;

        // Trigger counter animations on active slide
        const activeSlide = slides[index];
        if (activeSlide) {
          activeSlide.querySelectorAll('[data-count-to]').forEach(el => {
            if (el.dataset.counted) return;
            el.dataset.counted = 'true';
            animateCounter(el, parseFloat(el.dataset.countTo), el.dataset.countSuffix || '');
          });

          // Trigger typewriter effect
          activeSlide.querySelectorAll('[data-typewriter]').forEach(el => {
            if (el.dataset.typed) return;
            el.dataset.typed = 'true';
            typewriter(el, el.dataset.typewriter);
          });
        }
      }

      function animateCounter(el, target, suffix) {
        const duration = 800;
        const start = performance.now();
        const isFloat = target % 1 !== 0;

        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const val = eased * target;
          el.textContent = (isFloat ? val.toFixed(1) : Math.round(val)) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }

      function typewriter(el, text) {
        el.textContent = '';
        el.style.visibility = 'visible';
        let i = 0;
        function tick() {
          if (i < text.length) {
            el.textContent += text[i];
            i++;
            setTimeout(tick, 25);
          }
        }
        tick();
      }

      function next() { if (current < total - 1) { current++; showSlide(current); } }
      function prev() { if (current > 0) { current--; showSlide(current); } }

      document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        else if (e.key === 'f' || e.key === 'F') {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen();
          else document.exitFullscreen();
        }
        else if (e.key === 'Escape' && document.fullscreenElement) {
          document.exitFullscreen();
        }
      });

      // Click navigation: left 30% = prev, right 70% = next
      document.addEventListener('click', function(e) {
        if (e.target.closest('.tooltip-wrap')) return;
        const x = e.clientX / window.innerWidth;
        if (x < 0.3) prev(); else next();
      });

      // Touch swipe support
      let touchStartX = 0;
      document.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; });
      document.addEventListener('touchend', function(e) {
        const diff = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(diff) > 50) { diff > 0 ? prev() : next(); }
      });

      // Initialize
      showSlide(0);
    })();
  `;
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit src/lib/presentation/engine.ts`

**Step 3: Commit**

```bash
git add src/lib/presentation/engine.ts
git commit -m "feat(presentation): add slide navigation engine with keyboard, click, and touch support"
```

---

## Task 5: Slide Content Generators

**Files:**
- Create: `src/lib/presentation/slides.ts`

**Step 1: Create the slides module**

Each function generates the inner HTML for one slide type. Uses the charts and illustrations modules.

```typescript
// src/lib/presentation/slides.ts

import { svgGauge, svgDonut, svgBarChart, svgSparkline } from "./charts";
import { illustrationHero, illustrationDomain, illustrationAttention, illustrationGoal } from "./illustrations";
import type { KPIStatus } from "@/lib/kpi-status";

// --- Types ---

export interface PresentationDomain {
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string | null;
}

export interface PresentationKPI {
  name: string;
  unit: string;
  direction: "higher_better" | "lower_better";
  actualValue: number | null;
  targetValue: number;
  achievementPct: number | null;
  status: KPIStatus;
  momDelta: number | null;       // month-over-month % change
  sparklineValues: number[];
  domainName: string;
}

export interface PresentationData {
  period: string;               // "Maret 2026"
  generatedDate: string;        // "10 Maret 2026"
  healthScore: number;          // 0-100
  healthDelta: number | null;
  totalKPIs: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  noDataCount: number;
  improved: number;
  declined: number;
  stable: number;
  avgAchievement: number | null;
  achievementDelta: number | null;
  executiveNarrative: string | null;
  domains: {
    domain: PresentationDomain;
    kpis: PresentationKPI[];
    narrative: string | null;
  }[];
  attentionKpis: (PresentationKPI & { reason: string })[];
}

// --- Helpers ---

const statusColor: Record<KPIStatus, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  "no-data": "#64748b",
};

const statusLabel: Record<KPIStatus, string> = {
  green: "On Track",
  yellow: "At Risk",
  red: "Off Track",
  "no-data": "No Data",
};

function badgeClass(status: KPIStatus): string {
  if (status === "green") return "badge badge-green";
  if (status === "yellow") return "badge badge-yellow";
  if (status === "red") return "badge badge-red";
  return "badge";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatVal(value: number | null, unit: string): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 100) / 100;
  if (unit === "%") return `${rounded}%`;
  if (unit === "Rp") {
    if (rounded >= 1e9) return `Rp ${(rounded / 1e9).toFixed(1)}M`;
    if (rounded >= 1e6) return `Rp ${(rounded / 1e6).toFixed(0)}jt`;
    return `Rp ${rounded.toLocaleString("id-ID")}`;
  }
  return `${rounded} ${unit}`;
}

// --- Slide generators ---

export function slideTitleHtml(data: PresentationData): string {
  return `<div class="slide" data-slide="title">
    <div class="flex-col flex-center gap-3 text-center" style="max-width:700px;">
      <div class="animate-in">${illustrationHero()}</div>
      <h1 class="title-huge animate-in animate-delay-1">Laporan KPI</h1>
      <h2 class="title-large animate-in animate-delay-2" style="color:var(--text-muted);">${escapeHtml(data.period)}</h2>
      <p class="text-small animate-in animate-delay-3">Digenerate ${escapeHtml(data.generatedDate)}</p>
    </div>
  </div>`;
}

export function slideExecutiveSummaryHtml(data: PresentationData): string {
  const gaugeColor = data.healthScore >= 80 ? "#22c55e" : data.healthScore >= 50 ? "#eab308" : "#ef4444";
  const deltaHtml = data.healthDelta !== null
    ? `<span style="font-size:1rem;color:${data.healthDelta >= 0 ? "var(--green)" : "var(--red)"};">${data.healthDelta >= 0 ? "+" : ""}${data.healthDelta}%</span>`
    : "";

  const donut = svgDonut({
    segments: [
      { value: data.greenCount, color: "#22c55e", label: "On Track" },
      { value: data.yellowCount, color: "#eab308", label: "At Risk" },
      { value: data.redCount, color: "#ef4444", label: "Off Track" },
      ...(data.noDataCount > 0 ? [{ value: data.noDataCount, color: "#64748b", label: "No Data" }] : []),
    ],
  });

  const narrativeHtml = data.executiveNarrative
    ? `<div class="card mt-3 animate-in animate-delay-5" style="max-width:100%;">
        <p class="text-body" data-typewriter="${escapeHtml(data.executiveNarrative)}" style="visibility:hidden;min-height:4rem;"></p>
      </div>`
    : "";

  return `<div class="slide" data-slide="executive">
    <div class="w-full" style="max-width:900px;">
      <h2 class="title-large mb-2 animate-in">Executive Summary</h2>
      <div class="grid-3 mt-2">
        <div class="card flex-col flex-center animate-in animate-delay-1">
          ${svgGauge({ value: data.healthScore, color: gaugeColor, label: "Health Score" })}
          <div class="mt-1 text-center">${deltaHtml}</div>
        </div>
        <div class="card flex-col flex-center animate-in animate-delay-2">
          ${donut}
        </div>
        <div class="card flex-col gap-1 animate-in animate-delay-3">
          <div style="font-size:0.75rem;color:var(--text-muted);">Pergerakan Status</div>
          <div style="display:flex;gap:1rem;align-items:baseline;">
            ${data.improved > 0 ? `<span style="font-size:1.5rem;font-weight:700;color:var(--green);">${data.improved}</span><span class="text-small">naik</span>` : ""}
            ${data.declined > 0 ? `<span style="font-size:1.5rem;font-weight:700;color:var(--red);">${data.declined}</span><span class="text-small">turun</span>` : ""}
            ${data.stable > 0 ? `<span style="font-size:1.5rem;font-weight:700;color:var(--text-muted);">${data.stable}</span><span class="text-small">tetap</span>` : ""}
          </div>
          <div style="margin-top:auto;padding-top:0.5rem;border-top:1px solid var(--card-border);">
            <div class="text-small">Rata-rata Pencapaian</div>
            <span class="number-huge" style="font-size:2rem;" data-count-to="${data.avgAchievement ?? 0}" data-count-suffix="%">0%</span>
          </div>
        </div>
      </div>
      ${narrativeHtml}
    </div>
  </div>`;
}

export function slideDomainHtml(domainData: {
  domain: PresentationDomain;
  kpis: PresentationKPI[];
  narrative: string | null;
}): string {
  const { domain, kpis, narrative } = domainData;
  const onTrack = kpis.filter((k) => k.status === "green").length;
  const offTrack = kpis.filter((k) => k.status === "red").length;

  const barChart = svgBarChart({
    items: kpis
      .filter((k) => k.achievementPct !== null)
      .map((k) => ({
        label: k.name,
        value: k.achievementPct!,
        maxValue: 150,
        color: statusColor[k.status],
        tooltip: `${k.name}: ${formatVal(k.actualValue, k.unit)} / ${formatVal(k.targetValue, k.unit)} (${k.achievementPct}%)`,
      })),
  });

  const tableRows = kpis
    .map((k) => {
      const deltaStr = k.momDelta !== null
        ? `<span style="color:${k.momDelta >= 0 ? "var(--green)" : "var(--red)"};">${k.momDelta >= 0 ? "+" : ""}${k.momDelta.toFixed(1)}%</span>`
        : "—";
      const sparkline = svgSparkline({ values: k.sparklineValues, color: statusColor[k.status] });
      return `<tr>
        <td>${escapeHtml(k.name)}</td>
        <td class="text-right">${formatVal(k.actualValue, k.unit)}</td>
        <td class="text-right" style="color:var(--text-muted);">${formatVal(k.targetValue, k.unit)}</td>
        <td class="text-right">${k.achievementPct !== null ? k.achievementPct + "%" : "—"}</td>
        <td><span class="${badgeClass(k.status)}">${statusLabel[k.status]}</span></td>
        <td class="text-right">${deltaStr}</td>
        <td>${sparkline}</td>
      </tr>`;
    })
    .join("");

  const narrativeHtml = narrative
    ? `<div class="card mt-2 animate-in animate-delay-5">
        <p class="text-body" data-typewriter="${escapeHtml(narrative)}" style="visibility:hidden;min-height:2rem;"></p>
      </div>`
    : "";

  return `<div class="slide" data-slide="domain-${domain.slug}">
    <div class="w-full" style="max-width:1000px;">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;" class="animate-in">
        <span style="width:16px;height:16px;border-radius:50%;background:${domain.color};display:inline-block;"></span>
        <h2 class="title-large">${escapeHtml(domain.name)}</h2>
        ${domain.description ? `<span class="text-small">— ${escapeHtml(domain.description)}</span>` : ""}
        <span class="text-small" style="margin-left:auto;">${kpis.length} KPI · ${onTrack} on track${offTrack > 0 ? ` · ${offTrack} off track` : ""}</span>
        ${illustrationDomain(domain.color)}
      </div>
      <div class="grid-2">
        <div class="animate-in animate-delay-1">${barChart}</div>
        <div class="animate-in animate-delay-2" style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr>
              <th>KPI</th><th class="text-right">Aktual</th><th class="text-right">Target</th>
              <th class="text-right">%</th><th>Status</th><th class="text-right">MoM</th><th>Trend</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
      ${narrativeHtml}
    </div>
  </div>`;
}

export function slideAttentionHtml(data: PresentationData): string {
  if (data.attentionKpis.length === 0) return "";

  const cards = data.attentionKpis
    .map((k, i) => {
      const color = k.status === "red" ? "var(--red)" : "var(--yellow)";
      return `<div class="card card-animate" style="border-left:3px solid ${color};animation-delay:${i * 0.1}s;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;">${escapeHtml(k.name)}</span>
          <span class="${badgeClass(k.status)}">${statusLabel[k.status]}</span>
        </div>
        <div class="text-small mt-1">
          Aktual: ${formatVal(k.actualValue, k.unit)} · Target: ${formatVal(k.targetValue, k.unit)} · ${escapeHtml(k.reason)}
        </div>
        ${k.momDelta !== null ? `<div style="font-size:0.875rem;margin-top:0.25rem;color:${k.momDelta >= 0 ? "var(--green)" : "var(--red)"};">MoM: ${k.momDelta >= 0 ? "+" : ""}${k.momDelta.toFixed(1)}%</div>` : ""}
      </div>`;
    })
    .join("");

  return `<div class="slide" data-slide="attention">
    <div class="w-full" style="max-width:800px;">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;" class="animate-in">
        ${illustrationAttention()}
        <div>
          <h2 class="title-large">Perlu Perhatian</h2>
          <p class="text-small">${data.attentionKpis.length} KPI memerlukan tindak lanjut</p>
        </div>
      </div>
      <div class="flex-col gap-1">${cards}</div>
    </div>
  </div>`;
}

export function slideClosingHtml(data: PresentationData): string {
  return `<div class="slide" data-slide="closing">
    <div class="flex-col flex-center gap-3 text-center" style="max-width:600px;">
      <div class="animate-in">${illustrationGoal()}</div>
      <h2 class="title-large animate-in animate-delay-1">Ringkasan</h2>
      <div class="grid-3 mt-2 w-full">
        <div class="card flex-col flex-center animate-in animate-delay-2">
          <span class="number-huge" style="font-size:2.5rem;" data-count-to="${data.totalKPIs}" data-count-suffix="">0</span>
          <span class="text-small">Total KPI</span>
        </div>
        <div class="card flex-col flex-center animate-in animate-delay-3">
          <span class="number-huge" style="font-size:2.5rem;" data-count-to="${data.healthScore}" data-count-suffix="%">0%</span>
          <span class="text-small">Health Score</span>
        </div>
        <div class="card flex-col flex-center animate-in animate-delay-4">
          <span class="number-huge" style="font-size:2.5rem;" data-count-to="${data.avgAchievement ?? 0}" data-count-suffix="%">0%</span>
          <span class="text-small">Rata-rata Pencapaian</span>
        </div>
      </div>
      <p class="text-small animate-in animate-delay-5 mt-2">Laporan KPI · ${escapeHtml(data.period)} · Digenerate ${escapeHtml(data.generatedDate)}</p>
    </div>
  </div>`;
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit src/lib/presentation/slides.ts`

**Step 3: Commit**

```bash
git add src/lib/presentation/slides.ts
git commit -m "feat(presentation): add slide content generators for all 5 slide types"
```

---

## Task 6: API Route — Presentation Generator

**Files:**
- Create: `src/app/api/report/presentation/route.ts`

**Step 1: Create the API route**

This is the main orchestrator. It fetches data, calls AI in parallel per domain, assembles the full HTML document, and returns it.

```typescript
// src/app/api/report/presentation/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAllDomains, getKPIsWithLatestEntry, getBatchPeriodComparison } from "@/lib/queries";
import { getAchievementPct, getKPIStatus } from "@/lib/kpi-status";
import { formatPeriodDate, formatValue, listLastNMonths } from "@/lib/period";
import { requireAuth, handleAIError } from "@/lib/ai/api-helpers";
import { getAIService, cleanAIOutput, AIServiceError } from "@/lib/ai";
import { getPresentationStyles } from "@/lib/presentation/styles";
import { getPresentationEngine } from "@/lib/presentation/engine";
import {
  slideTitleHtml,
  slideExecutiveSummaryHtml,
  slideDomainHtml,
  slideAttentionHtml,
  slideClosingHtml,
  type PresentationData,
  type PresentationKPI,
} from "@/lib/presentation/slides";

async function generateDomainNarrative(
  domainName: string,
  kpis: PresentationKPI[],
  period: string
): Promise<string | null> {
  try {
    const ai = getAIService();
    const kpiSummary = kpis
      .map(
        (k) =>
          `- ${k.name}: aktual ${formatVal(k.actualValue, k.unit)}, target ${formatVal(k.targetValue, k.unit)}, pencapaian ${k.achievementPct ?? "N/A"}%, status ${k.status}`
      )
      .join("\n");

    const prompt = `Kamu adalah analis KPI. Tulis insight singkat (2-3 kalimat) untuk domain "${domainName}" periode ${period}.

Data KPI:
${kpiSummary}

Instruksi:
- Langsung tulis insight, tanpa kalimat pembuka
- Fokus pada temuan utama dan implikasi
- Bahasa Indonesia, mudah dipahami eksekutif
- Jangan gunakan markdown formatting`;

    const result = await ai.generateText(prompt);
    return cleanAIOutput(result.text);
  } catch {
    return null;
  }
}

async function generateExecutiveNarrative(
  data: { healthScore: number; healthDelta: number | null; improved: number; declined: number; stable: number; avgAchievement: number | null },
  kpis: PresentationKPI[],
  period: string
): Promise<string | null> {
  try {
    const ai = getAIService();
    const kpiSummary = kpis
      .map(
        (k) =>
          `- ${k.name} [${k.domainName}]: pencapaian ${k.achievementPct ?? "N/A"}%, status ${k.status}`
      )
      .join("\n");

    const prompt = `Kamu adalah analis KPI senior. Tulis narasi ringkasan eksekutif (3 paragraf pendek, masing-masing 2-3 kalimat) untuk laporan KPI periode ${period}.

Data:
- Health Score: ${data.healthScore}%${data.healthDelta !== null ? ` (${data.healthDelta > 0 ? "+" : ""}${data.healthDelta}% dari bulan lalu)` : ""}
- Pergerakan: ${data.improved} naik, ${data.declined} turun, ${data.stable} tetap
- Rata-rata pencapaian: ${data.avgAchievement ?? "N/A"}%

KPI:
${kpiSummary}

Instruksi:
- Langsung tulis, tanpa kalimat pembuka
- Paragraf 1: Gambaran umum
- Paragraf 2: KPI yang memburuk
- Paragraf 3: Rekomendasi prioritas
- Bahasa Indonesia, untuk eksekutif non-teknis
- Jangan gunakan markdown formatting`;

    const result = await ai.generateText(prompt);
    return cleanAIOutput(result.text);
  } catch {
    return null;
  }
}

function formatVal(value: number | null, unit: string): string {
  if (value === null) return "—";
  return formatValue(value, unit);
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? listLastNMonths(1)[0]?.value;

  if (!period) {
    return NextResponse.json({ error: "Period is required" }, { status: 400 });
  }

  const periodLabel = formatPeriodDate(period, "MMMM yyyy");
  const generatedDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Fetch data
  const domains = await getAllDomains();
  const allKPIsWithEntries = await getKPIsWithLatestEntry(undefined, period);
  const kpiIds = allKPIsWithEntries.map(({ kpi }) => kpi.id);
  const comparisonMap = await getBatchPeriodComparison(kpiIds, period);

  // Compute global stats
  let totalGreen = 0, totalYellow = 0, totalRed = 0, totalNoData = 0;
  let improved = 0, declined = 0, stable = 0;
  let totalAchievement = 0, totalAchievementCount = 0;
  let prevGreen = 0, prevTotal = 0;
  let prevTotalAchievement = 0, prevAchievementCount = 0;

  const statusOrder: Record<string, number> = { green: 3, yellow: 2, red: 1, "no-data": 0 };

  // Build presentation KPIs
  const allPresentationKpis: PresentationKPI[] = allKPIsWithEntries.map(
    ({ kpi, latestEntry, effectiveTarget, sparklineEntries }) => {
      const status = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
      const ach = getAchievementPct(latestEntry?.value, effectiveTarget.target, kpi.direction);
      const comparison = comparisonMap.get(kpi.id);
      const prevEntry = comparison?.prevMonth ?? null;
      const domainName = domains.find((d) => d.id === kpi.domainId)?.name ?? "";

      if (status === "green") totalGreen++;
      else if (status === "yellow") totalYellow++;
      else if (status === "red") totalRed++;
      else totalNoData++;

      if (ach !== null) { totalAchievement += ach; totalAchievementCount++; }

      if (prevEntry) {
        prevTotal++;
        const prevStatus = getKPIStatus(prevEntry.value, kpi);
        if (prevStatus === "green") prevGreen++;
        const diff = statusOrder[status] - statusOrder[prevStatus];
        if (diff > 0) improved++;
        else if (diff < 0) declined++;
        else stable++;
        const prevAch = getAchievementPct(prevEntry.value, kpi.target, kpi.direction);
        if (prevAch !== null) { prevTotalAchievement += prevAch; prevAchievementCount++; }
      }

      const momDelta =
        latestEntry && prevEntry && prevEntry.value !== 0
          ? ((latestEntry.value - prevEntry.value) / prevEntry.value) * 100
          : null;

      return {
        name: kpi.name,
        unit: kpi.unit,
        direction: kpi.direction as "higher_better" | "lower_better",
        actualValue: latestEntry?.value ?? null,
        targetValue: effectiveTarget.target,
        achievementPct: ach,
        status,
        momDelta,
        sparklineValues: sparklineEntries.map((e) => e.value),
        domainName,
      };
    }
  );

  const total = allKPIsWithEntries.length;
  const healthScore = total > 0 ? Math.round((totalGreen / total) * 100) : 0;
  const prevHealthPct = prevTotal > 0 ? Math.round((prevGreen / prevTotal) * 100) : null;
  const healthDelta = prevHealthPct !== null ? healthScore - prevHealthPct : null;
  const avgAchievement = totalAchievementCount > 0 ? Math.round(totalAchievement / totalAchievementCount) : null;
  const prevAvgAchievement = prevAchievementCount > 0 ? Math.round(prevTotalAchievement / prevAchievementCount) : null;
  const achievementDelta = avgAchievement !== null && prevAvgAchievement !== null ? avgAchievement - prevAvgAchievement : null;

  // Build domain groups
  const domainGroups = domains
    .map((domain) => ({
      domain: {
        name: domain.name,
        slug: domain.slug,
        icon: domain.icon,
        color: domain.color,
        description: domain.description,
      },
      kpis: allPresentationKpis.filter((k) => k.domainName === domain.name),
    }))
    .filter(({ kpis }) => kpis.length > 0);

  // Build attention KPIs
  const attentionKpis = allPresentationKpis
    .filter((k) => k.status === "red" || (k.momDelta !== null && k.momDelta < -10))
    .map((k) => ({
      ...k,
      reason:
        k.status === "red"
          ? "Di bawah target"
          : `Turun ${Math.abs(k.momDelta!).toFixed(1)}% dari bulan lalu`,
    }));

  // Generate AI narratives in parallel
  const [executiveNarrative, ...domainNarratives] = await Promise.all([
    generateExecutiveNarrative(
      { healthScore, healthDelta, improved, declined, stable, avgAchievement },
      allPresentationKpis,
      periodLabel
    ),
    ...domainGroups.map(({ domain, kpis }) =>
      generateDomainNarrative(domain.name, kpis, periodLabel)
    ),
  ]);

  // Assemble presentation data
  const presentationData: PresentationData = {
    period: periodLabel,
    generatedDate,
    healthScore,
    healthDelta,
    totalKPIs: total,
    greenCount: totalGreen,
    yellowCount: totalYellow,
    redCount: totalRed,
    noDataCount: totalNoData,
    improved,
    declined,
    stable,
    avgAchievement,
    achievementDelta,
    executiveNarrative,
    domains: domainGroups.map((dg, i) => ({
      ...dg,
      narrative: domainNarratives[i] ?? null,
    })),
    attentionKpis,
  };

  // Build slides
  const slidesHtml: string[] = [
    slideTitleHtml(presentationData),
    slideExecutiveSummaryHtml(presentationData),
    ...presentationData.domains.map((d) => slideDomainHtml(d)),
  ];

  const attentionHtml = slideAttentionHtml(presentationData);
  if (attentionHtml) slidesHtml.push(attentionHtml);

  slidesHtml.push(slideClosingHtml(presentationData));

  const totalSlides = slidesHtml.length;

  // Assemble full HTML
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Presentasi KPI — ${escapeAttr(periodLabel)}</title>
  <style>${getPresentationStyles()}</style>
</head>
<body>
  <div class="slides-wrapper">
    ${slidesHtml.join("\n")}
  </div>
  <div class="progress-bar" id="progress-bar"></div>
  <div class="slide-counter" id="slide-counter">1 / ${totalSlides}</div>
  <div class="nav-hint">← → Navigate · F Fullscreen</div>
  <script>${getPresentationEngine(totalSlides)}</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit src/app/api/report/presentation/route.ts`

**Step 3: Test manually**

Open browser: `http://localhost:3000/api/report/presentation?period=2026-03-01`

Expected: Full HTML presentation opens with animated slides.

**Step 4: Commit**

```bash
git add src/app/api/report/presentation/route.ts
git commit -m "feat(presentation): add API route for HTML presentation generation"
```

---

## Task 7: Add "Presentasi" Button to Executive Report

**Files:**
- Modify: `src/app/report/all/page.tsx:361-365` (controls section)

**Step 1: Add the presentation button**

In `src/app/report/all/page.tsx`, find the controls div at the bottom and add a "Presentasi" link next to the existing PrintButton.

Locate this section (~line 361):
```tsx
<div className="mt-8 flex gap-3 items-center print:hidden">
  <PrintButton />
  <ReportPeriodSelector months={months} selectedPeriod={selectedPeriod ?? ""} />
  <a href="/" className="px-4 py-2 border text-sm rounded hover:bg-muted transition-colors">&larr; Overview</a>
</div>
```

Change it to:
```tsx
<div className="mt-8 flex gap-3 items-center print:hidden">
  <PrintButton />
  <a
    href={`/api/report/presentation?period=${selectedPeriod ?? ""}`}
    target="_blank"
    rel="noopener noreferrer"
    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
  >
    Presentasi
  </a>
  <ReportPeriodSelector months={months} selectedPeriod={selectedPeriod ?? ""} />
  <a href="/" className="px-4 py-2 border text-sm rounded hover:bg-muted transition-colors">&larr; Overview</a>
</div>
```

**Step 2: Verify the page renders**

Open: `http://localhost:3000/report/all`
Expected: "Presentasi" button visible next to "Cetak / Simpan PDF"

**Step 3: Test end-to-end**

1. Click "Presentasi" button on report page
2. New tab opens with full HTML presentation
3. Press arrow keys to navigate
4. Press F for fullscreen
5. Press Ctrl+P to test print layout

**Step 4: Commit**

```bash
git add src/app/report/all/page.tsx
git commit -m "feat(presentation): add Presentasi button to executive report page"
```

---

## Task 8: Final Verification

**Step 1: Run type check**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 2: Run linter**

Run: `npx next lint`

Expected: No errors in new files

**Step 3: Test full flow**

1. Login to app
2. Navigate to `/report/all`
3. Select a period with data
4. Click "Presentasi"
5. Verify all slides render correctly:
   - Title slide with illustration
   - Executive summary with gauge, donut, AI narrative
   - Each domain slide with bar chart, table, sparklines, AI insight
   - Attention slide with problem KPIs
   - Closing slide with animated counters
6. Test keyboard navigation (arrows, F, Escape)
7. Test print (Ctrl+P) — white background, no animations

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(presentation): complete KPI report presentation generator"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | CSS styles + animations + print | `src/lib/presentation/styles.ts` |
| 2 | SVG chart generators | `src/lib/presentation/charts.ts` |
| 3 | SVG illustrations | `src/lib/presentation/illustrations.ts` |
| 4 | Slide navigation JS engine | `src/lib/presentation/engine.ts` |
| 5 | Slide content generators | `src/lib/presentation/slides.ts` |
| 6 | API route (orchestrator) | `src/app/api/report/presentation/route.ts` |
| 7 | Button on report page | `src/app/report/all/page.tsx` |
| 8 | Final verification | — |
