import type { KPIDirection } from "@/lib/kpi-status";

export interface ThresholdConfig {
  direction: KPIDirection;
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
}

export type CoherenceIssue = {
  level: "error" | "warning";
  message: string;
};

/**
 * Ambang peringatan: nilai yang PAS di batas hijau ternyata cuma mencapai
 * sekian persen dari target. Di bawah ini, KPI bisa berstatus "On Track"
 * sambil memampangkan pencapaian yang jauh dari target — kontradiksi yang
 * membingungkan pembaca laporan.
 *
 * ponytail: 50% adalah heuristik, bukan kebenaran. Diuji terhadap data nyata:
 * menyaring konfigurasi yang mencurigakan (10%, 40%) tanpa mengganggu yang wajar
 * (78–90%). Kalau ternyata masih berisik atau kelewat longgar, ini knob-nya.
 */
const MIN_ACHIEVEMENT_AT_GREEN = 50;

/**
 * Target dan threshold adalah dua definisi "bagus" yang berdiri sendiri:
 * status dihitung dari threshold, pencapaian dihitung dari target. Tidak ada
 * yang memaksa keduanya koheren — jadi periksa di sini, saat KPI disimpan.
 *
 * Memisahkan target (aspirasi) dari threshold (toleransi) itu SAH. Yang tidak
 * sah adalah jarak yang begitu jauh sampai statusnya jadi menyesatkan.
 */
export function checkThresholdCoherence(cfg: ThresholdConfig): CoherenceIssue[] {
  const { direction, target, thresholdGreen, thresholdYellow } = cfg;
  const issues: CoherenceIssue[] = [];

  if (![target, thresholdGreen, thresholdYellow].every(Number.isFinite)) return issues;

  const lowerBetter = direction === "lower_better";

  // Urutan zona terbalik: hijau harus lebih ketat daripada kuning.
  const orderWrong = lowerBetter
    ? thresholdGreen > thresholdYellow
    : thresholdGreen < thresholdYellow;
  if (orderWrong) {
    issues.push({
      level: "error",
      message: lowerBetter
        ? "Batas hijau harus lebih kecil daripada batas kuning (nilai kecil = lebih baik)."
        : "Batas hijau harus lebih besar daripada batas kuning (nilai besar = lebih baik).",
    });
    return issues; // urutan rusak — pemeriksaan lain jadi tidak bermakna
  }

  if (thresholdGreen === 0 || target === 0) return issues;

  // Pencapaian sebuah nilai yang pas menyentuh batas hijau.
  const achievementAtGreen = lowerBetter
    ? (target / thresholdGreen) * 100
    : (thresholdGreen / target) * 100;

  if (achievementAtGreen < MIN_ACHIEVEMENT_AT_GREEN) {
    issues.push({
      level: "warning",
      message:
        `Batas hijau jauh dari target: KPI ini akan berstatus "On Track" padahal ` +
        `pencapaiannya hanya ${Math.round(achievementAtGreen)}%. ` +
        `Pastikan ini memang toleransi yang disengaja, bukan salah isi.`,
    });
  }

  return issues;
}
