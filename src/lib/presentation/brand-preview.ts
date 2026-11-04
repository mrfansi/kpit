import { computeMonthlyReport, emptyMonthlyReportContent, reportMonths } from "@/lib/monthly-report";
import type { MonthlyReportBundle, MonthlyReportMetric } from "@/lib/monthly-report-types";

export function presentationBrandSample(): MonthlyReportBundle {
  const period = "2026-10-01";
  const content = emptyMonthlyReportContent();
  content.division = "sales_marketing";
  content.summary = ["DATA CONTOH — pratinjau gaya, bukan laporan operasional.", "Pendapatan tumbuh dibanding September dan akuisisi pelanggan melampaui target.", "Konversi prospek tertinggal; tim memprioritaskan perbaikan tindak lanjut."];
  content.worstOutcome = "Konversi prospek 18%, di bawah target 25%.";
  content.narrativeSource = "Data simulasi untuk pratinjau merek KPIT, Oktober 2026.";
  content.kpiSetChangeNote = "Empat KPI inti tetap sama untuk perbandingan bulanan.";
  const definitions = [
    { name: "Pendapatan", definition: "Pendapatan penjualan bersih bulan berjalan", unit: "juta rupiah", actual: 1250, previous: 1100, target: 1200 },
    { name: "Pelanggan baru", definition: "Jumlah pelanggan baru dengan pembayaran pertama", unit: "pelanggan", actual: 84, previous: 76, target: 80 },
    { name: "Konversi prospek", definition: "Persentase prospek yang menjadi pelanggan", unit: "%", actual: 18, previous: 20, target: 25 },
    { name: "Kepuasan pelanggan", definition: "Rata-rata skor survei pascapembelian", unit: "/5", actual: 4.6, previous: 4.5, target: 4.5 },
  ];
  content.metrics = definitions.map((definition, index): MonthlyReportMetric => ({
    kpiId: index + 1, name: definition.name, definition: definition.definition, unit: definition.unit,
    direction: "higher_better", definitionConfirmed: true, aggregation: "average", aggregationNote: "Rata-rata observasi bulanan untuk contoh YTD.",
    observations: reportMonths(period).map((month) => ({
      month, actual: month === period ? definition.actual : definition.previous, target: definition.target,
      source: `Data simulasi ${month.slice(0, 7)}`, targetSource: "Rencana simulasi 2026", state: "provided", numerator: null, denominator: null,
    })),
    sharedMetricKey: "", sharingReviewed: true, reconciliationNote: "Tidak ada metrik bersama pada data simulasi.",
    deviationCause: index === 2 ? "Tindak lanjut prospek terlambat saat volume kampanye meningkat." : "",
    deviationEvidence: index === 2 ? "Audit simulasi CRM: 32 prospek belum ditindaklanjuti dalam 24 jam." : "",
  }));
  content.risksReviewed = true;
  content.risks = [{ issue: "Antrean prospek bertambah", impact: "Konversi dan pendapatan bulan depan berisiko turun", escalationOwner: "Head of Sales" }];
  content.actions = [
    { action: "Terapkan pembagian prospek harian dan SLA tindak lanjut", pic: "Sales Lead", deadline: "2026-11-07" },
    { action: "Evaluasi kampanye dengan kualitas prospek terbaik", pic: "Marketing Lead", deadline: "2026-11-14" },
  ];
  content.decisionsReviewed = true;
  content.decisions = [{ request: "Setujui realokasi tim untuk tindak lanjut prospek", options: "Rotasi internal atau tambahan staf", impact: "Mempercepat respons tanpa menaikkan anggaran kampanye" }];
  return { domain: { id: 0, name: "Sales & Marketing (contoh)", slug: "sales-marketing" }, period, content, ...computeMonthlyReport(content, period), revision: 0, updatedAt: null };
}
