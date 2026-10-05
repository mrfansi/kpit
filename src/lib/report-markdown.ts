export type MarkdownExportFormat = "full" | "brief" | "presentation";

export interface UnifiedMarkdownKPI {
  name: string;
  description: string | null;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  momDelta: string;
  direction: string;
}

export interface UnifiedMarkdownDomain {
  name: string;
  description: string | null;
  kpis: UnifiedMarkdownKPI[];
}

export interface UnifiedMarkdownActionPlan {
  title: string;
  description: string | null;
  kpiName: string;
  domainName: string;
  owner: string;
  dueDate: string;
  status: string;
  overdue: boolean;
}

export interface UnifiedMarkdownAttentionItem {
  name: string;
  domainName: string;
  actual: string;
  target: string;
  status: string;
  reason: string;
}

export interface UnifiedMarkdownProject {
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  launchDate: string;
  launchDateType: "Manual" | "Calculated";
  progress: number;
  status: string;
}

export interface UnifiedMarkdownHistoricalEntry {
  period: string;
  actual: string;
  target: string;
  achievement: string;
  status: string;
  note: string | null;
}

export interface UnifiedMarkdownHistoricalKPI {
  name: string;
  description: string | null;
  unit: string;
  direction: string;
  entries: UnifiedMarkdownHistoricalEntry[];
}

export interface UnifiedMarkdownHistoricalDomain {
  name: string;
  description: string | null;
  kpis: UnifiedMarkdownHistoricalKPI[];
}

export interface UnifiedMarkdownReportData {
  periodLabel: string;
  generatedDate: string;
  summary: {
    healthScore: number;
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
  };
  domains: UnifiedMarkdownDomain[];
  actionPlans: UnifiedMarkdownActionPlan[];
  attentionItems: UnifiedMarkdownAttentionItem[];
  projects: UnifiedMarkdownProject[];
  historicalDomains?: UnifiedMarkdownHistoricalDomain[];
}

export function generateMarkdownExport(data: UnifiedMarkdownReportData, format: "full" | "brief") {
  if (format === "brief") return generateExecutiveBrief(data);
  return generateUnifiedMarkdownReport(data);
}

