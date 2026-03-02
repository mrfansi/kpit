import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const domains = sqliteTable("domains", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull().default("BarChart2"),
  color: text("color").notNull().default("#6366f1"),
  description: text("description"),
});

export const kpis = sqliteTable("kpis", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domainId: integer("domain_id")
    .notNull()
    .references(() => domains.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit").notNull().default("%"), // %, Rp, unit, dll
  target: real("target").notNull(),
  thresholdGreen: real("threshold_green").notNull(), // nilai >= green = on track
  thresholdYellow: real("threshold_yellow").notNull(), // nilai >= yellow = at risk
  refreshType: text("refresh_type", { enum: ["realtime", "periodic"] })
    .notNull()
    .default("periodic"),
  period: text("period", { enum: ["daily", "weekly", "monthly"] })
    .notNull()
    .default("monthly"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const kpiEntries = sqliteTable("kpi_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kpiId: integer("kpi_id")
    .notNull()
    .references(() => kpis.id, { onDelete: "cascade" }),
  value: real("value").notNull(),
  periodDate: text("period_date").notNull(), // ISO date: YYYY-MM-DD (awal bulan/minggu)
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const kpiTargets = sqliteTable("kpi_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kpiId: integer("kpi_id")
    .notNull()
    .references(() => kpis.id, { onDelete: "cascade" }),
  periodDate: text("period_date").notNull(), // ISO date: YYYY-MM-DD (awal bulan)
  target: real("target").notNull(),
  thresholdGreen: real("threshold_green").notNull(),
  thresholdYellow: real("threshold_yellow").notNull(),
});

export const kpiComments = sqliteTable("kpi_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kpiId: integer("kpi_id")
    .notNull()
    .references(() => kpis.id, { onDelete: "cascade" }),
  periodDate: text("period_date").notNull(), // ISO date: YYYY-MM-DD
  content: text("content").notNull(),
  author: text("author").notNull().default("Admin"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Types
export type Domain = typeof domains.$inferSelect;
export type KPI = typeof kpis.$inferSelect;
export type KPIEntry = typeof kpiEntries.$inferSelect;
export type KPITarget = typeof kpiTargets.$inferSelect;
export type KPIComment = typeof kpiComments.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type NewKPI = typeof kpis.$inferInsert;
export type NewKPIEntry = typeof kpiEntries.$inferInsert;
export type NewKPITarget = typeof kpiTargets.$inferInsert;
export type NewKPIComment = typeof kpiComments.$inferInsert;
