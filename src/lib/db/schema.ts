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
  unit: text("unit").notNull().default("%"),
  target: real("target").notNull(),
  thresholdGreen: real("threshold_green").notNull(),
  thresholdYellow: real("threshold_yellow").notNull(),
  direction: text("direction", { enum: ["higher_better", "lower_better"] })
    .notNull()
    .default("higher_better"),
  refreshType: text("refresh_type", { enum: ["realtime", "periodic"] })
    .notNull()
    .default("periodic"),
  period: text("period", { enum: ["daily", "weekly", "monthly"] })
    .notNull()
    .default("monthly"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
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

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  userEmail: text("user_email"),
  action: text("action").notNull(), // 'create' | 'update' | 'delete'
  entity: text("entity").notNull(), // 'kpi' | 'entry' | 'domain' | 'user'
  entityId: text("entity_id"),
  detail: text("detail"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
export type AuditLog = typeof auditLogs.$inferSelect;

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

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "viewer"] }).notNull().default("admin"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
