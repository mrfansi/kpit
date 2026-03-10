/** Sanitize a CSS color value to prevent injection */
function sanitizeColor(color: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color)) return color;
  if (/^[a-zA-Z]+$/.test(color)) return color;
  return "#64748b";
}

/**
 * Gauge chart — semicircle showing a percentage value.
 */
export function svgGauge(opts: {
  value: number;
  size?: number;
  color?: string;
  label?: string;
}): string {
  const { value, size = 200, color = "#22c55e", label } = opts;
  const safeColor = sanitizeColor(color);
  const r = size * 0.4;
  const circumference = Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2 + 10;

  return `<svg width="${size}" height="${size * 0.65}" viewBox="0 0 ${size} ${size * 0.65}" role="img" aria-label="${label ? label + ': ' : ''}${value}%">
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
      fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="12" stroke-linecap="round"/>
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
      fill="none" stroke="${safeColor}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      style="--donut-value: ${value};"
      class="donut-animate" />
    <text x="${cx}" y="${cy - 15}" text-anchor="middle" fill="${safeColor}"
      font-size="${size * 0.18}" font-weight="900">${value}%</text>
    ${label ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#94a3b8"
      font-size="${size * 0.07}">${label}</text>` : ""}
  </svg>`;
}

/**
 * Donut chart — shows distribution of categories.
 */
export function svgDonut(opts: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}): string {
  const { segments, size = 180 } = opts;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return `<svg width="${size}" height="${size}" role="img" aria-label="Tidak ada data"></svg>`;

  const r = 15.9155;
  let cumulativeOffset = 25;
  const ariaDesc = segments.filter((s) => s.value > 0).map((s) => `${s.label}: ${s.value}`).join(", ");
  const paths = segments.map((seg) => {
    const pct = (seg.value / total) * 100;
    const safeSegColor = sanitizeColor(seg.color);
    const path = `<circle cx="50%" cy="50%" r="${r}" fill="none"
      stroke="${safeSegColor}" stroke-width="8"
      stroke-dasharray="${pct} ${100 - pct}"
      stroke-dashoffset="-${cumulativeOffset}"
      style="--donut-value: ${pct};"
      class="donut-animate" />`;
    cumulativeOffset += pct;
    return path;
  });

  const legend = segments
    .filter((s) => s.value > 0)
    .map(
      (seg) =>
        `<div class="tooltip-wrap" style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:0.75rem;">
        <span style="width:8px;height:8px;border-radius:50%;background:${sanitizeColor(seg.color)};display:inline-block;"></span>
        ${seg.value} ${seg.label}
        <span class="tooltip">${seg.label}: ${seg.value} (${total > 0 ? Math.round((seg.value / total) * 100) : 0}%)</span>
      </div>`
    )
    .join("");

  return `<div style="text-align:center;">
    <svg width="${size}" height="${size}" viewBox="0 0 42 42" role="img" aria-label="Distribusi status: ${ariaDesc}">
      <circle cx="50%" cy="50%" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8"/>
      ${paths.join("\n")}
      <text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="white" font-size="6" font-weight="700">${total}</text>
    </svg>
    <div style="margin-top:0.5rem;">${legend}</div>
  </div>`;
}

/**
 * Horizontal bar chart — one bar per KPI showing achievement %.
 */
export function svgBarChart(opts: {
  items: { label: string; value: number; maxValue?: number; color: string; tooltip?: string }[];
}): string {
  const { items } = opts;
  const maxVal = Math.max(...items.map((i) => i.maxValue ?? i.value), 100);

  const rows = items
    .map((item, i) => {
      const widthPct = Math.min((item.value / maxVal) * 100, 100);
      const safeBarColor = sanitizeColor(item.color);
      return `<div class="tooltip-wrap" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
        <span style="width:140px;font-size:0.75rem;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.label}">${item.label}</span>
        <div style="flex:1;height:24px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
          <div class="bar-animate" style="height:100%;background:${safeBarColor};border-radius:4px;--bar-width:${widthPct}%;animation-delay:${i * 0.1}s;display:flex;align-items:center;padding-left:8px;">
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
 */
export function svgSparkline(opts: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}): string {
  const { values, width = 120, height = 32, color = "#22c55e" } = opts;
  const safeSparkColor = sanitizeColor(color);
  if (values.length < 2) return `<svg width="${width}" height="${height}" role="img" aria-label="Tidak cukup data untuk tren"></svg>`;

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

  const pathLength = values.length * 15;

  const trendDir = values[values.length - 1] >= values[0] ? "naik" : "turun";
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tren ${trendDir}: ${values.length} periode">
    <polyline points="${points}" fill="none" stroke="${safeSparkColor}" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      style="--line-length:${pathLength};" class="sparkline-animate"/>
  </svg>`;
}
