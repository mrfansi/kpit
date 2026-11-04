import { DEFAULT_BRAND_STYLE, type BrandStyle } from "./brand";

export function getPresentationStyles(style: BrandStyle = DEFAULT_BRAND_STYLE): string {
  const fonts = [...new Set([style.fonts.heading, style.fonts.body])];
  const fontQuery = fonts.map((font) => `family=${font.replace(/ /g, "+")}:wght@400;600;700;900`).join("&");
  const defaultSurface = style.colors.background === DEFAULT_BRAND_STYLE.colors.background && style.colors.surface === DEFAULT_BRAND_STYLE.colors.surface;
  const radius = { none: "0", small: ".375rem", medium: ".75rem", large: "1rem" }[style.radius];
  return `
    @import url('https://fonts.googleapis.com/css2?${fontQuery}&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      color-scheme: ${style.mode};
      --bg-start: ${style.colors.background};
      --bg-end: ${style.colors.backgroundEnd};
      --text: ${style.colors.text};
      --text-muted: ${style.colors.mutedText};
      --card-bg: ${defaultSurface ? "rgba(255,255,255,0.08)" : style.colors.surface};
      --card-border: ${style.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"};
      --primary: ${style.colors.primary};
      --accent: ${style.colors.accent};
      --radius: ${radius};
      --font-heading: '${style.fonts.heading}', system-ui, sans-serif;
      --font-body: '${style.fonts.body}', system-ui, sans-serif;
      --title-case: ${style.titleCase === "uppercase" ? "uppercase" : "none"};
      --green: #22c55e;
      --yellow: #eab308;
      --red: #ef4444;
      --blue: var(--primary);
    }

    html, body {
      width: 100%; height: 100%; overflow: hidden;
      font-family: var(--font-body);
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
    h1, h2, h3, .title-huge, .title-large, .title-medium { font-family: var(--font-heading); text-transform: var(--title-case); }
    .brand-footer { position: fixed; bottom: 2.5rem; left: 2rem; right: 2rem; text-align: center; font-size: .75rem; color: var(--text-muted); z-index: 95; overflow-wrap: anywhere; pointer-events: none; }
    .title-huge { font-size: 3rem; font-weight: 900; line-height: 1.1; }
    .title-large { font-size: 2rem; font-weight: 700; }
    .title-medium { font-size: 1.5rem; font-weight: 600; }
    .text-body { font-size: 1rem; line-height: 1.6; color: var(--text-muted); }
    .text-small { font-size: 0.875rem; color: var(--text-muted); }
    .number-huge {
      font-size: 4rem; font-weight: 900;
      background: linear-gradient(135deg, var(--accent), var(--primary));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Cards */
    .card {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: var(--radius); padding: 1.5rem;
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
      background: var(--bg-end); border: 1px solid var(--card-border); border-radius: var(--radius);
      padding: 0.5rem 0.75rem; font-size: 0.75rem; white-space: nowrap;
      opacity: 0; pointer-events: none; transition: opacity 0.2s;
      z-index: 100;
    }
    .tooltip-wrap:hover .tooltip { opacity: 1; }

    /* Progress bar at bottom */
    .progress-bar {
      position: fixed; bottom: 0; left: 0; height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--primary));
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
    @keyframes drawLine {
      from { stroke-dashoffset: var(--line-length, 1000); }
      to { stroke-dashoffset: 0; }
    }
    @keyframes growBar {
      from { width: 0%; }
      to { width: var(--bar-width); }
    }
    @keyframes fillDonut {
      from { stroke-dasharray: 0 100; }
      to { stroke-dasharray: var(--donut-value) 100; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
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

    /* Responsive breakpoints */
    @media (max-width: 1024px) {
      .slide { padding: 3rem 3rem; }
      .title-huge { font-size: 2.25rem; }
      .number-huge { font-size: 3rem; }
      .grid-3 { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 768px) {
      .slide { padding: 2rem 1.5rem; }
      .title-huge { font-size: 1.75rem; }
      .title-large { font-size: 1.5rem; }
      .number-huge { font-size: 2.5rem; }
      .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
      .data-table { font-size: 0.75rem; }
      .data-table th, .data-table td { padding: 0.375rem 0.5rem; }
      .nav-hint { display: none; }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        animation-delay: 0ms !important;
      }
      .animate-delay-1, .animate-delay-2, .animate-delay-3,
      .animate-delay-4, .animate-delay-5, .animate-delay-6 { opacity: 1; }
      .bar-animate { width: var(--bar-width) !important; }
      .sparkline-animate { stroke-dashoffset: 0 !important; }
      .donut-animate { stroke-dasharray: var(--donut-value) 100 !important; }
      .card-animate { opacity: 1 !important; }
    }

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
      .number-huge { -webkit-text-fill-color: #0f172a; color: #0f172a; background: none; -webkit-background-clip: initial; background-clip: initial; }
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
