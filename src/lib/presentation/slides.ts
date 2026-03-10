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
  momDelta: number | null;
  sparklineValues: number[];
  domainName: string;
}

export interface PresentationData {
  period: string;
  generatedDate: string;
  healthScore: number;
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

function sanitizeColor(color: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color)) return color;
  if (/^[a-zA-Z]+$/.test(color)) return color;
  return "#64748b";
}

function formatVal(value: number | null, unit: string): string {
  if (value === null) return "\u2014";
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
  return `<div class="slide" data-slide="title" role="region" aria-label="Judul Presentasi">
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

  return `<div class="slide" data-slide="executive" role="region" aria-label="Ringkasan Eksekutif">
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
        : "\u2014";
      const sparkline = svgSparkline({ values: k.sparklineValues, color: statusColor[k.status] });
      return `<tr>
        <td>${escapeHtml(k.name)}</td>
        <td class="text-right">${formatVal(k.actualValue, k.unit)}</td>
        <td class="text-right" style="color:var(--text-muted);">${formatVal(k.targetValue, k.unit)}</td>
        <td class="text-right">${k.achievementPct !== null ? k.achievementPct + "%" : "\u2014"}</td>
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

  const safeDomainColor = sanitizeColor(domain.color);

  return `<div class="slide" data-slide="domain-${domain.slug}" role="region" aria-label="Domain: ${escapeHtml(domain.name)}">
    <div class="w-full" style="max-width:1000px;">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;" class="animate-in">
        <span style="width:16px;height:16px;border-radius:50%;background:${safeDomainColor};display:inline-block;"></span>
        <h2 class="title-large">${escapeHtml(domain.name)}</h2>
        ${domain.description ? `<span class="text-small">\u2014 ${escapeHtml(domain.description)}</span>` : ""}
        <span class="text-small" style="margin-left:auto;">${kpis.length} KPI \u00b7 ${onTrack} on track${offTrack > 0 ? ` \u00b7 ${offTrack} off track` : ""}</span>
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
          Aktual: ${formatVal(k.actualValue, k.unit)} \u00b7 Target: ${formatVal(k.targetValue, k.unit)} \u00b7 ${escapeHtml(k.reason)}
        </div>
        ${k.momDelta !== null ? `<div style="font-size:0.875rem;margin-top:0.25rem;color:${k.momDelta >= 0 ? "var(--green)" : "var(--red)"};">MoM: ${k.momDelta >= 0 ? "+" : ""}${k.momDelta.toFixed(1)}%</div>` : ""}
      </div>`;
    })
    .join("");

  return `<div class="slide" data-slide="attention" role="region" aria-label="KPI Perlu Perhatian">
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
  return `<div class="slide" data-slide="closing" role="region" aria-label="Ringkasan Penutup">
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
      <p class="text-small animate-in animate-delay-5 mt-2">Laporan KPI \u00b7 ${escapeHtml(data.period)} \u00b7 Digenerate ${escapeHtml(data.generatedDate)}</p>
    </div>
  </div>`;
}
