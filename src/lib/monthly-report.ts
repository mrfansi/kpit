import type { ComputedReportMetric, ComputedReportValue, MonthlyObservation, MonthlyReportContent, ReportQuestion, ReportReconciliation } from "./monthly-report-types";

export function emptyMonthlyReportContent(): MonthlyReportContent {
  return {
    division: null, summary: [], worstOutcome: "", narrativeSource: "", kpiSetChangeNote: "", metrics: [],
    risksReviewed: false, risks: [], actions: [], decisionsReviewed: false, decisions: [],
    finance: { incomeStatement: { unit: "", rows: [] }, cashFlow: { unit: "", rows: [] }, balanceSheet: { unit: "", rows: [] } },
    channelBreakdowns: [], activities: [], appendices: [], aiNotes: "",
  };
}

export function reportMonths(period: string): string[] {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return Array.from({ length: month }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
}

export function previousReportMonth(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}-01`;
}

function question(questions: ReportQuestion[], path: string, text: string) {
  questions.push({ id: path, path, question: text });
}

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function average(values: number[]): number | null {
  return finite(values.reduce((sum, value) => sum + value / values.length, 0));
}

function sum(values: number[]): number | null {
  return finite(values.reduce((total, value) => total + value, 0));
}

function weightedRatio(observations: MonthlyObservation[], unit: string, includeActual: boolean): { value: number | null; target: number | null } {
  const scale = unit === "%" ? 100 : 1;
  const denominator = sum(observations.map((o) => o.denominator!));
  const numerator = includeActual ? sum(observations.map((o) => o.numerator!)) : null;
  const targetNumerator = observations.every((o) => o.target !== null)
    ? sum(observations.map((o) => o.target! * o.denominator!)) : null;
  if (denominator !== null && denominator > 0) {
    const value = numerator === null ? null : finite(numerator / denominator * scale);
    const target = targetNumerator === null ? null : finite(targetNumerator / denominator);
    if ((!includeActual || value !== null) && (observations.some((o) => o.target === null) || target !== null))
      return { value, target };
  }
  // Normalize before multiplying when intermediate totals overflow but the final
  // ratio/weighted target is representable.
  const maxDenominator = Math.max(...observations.map((o) => o.denominator!));
  const weights = observations.map((o) => o.denominator! / maxDenominator);
  const weightTotal = sum(weights);
  if (weightTotal === null || weightTotal === 0) return { value: null, target: null };
  const scaledNumerator = includeActual ? sum(observations.map((o) => o.numerator! / maxDenominator)) : null;
  const value = scaledNumerator === null ? null : finite(scaledNumerator / weightTotal * scale);
  const target = observations.every((o) => o.target !== null)
    ? sum(observations.map((o, i) => o.target! * (weights[i] / weightTotal))) : null;
  return { value, target };
}

function observationValue(observation: MonthlyObservation | undefined): ComputedReportValue {
  return {
    value: observation?.state === "provided" ? observation.actual : null,
    target: observation?.target ?? null,
    state: observation?.state ?? "missing",
    source: observation?.source ?? "",
    targetSource: observation?.targetSource ?? "",
    calculation: observation ? `Observasi ${observation.month}` : "Observasi belum tersedia",
  };
}

function aggregate(observations: (MonthlyObservation | undefined)[], rule: MonthlyReportContent["metrics"][number]["aggregation"], unit: string): ComputedReportValue {
  if (rule === "latest") {
    const current = observationValue(observations.at(-1));
    return { ...current, calculation: observations.at(-1) ? `Nilai akhir ${observations.at(-1)!.month}, bukan penjumlahan YTD` : "Nilai akhir bulan belum tersedia" };
  }
  const absent = observations.some((o) => !o || o.state === "missing");
  const untracked = observations.some((o) => o?.state === "untracked");
  const state = absent || !rule ? "missing" : untracked ? "untracked" : "provided";
  const present = observations.filter((o): o is MonthlyObservation => !!o);
  const source = present.map((o) => `${o.month}: ${o.source}`).join("; ");
  const targetSource = present.map((o) => `${o.month}: ${o.targetSource}`).join("; ");
  const calculation = rule ? `${rule} Januari–${present.at(-1)?.month ?? "?"}` : "Aturan agregasi belum dipilih";
  const base: ComputedReportValue = { value: null, target: null, state, source, targetSource, calculation };
  if (!rule || present.length !== observations.length) return base;
  const allTargets = present.every((o) => o.target !== null);
  const targets = allTargets ? present.map((o) => o.target!) : [];
  const allWeights = present.every((o) => o.denominator !== null && o.denominator > 0);
  if (rule === "sum" || rule === "average") {
    const target = allTargets ? (rule === "sum" ? sum(targets) : average(targets)) : null;
    const value = state === "provided" && present.every((o) => o.actual !== null)
      ? (rule === "sum" ? sum(present.map((o) => o.actual!)) : average(present.map((o) => o.actual!))) : null;
    return { ...base, value, target, calculation: `${rule === "sum" ? "Jumlah" : "Rata-rata"} ${present.map((o) => o.month).join(", ")}` };
  }
  const hasRatioInputs = state === "provided" && allWeights && present.every((o) => o.numerator !== null);
  const ratio = allWeights ? weightedRatio(present, unit, hasRatioInputs) : null;
  const target = ratio?.target ?? null;
  if (state !== "provided") return { ...base, target };
  if (!hasRatioInputs)
    return { ...base, state: "missing", target, calculation: "Rasio memerlukan numerator dan denominator positif di setiap bulan" };
  return { ...base, value: ratio!.value, target, calculation: `Σ numerator / Σ denominator × ${unit === "%" ? 100 : 1}; target berbobot denominator (${present.map((o) => o.month).join(", ")})` };
}

function sharedMetricComparison(
  local: MonthlyReportContent["metrics"][number],
  peer: MonthlyReportContent["metrics"][number],
  months: string[],
  previous: string,
): { state: "matched" | "conflict" | "awaiting_peer"; detail: string } {
  if (local.unit !== peer.unit || local.definition.trim() !== peer.definition.trim() || local.aggregation !== peer.aggregation)
    return { state: "conflict", detail: "Satuan, definisi, atau aturan agregasi angka bersama berbeda." };
  if (!peer.definitionConfirmed || !peer.aggregation || !peer.aggregationNote.trim())
    return { state: "awaiting_peer", detail: "Divisi pasangan belum mengonfirmasi definisi dan dasar perhitungan angka bersama." };
  const localObs = new Map(local.observations.map((o) => [o.month, o]));
  const peerObs = new Map(peer.observations.map((o) => [o.month, o]));
  for (const month of new Set([...months, previous, ...localObs.keys(), ...peerObs.keys()])) {
    const a = localObs.get(month);
    const b = peerObs.get(month);
    if (local.aggregation === "latest" && month !== previous && month !== months.at(-1) && !a && !b) continue;
    if (local.aggregation === "latest" && month !== previous && month !== months.at(-1) && a?.state === "missing" && b?.state === "missing") continue;
    if (!a || !b || a.state === "missing" || b.state === "missing")
      return { state: "awaiting_peer", detail: `Cakupan observasi bersama ${month} belum lengkap di kedua divisi.` };
    if (a.state !== b.state || a.actual !== b.actual || (local.aggregation === "ratio" && (a.numerator !== b.numerator || a.denominator !== b.denominator)))
      return { state: "conflict", detail: `Observasi ${month} berbeda (status/aktual${local.aggregation === "ratio" ? "/numerator/denominator" : ""}); periksa sumber dan koreksi sebelum presentasi.` };
    if (b.state === "provided" && (!b.source.trim() || b.actual === null) || b.target !== null && !b.targetSource.trim())
      return { state: "awaiting_peer", detail: `Sumber aktual atau target observasi divisi pasangan ${month} belum diberikan.` };
  }
  const aYtd = aggregate(months.map((month) => localObs.get(month)), local.aggregation, local.unit);
  const bYtd = aggregate(months.map((month) => peerObs.get(month)), peer.aggregation, peer.unit);
  if (aYtd.state !== bYtd.state || aYtd.value !== bYtd.value)
    return { state: "conflict", detail: "Nilai/status YTD angka bersama berbeda; periksa observasi dan aturan agregasi." };
  if (bYtd.state === "provided" && bYtd.value === null)
    return { state: "awaiting_peer", detail: "YTD divisi pasangan belum dapat dihitung sebagai angka finite." };
  return { state: "matched", detail: "Aktual bulan ini, sebelumnya, YTD, riwayat, satuan, definisi, dan agregasi cocok; target tiap divisi independen." };
}
export function computeMonthlyReport(
  content: MonthlyReportContent,
  period: string,
  peers: Array<{ domain: { id: number; name: string; slug: string }; period: string; content: MonthlyReportContent }> = [],
): { metrics: ComputedReportMetric[]; questions: ReportQuestion[]; reconciliations: ReportReconciliation[]; ready: boolean } {
  const questions: ReportQuestion[] = [];
  const reconciliations: ReportReconciliation[] = [];
  const months = reportMonths(period);
  const previous = previousReportMonth(period);
  if (!content.division) question(questions, "division", "Pilih salah satu dari enam divisi laporan.");
  if (content.summary.filter((s) => s.trim()).length < 2 || content.summary.filter((s) => s.trim()).length > 4) question(questions, "summary", "Tulis 2–4 poin lain; bersama hasil terburuk menjadi total 3–5 poin utama.");
  if (!content.worstOutcome.trim()) question(questions, "worstOutcome", "Jelaskan hasil terburuk bulan ini.");
  if (!content.narrativeSource.trim()) question(questions, "narrativeSource", "Cantumkan referensi sumber narasi ringkasan, hasil terburuk, isu, rencana, dan keputusan.");
  if (!content.risksReviewed) question(questions, "risksReviewed", "Konfirmasi apakah ada risiko/isu, termasuk jika nihil.");
  content.risks.forEach((r, i) => { if (!r.issue.trim() || !r.impact.trim() || !r.escalationOwner.trim()) question(questions, `risks.${i}`, "Lengkapi isu, dampak, dan pemilik eskalasi."); });
  if (!content.decisionsReviewed) question(questions, "decisionsReviewed", "Konfirmasi keputusan yang diminta, termasuk jika nihil.");
  content.decisions.forEach((d, i) => { if (!d.request.trim() || !d.options.trim() || !d.impact.trim()) question(questions, `decisions.${i}`, "Lengkapi permintaan keputusan, opsi, dan dampak."); });
  const nextMonth = new Date(`${period}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const firstNext = nextMonth.toISOString().slice(0, 10);
  if (!content.actions.length) question(questions, "actions", "Tentukan minimal satu aksi bulan depan, PIC, dan tenggat.");
  content.actions.forEach((a, i) => { if (!a.action.trim() || !a.pic.trim() || !a.deadline || a.deadline < firstNext) question(questions, `actions.${i}`, "Lengkapi aksi, PIC, dan tenggat tidak sebelum bulan depan."); });
  content.channelBreakdowns.forEach((row, i) => {
    if (!row.channel.trim() || !row.metric.trim() || !row.unit.trim() || row.state === "missing" || row.state === "provided" && (row.value === null || !row.source.trim()) || row.state === "untracked" && row.value !== null) question(questions, `channelBreakdowns.${i}`, "Lengkapi identitas kanal, nilai/sumber atau konfirmasi belum dilacak.");
  });
  content.appendices.forEach((row, i) => { if (/\d/.test(row.content) && !row.source.trim()) question(questions, `appendices.${i}.source`, "Cantumkan sumber angka lampiran."); });
  if (content.division === "finance") for (const [key, statement] of Object.entries(content.finance)) {
    if (!statement.unit.trim() || !statement.rows.length) question(questions, `finance.${key}`, "Lengkapi laporan keuangan dan satuan.");
    statement.rows.forEach((row, i) => { if (!row.label.trim() || row.state === "missing" || row.state === "provided" && (row.value === null || !row.source.trim()) || row.state === "untracked" && row.value !== null) question(questions, `finance.${key}.rows.${i}`, "Lengkapi angka dan sumber atau konfirmasi belum dilacak."); });
  }
  if (!content.metrics.length) question(questions, "metrics", "Daftarkan KPI aktif dan konfirmasi hasil bulan laporan.");
  const metrics = content.metrics.map((metric, index): ComputedReportMetric => {
    const path = `metrics.${index}`;
    const obs = new Map(metric.observations.map((o) => [o.month, o]));
    const current = observationValue(obs.get(period));
    const prev = observationValue(obs.get(previous));
    const ytd = aggregate(months.map((m) => obs.get(m)), metric.aggregation, metric.unit);
    if (!metric.name.trim() || !metric.unit.trim()) question(questions, `${path}.identity`, "Lengkapi nama dan satuan KPI.");
    if (!metric.definition.trim() || !metric.definitionConfirmed) question(questions, `${path}.definition`, `Konfirmasi definisi KPI ${metric.name}.`);
    if (!metric.aggregation || !metric.aggregationNote.trim()) question(questions, `${path}.aggregation`, `Tetapkan aturan dan penjelasan agregasi ${metric.name}.`);
    if (!metric.sharingReviewed) question(questions, `${path}.sharingReviewed`, `Konfirmasi apakah ${metric.name} adalah angka bersama lintas divisi.`);
    const requiredMonths = new Set(metric.aggregation === "latest" ? [previous, period] : [previous, ...months]);
    for (const o of metric.observations) {
      if (o.state === "provided" && (o.actual === null || !o.source.trim()))
        question(questions, `${path}.observations.${o.month}.source`, `Cantumkan sumber nilai ${metric.name} ${o.month}.`);
      if (o.target !== null && !o.targetSource.trim())
        question(questions, `${path}.observations.${o.month}.targetSource`, `Cantumkan sumber target ${metric.name} ${o.month}.`);
    }
    for (const month of requiredMonths) {
      const o = obs.get(month);
      if (!o || o.state === "missing") question(questions, `${path}.observations.${month}`, `Isi ${metric.name} ${month} atau konfirmasi belum dilacak.`);
      else if (o.state === "provided" && (o.actual === null || o.target === null || !o.source.trim() || !o.targetSource.trim())) question(questions, `${path}.observations.${month}`, `Lengkapi nilai, target, dan sumber ${metric.name} ${month}.`);
      if (metric.aggregation === "ratio" && o?.state === "provided" && (o.numerator === null || o.denominator === null || o.denominator <= 0)) question(questions, `${path}.observations.${month}.ratio`, `Lengkapi numerator dan denominator positif untuk ${metric.name} ${month}.`);
      if (metric.aggregation === "ratio" && o?.state === "provided" && o.numerator !== null && o.denominator !== null && o.denominator > 0 && o.actual !== null) {
        const derived = o.numerator / o.denominator * (metric.unit === "%" ? 100 : 1);
        if (!Number.isFinite(derived) || Math.abs(derived - o.actual) > 0.005 + Math.max(1e-9, Math.abs(derived) * 1e-12))
          question(questions, `${path}.observations.${month}.actual`, `Nilai rasio ${metric.name} ${month} tidak sesuai numerator/denominator.`);
      }
    }
    if (ytd.state === "missing") question(questions, `${path}.ytd`, `YTD ${metric.name} belum memiliki cakupan/input lengkap.`);
    if (ytd.state === "provided" && ytd.value === null) question(questions, `${path}.ytd.value`, `Hasil YTD ${metric.name} tidak dapat direpresentasikan; periksa angka/input agregasi.`);
    if (ytd.target === null && (metric.aggregation === "latest" ? obs.get(period)?.target !== null && obs.has(period) : months.every((m) => obs.get(m)?.target !== null && obs.has(m))))
      question(questions, `${path}.ytd.target`, `Target YTD ${metric.name} tidak dapat dihitung dengan input yang tersedia.`);
    const missedTarget = current.state === "provided" && current.value !== null && current.target !== null && (metric.direction === "higher_better" ? current.value < current.target : current.value > current.target);
    if (missedTarget && (!metric.deviationCause.trim() || !metric.deviationEvidence.trim())) question(questions, `${path}.deviation`, `Jelaskan sebab dan bukti deviasi ${metric.name} dari target efektif.`);
    if (metric.sharedMetricKey.trim()) {
      const linked = peers.filter((p) => p.period === period).flatMap((p) => p.content.metrics.filter((m) => m.sharedMetricKey.trim() === metric.sharedMetricKey.trim()).map((m) => ({ domainId: p.domain.id, domainName: p.domain.name, metric: m })));
      const comparisons = linked.map((p) => sharedMetricComparison(metric, p.metric, months, previous));
      const conflict = comparisons.find((comparison) => comparison.state === "conflict");
      const awaiting = comparisons.find((comparison) => comparison.state === "awaiting_peer");
      const state = !linked.length ? "awaiting_peer" : conflict ? "conflict" : awaiting ? "awaiting_peer" : "matched";
      const detail = (conflict ?? awaiting)?.detail ?? (state === "matched"
        ? "Aktual bulan ini, sebelumnya, YTD, riwayat, satuan, definisi, dan agregasi cocok; target tiap divisi independen."
        : "Menunggu laporan divisi lain dengan kunci angka yang sama.");
      reconciliations.push({ metricKey: metric.sharedMetricKey.trim(), state, peers: linked.map(({ domainId, domainName, metric: peerMetric }) => {
        const currentPeer = peerMetric.observations.find((o) => o.month === period);
        return { domainId, domainName, value: currentPeer?.actual ?? null, unit: peerMetric.unit, source: currentPeer?.source ?? "" };
      }), detail });
      if (state !== "matched") question(questions, `${path}.sharedMetricKey`, `Rekonsiliasi ${metric.name}: ${detail}`);
      if (!metric.reconciliationNote.trim()) question(questions, `${path}.reconciliationNote`, `Catat pemeriksaan definisi dan sumber angka bersama ${metric.name}.`);
    }
    const rawMoM = current.value !== null && prev.value !== null && prev.value !== 0
      ? (current.value - prev.value) / Math.abs(prev.value) * 100 : null;
    const momPercent = rawMoM === null ? null : finite(rawMoM) ?? finite((current.value! / Math.abs(prev.value!) - Math.sign(prev.value!)) * 100);
    if (rawMoM !== null && momPercent === null)
      question(questions, `${path}.momPercent`, `Perubahan MoM ${metric.name} tidak dapat direpresentasikan; periksa skala nilai.`);
    return { kpiId: metric.kpiId, current, previous: prev, ytd, momPercent, missedTarget };
  });
  return { metrics, questions, reconciliations, ready: questions.length === 0 };
}
