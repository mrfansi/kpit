import type { ComputedReportValue, MonthlyReportBundle, ObservationState } from "./monthly-report-types";
import { REPORT_DIVISIONS } from "./monthly-report-types";
import { getPresentationStyles } from "./presentation/styles";
import { getPresentationEngine } from "./presentation/engine";

export type MonthlyReportFormat = "full" | "brief" | "presentation";

const label = (state: ObservationState, value: number | null, unit = "") =>
  state === "untracked" ? "belum dilacak" : state === "missing" || value === null
    ? "belum diberikan" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
const text = (value: string) => value.trim() || "belum diberikan";
const html = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const cell = (value: string | number) => html(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const md = (value: string) => html(value).replace(/\\/g, "\\\\").replace(/([*_`[\]])/g, "\\$1");
const source = (value: string) => `Sumber: ${text(value)}`;
const computed = (value: ComputedReportValue, unit: string) => `${label(value.state, value.value, unit)} (target: ${label(value.target === null ? value.state : "provided", value.target, unit)}; ${source(value.source)}; target: ${source(value.targetSource)}; perhitungan: ${text(value.calculation)})`;

function metricRows(bundle: MonthlyReportBundle) {
  return bundle.content.metrics.map((metric) => ({ metric, result: bundle.metrics.find((row) => row.kpiId === metric.kpiId) }));
}
function allCurrentTargetsMeasured(bundle: MonthlyReportBundle) {
  return bundle.content.metrics.length > 0 && bundle.content.metrics.every((metric) => {
    const current = bundle.metrics.find((row) => row.kpiId === metric.kpiId)?.current;
    return current?.state === "provided" && current.value !== null && current.target !== null;
  });
}
function currentMonth(bundle: MonthlyReportBundle) { return bundle.period.slice(0, 7); }
function previousMonth(bundle: MonthlyReportBundle) {
  const [year, month] = bundle.period.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}
function reconciliationLines(bundle: MonthlyReportBundle) {
  return bundle.reconciliations.map((item) => `${item.metricKey}: ${item.state === "matched" ? "cocok" : item.state === "conflict" ? "berbeda" : "menunggu divisi terkait"}; ${text(item.detail)}. ${item.peers.map((peer) => `${peer.domainName}: ${peer.value === null ? "belum diberikan" : label("provided", peer.value, peer.unit)} (${source(peer.source)})`).join("; ")}`);
}
function statementRows(bundle: MonthlyReportBundle) {
  return ([
    ["Laba rugi", bundle.content.finance.incomeStatement],
    ["Arus kas", bundle.content.finance.cashFlow],
    ["Neraca", bundle.content.finance.balanceSheet],
  ] as const);
}

export function renderMonthlyReportMarkdown(bundle: MonthlyReportBundle, format: MonthlyReportFormat): string {
  const c = bundle.content;
  const lines: string[] = [
    `# Laporan bulanan ${md(c.division ? REPORT_DIVISIONS[c.division] : bundle.domain.name)} — ${bundle.period}`,
    `Domain: ${md(bundle.domain.name)} | Revisi: ${bundle.revision} | ${bundle.ready ? "Siap dipresentasikan" : "Draft — belum siap dipresentasikan"}`,
    `Alokasi inti: 10–15 menit. Lampiran tidak termasuk slide inti.`, "",
  ];
  if (bundle.questions.length) lines.push("## Klarifikasi yang dibutuhkan", ...bundle.questions.map((q) => `- ${md(q.question)}`), "");
  lines.push("## 1. Ringkasan eksekutif", ...c.summary.map((point) => `- ${md(point)}`), `- Hasil paling tidak berjalan baik: ${md(text(c.worstOutcome))}`, md(source(c.narrativeSource)), "");
  lines.push("## 2. KPI vs target", `Periode aktual: ${currentMonth(bundle)}. KPI konsisten lintas bulan; perubahan daftar: ${md(text(c.kpiSetChangeNote))}.`, "");
  for (const { metric, result } of metricRows(bundle)) {
    lines.push(`### ${md(metric.name)} (${md(metric.unit)})`, `Definisi: ${md(text(metric.definition))}; agregasi: ${md(metric.aggregation ?? "belum ditetapkan")}; ${md(text(metric.aggregationNote))}`);
    if (result) lines.push(`- Aktual vs target: ${md(computed(result.current, metric.unit))}${result.missedTarget ? " — target meleset" : ""}`);
    else lines.push("- Aktual vs target: belum dihitung");
  }
  lines.push("", "## 3. Tren MoM dan YTD", `Bulan lalu: ${previousMonth(bundle)}; YTD: Januari–${currentMonth(bundle)}.`, "");
  for (const { metric, result } of metricRows(bundle)) {
    if (!result) continue;
    lines.push(`- **${md(metric.name)}** — sebelumnya: ${md(computed(result.previous, metric.unit))}; sekarang: ${md(computed(result.current, metric.unit))}; MoM: ${result.momPercent === null ? "tidak dapat dihitung" : `${result.momPercent.toFixed(2)}% (dari aktual ${previousMonth(bundle)} dan ${currentMonth(bundle)}; ${md(source(result.previous.source))}; ${md(source(result.current.source))})`}; YTD: ${md(computed(result.ytd, metric.unit))}`);
  }
  if (c.division === "finance") {
    for (const [title, statement] of statementRows(bundle)) {
      lines.push("", `### ${title} — ${currentMonth(bundle)}`, ...statement.rows.map((row) => `- ${md(row.label)}: ${md(label(row.state, row.value, statement.unit))}; ${md(source(row.source))}`));
    }
  }
  lines.push("", "## 4. Penyebab deviasi dan bukti");
  const misses = metricRows(bundle).filter(({ result }) => result?.missedTarget);
  lines.push(...(misses.length ? misses.map(({ metric }) => `- ${md(metric.name)}: ${md(text(metric.deviationCause))}; bukti: ${md(text(metric.deviationEvidence))}; ${md(source(c.narrativeSource))}`) : [allCurrentTargetsMeasured(bundle) ? "- Semua KPI terukur memenuhi target." : "- Tidak dapat dinilai; metrik belum dilacak atau belum lengkap."]));
  lines.push("", "## 5. Isu, risiko, dan eskalasi", ...(c.risks.length ? c.risks.map((risk) => `- ${md(risk.issue)}; dampak: ${md(risk.impact)}; perlu turun tangan: ${md(risk.escalationOwner)}`) : [`- ${c.risksReviewed ? "Tidak ada risiko yang dilaporkan." : "Risiko belum ditinjau."}`]), `- ${md(source(c.narrativeSource))}`);
  lines.push("", "## 6. Rencana bulan depan", ...c.actions.map((action) => `- ${md(action.action)}; PIC: ${md(action.pic)}; tenggat: ${md(action.deadline)}`), `- ${md(source(c.narrativeSource))}`);
  if (c.decisions.length || !c.decisionsReviewed) lines.push("", "## 7. Keputusan C-level", ...(c.decisions.length ? c.decisions.map((decision) => `- ${md(decision.request)}; pilihan: ${md(decision.options)}; dampak: ${md(decision.impact)}`) : ["- Belum dikonfirmasi apakah keputusan diperlukan."]), `- ${md(source(c.narrativeSource))}`);
  lines.push("", "## Rekonsiliasi lintas divisi", ...(bundle.reconciliations.length ? reconciliationLines(bundle).map((entry) => `- ${md(entry)}`) : ["- Tidak ada metrik bersama yang dideklarasikan."]));
  if (c.aiNotes.trim()) lines.push("", "## Catatan presenter (draft bantuan AI; bukan sumber fakta)", md(c.aiNotes), md(source(c.narrativeSource)), ...metricRows(bundle).map(({ metric, result }) => `- ${md(metric.name)}: ${md(source(result?.current.source ?? ""))}; target: ${md(source(result?.current.targetSource ?? ""))}`));
  if (format !== "brief") {
    lines.push("", "## Lampiran — tidak termasuk slide inti", "### Riwayat bulanan dan data mentah");
    for (const metric of c.metrics) {
      lines.push(`#### ${md(metric.name)}`, "| Bulan | Aktual | Target | Sumber aktual | Sumber target | Pembilang | Penyebut |", "| --- | --- | --- | --- | --- | --- | --- |");
      for (const row of metric.observations) lines.push(`| ${cell(row.month)} | ${cell(label(row.state, row.actual, metric.unit))} | ${cell(label(row.target === null ? row.state : "provided", row.target, metric.unit))} | ${cell(text(row.source))} | ${cell(text(row.targetSource))} | ${cell(row.numerator ?? "—")} | ${cell(row.denominator ?? "—")} |`);
    }
    lines.push("", "### Breakdown channel", ...c.channelBreakdowns.map((row) => `- ${md(row.channel)} — ${md(row.metric)}: ${md(label(row.state, row.value, row.unit))}; ${md(source(row.source))}`), "", "### Aktivitas", ...c.activities.map((activity) => `- ${md(activity)}`), md(source(c.narrativeSource)));
    for (const appendix of c.appendices) lines.push("", `### ${md(appendix.title)}`, md(appendix.content), md(source(appendix.source)));
  } else lines.push("", "Lampiran data mentah, channel, dan aktivitas tersedia pada ekspor lengkap.");
  return lines.join("\n").trimEnd() + "\n";
}

function items(values: string[]) { return `<ul class="memo-list">${values.map((value) => `<li>${html(value)}</li>`).join("")}</ul>`; }
function table(headers: string[], rows: string[][]) {
  return `<div class="memo-table-scroll"><table class="data-table"><thead><tr>${headers.map((value) => `<th scope="col">${html(value)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${html(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function slide(key: string, title: string, body: string) {
  return `<section class="slide memo-slide" data-slide="${key}" role="region" aria-label="${html(title)}"><div class="memo-inner"><p class="text-small">Laporan bulanan divisi · 10–15 menit untuk seluruh slide inti</p><h1 class="title-large">${html(title)}</h1>${body}</div></section>`;
}
function statementSlide(title: string, statement: MonthlyReportBundle["content"]["finance"]["incomeStatement"]) {
  return slide("finance", title, table(["Pos", "Aktual", "Sumber"], statement.rows.map((row) => [row.label, label(row.state, row.value, statement.unit), text(row.source)])));
}

export function renderMonthlyReportPresentation(bundle: MonthlyReportBundle): string {
  const c = bundle.content;
  const rows = metricRows(bundle);
  const kpiTable = table(["KPI / definisi", "Aktual", "Target", "Sumber dan perhitungan"], rows.map(({ metric, result }) => [metric.name + ` — ${metric.definition}`, result ? label(result.current.state, result.current.value, metric.unit) : "belum diberikan", result ? label(result.current.target === null ? result.current.state : "provided", result.current.target, metric.unit) : "belum diberikan", result ? `${source(result.current.source)}; target: ${source(result.current.targetSource)}; ${result.current.calculation}` : "belum dihitung"]));
  const trendTable = table(["KPI", `Bulan lalu (${previousMonth(bundle)})`, `Bulan ini (${currentMonth(bundle)})`, "MoM", "YTD Januari–bulan ini"], rows.map(({ metric, result }) => [metric.name, result ? computed(result.previous, metric.unit) : "belum dihitung", result ? computed(result.current, metric.unit) : "belum dihitung", result?.momPercent === null || !result ? "tidak dapat dihitung" : `${result.momPercent.toFixed(2)}% (${source(result.previous.source)}; ${source(result.current.source)}; perubahan relatif)`, result ? computed(result.ytd, metric.unit) : "belum dihitung"]));
  const misses = rows.filter(({ result }) => result?.missedTarget);
  const deviation = items(misses.length ? misses.map(({ metric }) => `${metric.name}: ${text(metric.deviationCause)}; bukti: ${text(metric.deviationEvidence)}; ${source(c.narrativeSource)}`) : [allCurrentTargetsMeasured(bundle) ? "Semua KPI terukur memenuhi target." : "Tidak dapat dinilai; metrik belum dilacak atau belum lengkap."]);
  const issues = items(c.risks.length ? c.risks.map((risk) => `${risk.issue}; dampak: ${risk.impact}; eskalasi: ${risk.escalationOwner}; ${source(c.narrativeSource)}`) : [c.risksReviewed ? "Tidak ada risiko yang dilaporkan." : "Risiko belum ditinjau."]);
  const actions = table(["Aksi bulan depan", "PIC", "Tenggat / sumber"], c.actions.map((action) => [action.action, action.pic, `${action.deadline}; ${source(c.narrativeSource)}`]));
  const decision = c.decisions.length ? table(["Keputusan diminta", "Pilihan", "Dampak / sumber"], c.decisions.map((item) => [item.request, item.options, `${item.impact}; ${source(c.narrativeSource)}`])) : "";
  const reconciliation = `<h2 class="title-medium">Rekonsiliasi lintas divisi</h2>${items(reconciliationLines(bundle).length ? reconciliationLines(bundle) : ["Tidak ada metrik bersama yang dideklarasikan."])}`;
  const core: string[] = [slide("summary", `${c.division ? REPORT_DIVISIONS[c.division] : bundle.domain.name} — Ringkasan ${currentMonth(bundle)}`, `${items([...c.summary, `Hasil paling tidak berjalan baik: ${c.worstOutcome}`])}<p class="text-small">${html(source(c.narrativeSource))}</p>`), slide("kpi", "KPI vs target", `<p class="text-small">Daftar KPI bulanan tetap. Perubahan daftar: ${html(text(c.kpiSetChangeNote))}</p>${kpiTable}`)];
  if (c.division === "finance") core.push(statementSlide("Laba rugi", c.finance.incomeStatement), statementSlide("Arus kas", c.finance.cashFlow), statementSlide("Neraca", c.finance.balanceSheet));
  core.push(slide("trend", "Tren MoM dan YTD", trendTable));
  if (c.division === "hr_partnership") {
    core.push(slide("deviation-issues", "Deviasi, bukti, isu dan eskalasi", `<h2 class="title-medium">Penyebab deviasi</h2>${deviation}<h2 class="title-medium">Isu dan risiko</h2>${issues}`));
    core.push(slide("plan-decisions", "Rencana bulan depan dan keputusan", `${actions}${decision ? `<h2 class="title-medium">Keputusan C-level</h2>${decision}` : ""}${reconciliation}`));
  } else {
    core.push(slide("deviation", "Penyebab deviasi dan bukti", deviation), slide("risks", "Isu, risiko, dan eskalasi", issues), slide("actions", "Rencana bulan depan", `${actions}${reconciliation}`));
    if (decision) core.push(slide("decisions", "Keputusan C-level", decision));
  }
  const appendix = [
    ...c.metrics.map((metric) => `<section class="memo-appendix-page"><h2>${html(metric.name)} — riwayat bulanan</h2>${table(["Bulan", "Aktual", "Target", "Sumber aktual", "Sumber target", "Pembilang", "Penyebut"], metric.observations.map((row) => [row.month, label(row.state, row.actual, metric.unit), label(row.target === null ? row.state : "provided", row.target, metric.unit), text(row.source), text(row.targetSource), String(row.numerator ?? "—"), String(row.denominator ?? "—")]))}</section>`),
    `<section class="memo-appendix-page"><h2>Breakdown channel</h2>${table(["Channel", "Metrik", "Nilai", "Sumber"], c.channelBreakdowns.map((row) => [row.channel, row.metric, label(row.state, row.value, row.unit), text(row.source)]))}<h2>Aktivitas</h2>${items(c.activities)}<p class="text-small">${html(source(c.narrativeSource))}</p></section>`,
    ...c.appendices.map((item) => `<section class="memo-appendix-page"><h2>${html(item.title)}</h2><p class="memo-pre">${html(item.content)}</p><p>${html(source(item.source))}</p></section>`),
  ].join("");
  const notes = c.aiNotes.trim() ? `<aside class="memo-notes"><h2>Catatan presenter — draft bantuan AI, bukan sumber fakta</h2><p class="memo-pre">${html(c.aiNotes)}</p><p>${html(source(c.narrativeSource))}</p>${items(rows.map(({ metric, result }) => `${metric.name}: ${source(result?.current.source ?? "")}; target: ${source(result?.current.targetSource ?? "")}`))}</aside>` : "";
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${html(bundle.domain.name)} — ${html(bundle.period)}</title><style>${getPresentationStyles()}
    .memo-inner { width: min(100%, 1100px); max-height: 86vh; overflow: auto; } .memo-inner h1 { margin: .5rem 0 1.5rem; } .memo-inner h2 { margin: 1rem 0 .5rem; } .memo-list { padding-left: 1.5rem; line-height: 1.6; } .memo-list li { margin: .5rem 0; } .memo-table-scroll { overflow: auto; max-height: 65vh; } .data-table { min-width: 700px; } .data-table td { vertical-align: top; overflow-wrap: anywhere; } .memo-pre { white-space: pre-wrap; overflow-wrap: anywhere; } .memo-toolbar { position: fixed; z-index: 100; top: 1rem; right: 1rem; display: flex; gap: .5rem; } .memo-toolbar button { cursor: pointer; border: 1px solid #94a3b8; border-radius: .4rem; background: #0f172a; color: white; padding: .4rem .7rem; } .memo-appendices { display: none; position: fixed; z-index: 90; inset: 0; overflow: auto; background: #0f172a; padding: 5rem 2rem 2rem; } body.appendix-mode .memo-appendices { display: block; } body.appendix-mode .slides-wrapper, body.appendix-mode .progress-bar, body.appendix-mode .slide-counter, body.appendix-mode .nav-hint { visibility: hidden; } .memo-appendix-page { max-width: 1100px; margin: 0 auto 2rem; padding: 2rem; background: #1e293b; border-radius: .5rem; } .memo-appendix-page h2 { margin-bottom: 1rem; } .memo-appendix-page .memo-table-scroll { max-height: none; } .memo-notes { max-width: 1100px; margin: 2rem auto; padding: 1rem; border: 1px solid #94a3b8; } @media print { .memo-toolbar { display: none; } .memo-inner { max-height: none; overflow: visible; } .memo-table-scroll { max-height: none; overflow: visible; } .memo-appendices { display: none !important; } body.appendix-mode .slides-wrapper { display: none !important; } body.appendix-mode .memo-appendices { display: block !important; position: static; padding: 0; background: white; color: black; } .memo-appendix-page { background: white; color: black; page-break-after: always; } .memo-appendix-page .data-table th, .memo-appendix-page .data-table td { color: black; } }
  </style></head><body><div class="slides-wrapper">${core.join("")}</div><div class="progress-bar" id="progress-bar"></div><span class="slide-counter" id="slide-counter"></span><span class="nav-hint">${core.length} slide inti · 10–15 menit · ←/→ navigasi</span><nav class="memo-toolbar" aria-label="Opsi presentasi"><button id="appendix-toggle" type="button" aria-controls="appendices" aria-expanded="false">Buka lampiran</button><button type="button" onclick="window.print()">Cetak mode ini</button></nav><div class="memo-appendices" id="appendices" aria-label="Lampiran tidak termasuk slide inti">${appendix}${notes}</div><script>${getPresentationEngine(core.length)}
  (function(){var button=document.getElementById('appendix-toggle');button.addEventListener('click',function(){var open=document.body.classList.toggle('appendix-mode');button.textContent=open?'Kembali ke slide inti':'Buka lampiran';button.setAttribute('aria-expanded',String(open));});document.addEventListener('keydown',function(event){if(event.key==='Escape'&&document.body.classList.contains('appendix-mode')){document.body.classList.remove('appendix-mode');button.textContent='Buka lampiran';button.setAttribute('aria-expanded','false');button.focus();}})})();</script></body></html>`;
}
