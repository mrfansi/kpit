import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { domains, kpiEntries, kpis } from "./schema";

const sqlite = new Database("./kpit.db");
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

async function seed() {
  // Run migrations first
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations applied");

  // Seed domains
  const [sales, hr, ops] = await db
    .insert(domains)
    .values([
      { name: "Sales & Revenue", slug: "sales", icon: "TrendingUp", color: "#22c55e", description: "KPI penjualan dan pendapatan" },
      { name: "HR & People", slug: "hr", icon: "Users", color: "#3b82f6", description: "KPI sumber daya manusia" },
      { name: "Operasional", slug: "operasional", icon: "Settings", color: "#f59e0b", description: "KPI operasional & produksi" },
    ])
    .returning();
  console.log("✅ Domains seeded:", [sales, hr, ops].map((d) => d.name));

  // Seed KPIs
  const [revKpi, convKpi, attendKpi, turnoverKpi, otdKpi, defectKpi] = await db
    .insert(kpis)
    .values([
      {
        domainId: sales.id,
        name: "Total Revenue",
        description: "Total pendapatan bulanan",
        unit: "Rp",
        target: 500_000_000,
        thresholdGreen: 450_000_000,
        thresholdYellow: 350_000_000,
        direction: "higher_better",
        refreshType: "periodic",
        period: "monthly",
      },
      {
        domainId: sales.id,
        name: "Conversion Rate",
        description: "Persentase lead yang menjadi pelanggan",
        unit: "%",
        target: 25,
        thresholdGreen: 22,
        thresholdYellow: 15,
        direction: "higher_better",
        refreshType: "periodic",
        period: "monthly",
      },
      {
        domainId: hr.id,
        name: "Tingkat Kehadiran",
        description: "Persentase kehadiran karyawan",
        unit: "%",
        target: 95,
        thresholdGreen: 92,
        thresholdYellow: 85,
        direction: "higher_better",
        refreshType: "periodic",
        period: "monthly",
      },
      {
        domainId: hr.id,
        name: "Turnover Rate",
        description: "Tingkat pergantian karyawan per bulan",
        unit: "%",
        target: 2,
        thresholdGreen: 2,
        thresholdYellow: 4,
        direction: "lower_better",
        refreshType: "periodic",
        period: "monthly",
      },
      {
        domainId: ops.id,
        name: "On-Time Delivery",
        description: "Persentase pengiriman tepat waktu",
        unit: "%",
        target: 95,
        thresholdGreen: 93,
        thresholdYellow: 85,
        direction: "higher_better",
        refreshType: "realtime",
        period: "monthly",
      },
      {
        domainId: ops.id,
        name: "Defect Rate",
        description: "Persentase produk cacat dari total produksi",
        unit: "%",
        target: 1,
        thresholdGreen: 1,
        thresholdYellow: 3,
        direction: "lower_better",
        refreshType: "periodic",
        period: "monthly",
      },
    ])
    .returning();
  console.log("✅ KPIs seeded:", [revKpi, convKpi, attendKpi, turnoverKpi, otdKpi, defectKpi].map((k) => k.name));

  // Generate 6 months of historical data (Sep 2025 - Feb 2026)
  const months = ["2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"];

  const entries = [
    // Revenue (target 500jt)
    ...months.map((m, i) => ({ kpiId: revKpi.id, periodDate: m, value: [420_000_000, 460_000_000, 390_000_000, 510_000_000, 480_000_000, 495_000_000][i] })),
    // Conversion Rate (target 25%)
    ...months.map((m, i) => ({ kpiId: convKpi.id, periodDate: m, value: [18, 22, 16, 28, 24, 26][i] })),
    // Kehadiran (target 95%)
    ...months.map((m, i) => ({ kpiId: attendKpi.id, periodDate: m, value: [94, 96, 91, 95, 93, 97][i] })),
    // Turnover (target <= 2%, lower is better)
    ...months.map((m, i) => ({ kpiId: turnoverKpi.id, periodDate: m, value: [1.5, 2.1, 3.2, 1.8, 2.5, 1.2][i] })),
    // On-Time Delivery (target 95%)
    ...months.map((m, i) => ({ kpiId: otdKpi.id, periodDate: m, value: [92, 95, 88, 96, 94, 97][i] })),
    // Defect Rate (target <= 1%, lower is better)
    ...months.map((m, i) => ({ kpiId: defectKpi.id, periodDate: m, value: [0.8, 1.2, 2.1, 0.9, 1.5, 0.7][i] })),
  ];

  await db.insert(kpiEntries).values(entries);
  console.log(`✅ ${entries.length} KPI entries seeded`);
  console.log("\n🎉 Seed complete!");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