function cell(value: string | number | null | undefined) {
  const text = value === null || value === undefined || value === "" ? "-" : String(value);
  return text.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function listLine(label: string, value: string | number | null) {
  return `- ${label}: ${cell(value)}`;
}

function generateExecutiveBrief(data: UnifiedMarkdownReportData) {
  const offTrack = data.attentionItems.filter((item) => item.status === "Off Track");
  const lowProgressProjects = data.projects.filter((project) => project.progress < 50);

  return [
    "# KPIT Executive Brief",
    "",
    `Period: ${data.periodLabel}`,
    `Generated: ${data.generatedDate}`,
    "",
    "## KPI Snapshot",
    "",
    `Health score is ${data.summary.healthScore}% across ${data.summary.totalKPIs} KPIs. ${data.summary.greenCount} KPIs are on track, ${data.summary.yellowCount} are at risk, ${data.summary.redCount} are off track, and ${data.summary.noDataCount} have no data.`,
    "",
    "## Priority KPI Attention",
    "",
    offTrack.length === 0
      ? "No off-track KPIs were identified."
      : offTrack.map((item) => `- ${item.name} (${item.domainName}): ${item.actual} vs ${item.target}. ${item.reason}.`).join("\n"),
    "",
    "## Timeline Snapshot",
    "",
    `There are ${data.projects.length} timeline projects in the report. ${lowProgressProjects.length} projects are below 50% progress.`,
    "",
    "## Recommended Executive Focus",
    "",
    "- Review off-track KPIs and assign action owners.",
    "- Check low-progress projects against their end dates and launch readiness.",
    "- Use the action plan list to confirm near-term accountability.",
  ].join("\n").trim() + "\n";
}

export function generateUnifiedMarkdownReport(data: UnifiedMarkdownReportData) {
  const lines: string[] = [
    "# KPIT Unified Report",
    "",
    `Period: ${data.periodLabel}`,
    `Generated: ${data.generatedDate}`,
    "",
    "## Executive Summary",
    "",
    `The KPI portfolio health score is ${data.summary.healthScore}% for ${data.periodLabel}. ${data.summary.greenCount} KPIs are on track, ${data.summary.yellowCount} are at risk, ${data.summary.redCount} are off track, and ${data.summary.noDataCount} have no data.`,
    "",
    "## KPI Health Overview",
    "",
    listLine("Total KPIs", data.summary.totalKPIs),
    listLine("On Track", data.summary.greenCount),
    listLine("At Risk", data.summary.yellowCount),
    listLine("Off Track", data.summary.redCount),
    listLine("No Data", data.summary.noDataCount),
    listLine("Improved", data.summary.improved),
    listLine("Declined", data.summary.declined),
    listLine("Stable", data.summary.stable),
    listLine("Average Achievement", data.summary.avgAchievement !== null ? `${data.summary.avgAchievement}%` : null),
    listLine("Achievement Delta", data.summary.achievementDelta !== null ? `${data.summary.achievementDelta > 0 ? "+" : ""}${data.summary.achievementDelta}%` : null),
    "",
    "## Domain Performance",
    "",
  ];

  for (const domain of data.domains) {
    lines.push(`### ${domain.name}`, "");
    if (domain.description) lines.push(domain.description, "");
    lines.push("| KPI | Description | Actual | Target | Achievement | Status | MoM Delta |");
    lines.push("|---|---|---:|---:|---:|---|---:|");
    for (const kpi of domain.kpis) {
      lines.push(`| ${cell(kpi.name)} | ${cell(kpi.description)} | ${cell(kpi.actual)} | ${cell(kpi.target)} | ${cell(kpi.achievement)} | ${cell(kpi.status)} | ${cell(kpi.momDelta)} |`);
    }
    lines.push("");
  }

  if (data.historicalDomains && data.historicalDomains.length > 0) {
    lines.push("## KPI Historical Data", "");
    for (const domain of data.historicalDomains) {
      lines.push(`### ${domain.name}`, "");
      if (domain.description) lines.push(domain.description, "");
      for (const kpi of domain.kpis) {
        lines.push(`#### ${kpi.name}`, "");
        if (kpi.description) lines.push(kpi.description, "");
        lines.push(`- Unit: ${cell(kpi.unit)}`);
        lines.push(`- Direction: ${cell(kpi.direction)}`);
        lines.push("");
        if (kpi.entries.length === 0) {
          lines.push("No historical entries are available.", "");
          continue;
        }
        lines.push("| Period | Actual | Target | Achievement | Status | Note |");
        lines.push("|---|---:|---:|---:|---|---|");
        for (const entry of kpi.entries) {
          lines.push(`| ${cell(entry.period)} | ${cell(entry.actual)} | ${cell(entry.target)} | ${cell(entry.achievement)} | ${cell(entry.status)} | ${cell(entry.note)} |`);
        }
        lines.push("");
      }
    }
  }

  lines.push("## Action Plans", "");
  if (data.actionPlans.length === 0) {
    lines.push("No action plans are included for this report.", "");
  } else {
    lines.push("| Action | Domain | KPI | Owner | Due Date | Status | Overdue |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const action of data.actionPlans) {
      lines.push(`| ${cell(action.title)} | ${cell(action.domainName)} | ${cell(action.kpiName)} | ${cell(action.owner)} | ${cell(action.dueDate)} | ${cell(action.status)} | ${action.overdue ? "Yes" : "No"} |`);
    }
    lines.push("");
  }

  lines.push("## Attention Items", "");
  if (data.attentionItems.length === 0) {
    lines.push("No critical attention items were identified.", "");
  } else {
    lines.push("| KPI | Domain | Actual | Target | Status | Reason |");
    lines.push("|---|---|---:|---:|---|---|");
    for (const item of data.attentionItems) {
      lines.push(`| ${cell(item.name)} | ${cell(item.domainName)} | ${cell(item.actual)} | ${cell(item.target)} | ${cell(item.status)} | ${cell(item.reason)} |`);
    }
    lines.push("");
  }

  lines.push("## Timeline and Gantt Overview", "");
  const averageProgress = data.projects.length > 0
    ? Math.round(data.projects.reduce((sum, project) => sum + project.progress, 0) / data.projects.length)
    : 0;
  lines.push(listLine("Total Projects", data.projects.length));
  lines.push(listLine("Average Progress", `${averageProgress}%`));
  lines.push("");
  lines.push("## All Projects Timeline", "");
  if (data.projects.length === 0) {
    lines.push("No timeline projects are available.", "");
  } else {
    lines.push("| Project | Description | Start Date | End Date | Launch Date | Launch Date Type | Progress | Status |");
    lines.push("|---|---|---|---|---|---|---:|---|");
    for (const project of data.projects) {
      lines.push(`| ${cell(project.name)} | ${cell(project.description)} | ${cell(project.startDate)} | ${cell(project.endDate)} | ${cell(project.launchDate)} | ${cell(project.launchDateType)} | ${project.progress}% | ${cell(project.status)} |`);
    }
    lines.push("");
  }

  lines.push("## Project Launch Readiness", "");
  const readyProjects = data.projects.filter((project) => project.progress >= 80);
  const lowProgressProjects = data.projects.filter((project) => project.progress < 50);
  lines.push(listLine("Projects at or above 80% progress", readyProjects.length));
  lines.push(listLine("Projects below 50% progress", lowProgressProjects.length));
  lines.push("");
  lines.push("## Schedule Risks", "");
  if (lowProgressProjects.length === 0) {
    lines.push("No low-progress projects were identified from the timeline data.", "");
  } else {
    for (const project of lowProgressProjects) {
      lines.push(`- ${project.name}: ${project.progress}% progress, scheduled to end on ${project.endDate}.`);
    }
    lines.push("");
  }
  lines.push("## Suggested Presentation Brief", "");
  lines.push("Use this report to create a concise executive presentation covering KPI health, domain-level performance, action priorities, project timeline readiness, and schedule risks.");

  return lines.join("\n").trim() + "\n";
}

export function buildPresentationPrompt(reportMarkdown: string) {
  return [
    "Siapkan presentasi eksekutif berdasarkan laporan KPI dan timeline di bawah dengan alur klarifikasi → penyusunan presentasi.",
    "",
    "Audiens: CEO dan pimpinan divisi. Bahasa: Bahasa Indonesia. Gaya: ringkas, faktual, berorientasi KPI dan keputusan.",
    "Ikuti Memo Internal Standar Presentasi Laporan Bulanan Divisi tanggal 4 Oktober 2026, yang berlaku mulai laporan bulanan berikutnya.",
    "",
    "CAKUPAN DAN BATAS PRESENTASI",
    "Susun laporan untuk satu divisi dan satu bulan, bukan deck gabungan seluruh organisasi. Jika laporan memuat beberapa divisi dan pengguna belum menentukan divisi yang akan dipresentasikan, tanyakan divisi yang dimaksud. Jika pengguna meminta semua divisi, buat deck terpisah dengan batas masing-masing.",
    "Divisi dalam memo: Finance, Sales & Marketing, Operation, Product & Tech, Production, serta HR & Strategic Partnership. Jangan menganggap nama domain yang berbeda pasti setara dengan divisi dalam memo; klarifikasi pemetaannya bila belum jelas.",
    "Divisi umum: 6–8 slide inti, dipresentasikan sekitar 10–15 menit per divisi.",
    "Finance: boleh hingga 10 slide inti untuk mengakomodasi laba rugi, arus kas, dan neraca. Tanyakan laporan keuangan yang belum diberikan; jangan menyusun laporan keuangan dari KPI generik saja.",
    "HR & Strategic Partnership: sekitar 5 slide inti. Gabungkan bagian berdekatan tanpa menghilangkan isi wajib atau mengubah urutannya.",
    "Lampiran tidak dibatasi dan tidak dihitung sebagai slide inti. Lampiran hanya dibuka saat ada pertanyaan, bukan dipresentasikan dalam alokasi 10–15 menit.",
    "Letakkan identitas divisi dan periode pada slide pertama; hindari slide judul/penutup yang hanya dekoratif.",
    "",
    "TAHAP 1 — PERIKSA KELENGKAPAN DATA",
    "Sebelum menyusun slide, periksa kelengkapan dan konsistensi informasi dalam laporan.",
    "Jika informasi penting belum tersedia atau ambigu, ajukan pertanyaan klarifikasi terlebih dahulu dan tunggu jawaban. Jangan membuat draft slide pada respons tersebut atau langsung menuliskan “data tidak ada”.",
    "Gabungkan pertanyaan dalam satu daftar singkat menurut topik. Sebutkan KPI/bagian, periode, dan informasi yang dibutuhkan secara spesifik.",
    "Tanyakan hanya informasi yang belum bisa diperoleh dari input; jangan meminta pengguna mengulangi data yang sudah tersedia.",
    "Bedakan informasi yang belum diberikan, memang belum dilacak, dan tidak relevan untuk divisi ini. Label No Data, N/A, tanda —, atau baris yang kosong tidak membuktikan bahwa metrik memang belum dilacak; klarifikasi terlebih dahulu.",
    "Klarifikasi divisi, bulan laporan, ringkasan 3–5 poin terpenting, dan satu hal yang paling tidak berjalan baik bila belum tersedia. Ekspor berlabel All Periods tetap memerlukan pemilihan satu bulan laporan; jangan menganggapnya sebagai YTD.",
    "Prioritaskan klarifikasi mengenai:",
    "1. Definisi dan target KPI yang belum jelas. Minta klarifikasi dan konfirmasi ke CEO sebelum menyusun slide, sesuai memo.",
    "2. Data bulan lalu dan year-to-date (YTD), beserta aturan agregasinya. YoY dan riwayat semua periode bukan pengganti YTD; jangan menjumlahkan persentase, rasio, atau saldo secara sembarang.",
    "3. Sumber setiap angka dan perbedaan angka yang sama lintas divisi.",
    "4. Penyebab setiap KPI yang meleset dari target serta bukti pendukungnya.",
    "5. Isu/risiko, pihak yang perlu turun tangan, rencana bulan depan, PIC, tenggat, dan keputusan C-level bila ada.",
    "Jangan mengarang angka, sumber, penyebab deviasi, PIC, tenggat, atau keputusan C-level. Rekomendasi dalam laporan bukan bukti bahwa sebuah rencana sudah disepakati.",
    "",
    "TAHAP 2 — SUSUN PRESENTASI",
    "Susun slide setelah pertanyaan penting terjawab, atau pengguna secara eksplisit meminta melanjutkan dengan informasi yang tersedia.",
    "Jika input sudah lengkap, langsung susun presentasi tanpa pertanyaan yang tidak diperlukan.",
    "Jika pengguna mengonfirmasi metrik memang belum dilacak, tulis “belum dilacak” sesuai standar laporan bulanan; jangan menggantinya dengan nol, estimasi, atau menghilangkan KPI tersebut.",
    "Jika pengguna meminta melanjutkan meskipun informasi lain belum terkonfirmasi, nyatakan keterbatasan spesifiknya tanpa membuat asumsi. Jangan menyimpulkan performa stabil atau membaik dari ketiadaan data.",
    "Jika suatu bagian dikonfirmasi tidak relevan atau tidak ada keputusan C-level yang dibutuhkan, jangan terus menanyakannya.",
    "",
    "URUTAN DAN ISI SLIDE INTI",
    "1. Ringkasan satu halaman: 3–5 poin terpenting bulan ini, termasuk satu hal yang paling tidak berjalan baik. Jangan mengarang kegagalan jika belum ada informasi; klarifikasi terlebih dahulu.",
    "2. KPI vs target: gunakan KPI yang sama setiap bulan sesuai daftar KPI yang sudah ditetapkan untuk divisi. Tampilkan aktual, target, dan selisih/pencapaian; jangan mengganti KPI dengan metrik baru agar hasil terlihat lebih baik.",
    "3. Tren: bandingkan bulan laporan dengan bulan lalu dan year-to-date (YTD), bukan hanya angka bulan ini. Nyatakan periode dan aturan agregasi YTD.",
    "4. Penjelasan deviasi: untuk setiap KPI yang meleset dari target, tampilkan penyebab yang terkonfirmasi dan data pendukung. Jangan menyaring hanya KPI berstatus merah; periksa aktual vs target sesuai arah KPI.",
    "5. Isu dan risiko: jelaskan hambatan, dampak, dan siapa yang perlu turun tangan.",
    "6. Rencana bulan depan: tampilkan aksi konkret, PIC, dan tenggat. Bedakan rencana bulan depan dari aktivitas atau penyelesaian pada bulan laporan.",
    "7. Keputusan C-level, bila ada: jelaskan keputusan yang diminta, pilihan yang tersedia, dan konsekuensinya berdasarkan informasi yang diberikan. Jika dikonfirmasi tidak diperlukan, bagian ini boleh dihilangkan.",
    "Untuk Finance, sisipkan detail laba rugi, arus kas, dan neraca pada bagian KPI/tren/deviasi dengan tetap menjaga urutan bagian dan batas 10 slide inti. Untuk HR & Strategic Partnership, pertahankan isi dan urutan yang sama saat menggabungkan bagian menjadi sekitar 5 slide.",
    "",
    "INTEGRITAS ANGKA DAN LAMPIRAN",
    "Cantumkan sumber setiap angka pada slide. Gunakan hanya sumber yang diberikan; untuk angka turunan, cantumkan sumber data input dan cara perhitungannya. Jika sumber belum tersedia, tanyakan terlebih dahulu.",
    "Cocokkan angka yang juga dilaporkan divisi lain sebelum presentasi, misalnya pendapatan Sales dan Finance. Jangan menganggap angka sudah cocok hanya karena satu divisi tersedia. Jika ada perbedaan, tanyakan periode, definisi, dan sumbernya; jangan memilih atau merata-ratakannya tanpa dasar.",
    "Jika pengguna meminta melanjutkan sebelum sumber atau pencocokan tersedia, tandai angka terkait secara spesifik sebagai “sumber belum terkonfirmasi” atau “perlu rekonsiliasi”. Nyatakan bahwa draft belum memenuhi ketentuan tersebut, bukan mengklaim siap dipresentasikan.",
    "Pindahkan tabel detail, data mentah, breakdown per channel, dan daftar aktivitas tanpa kaitan langsung ke KPI ke lampiran. Jangan membuang detail hanya untuk memenuhi batas slide inti.",
    "",
    "FORMAT HASIL SETELAH KLARIFIKASI",
    "Pisahkan Slide Inti dan Lampiran. Untuk setiap slide inti, tuliskan nomor, judul, isi utama, sumber angka, dan catatan presenter singkat. Cantumkan jumlah slide inti dan pembagian durasi sekitar 10–15 menit.",
    "Sebelum menyerahkan draft, periksa batas slide divisi, urutan bagian, ringkasan 3–5 poin termasuk hal yang tidak berjalan baik, KPI vs target, MoM dan YTD, bukti deviasi, isu/eskalasi, rencana/PIC/tenggat, sumber angka, dan rekonsiliasi lintas divisi. Jika pengguna memilih melanjutkan dengan kekurangan yang belum terselesaikan, jelaskan batas kepatuhannya secara spesifik.",
    "",
    "DATA LAPORAN",
    "",
    reportMarkdown,
  ].join("\n");
}
