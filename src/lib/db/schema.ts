import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  /*
   * Batas alami metrik, bukan target. PageSpeed mentok di 100, rating di 5,
   * jumlah insiden tidak bisa negatif. Nullable karena banyak metrik memang
   * tidak punya batas — dan menebak batas yang tidak ada lebih buruk daripada
   * tidak punya.
   *
   * Dipakai untuk menjepit proyeksi forecast agar tidak menembus langit-langit,
   * dan untuk menolak salah ketik saat input (misalnya 1000 pada skala 0–100).
   */
  minValue: real("min_value"),
  maxValue: real("max_value"),
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
}, (table) => [
  index("idx_kpis_domain_id").on(table.domainId),
  index("idx_kpis_active_domain_sort").on(table.isActive, table.domainId, table.sortOrder),
  index("idx_kpis_pinned_active_sort").on(table.isPinned, table.isActive, table.domainId, table.sortOrder),
]);

export const kpiEntries = sqliteTable("kpi_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kpiId: integer("kpi_id")
    .notNull()
    .references(() => kpis.id, { onDelete: "cascade" }),
  value: real("value").notNull(),
  periodDate: text("period_date").notNull(), // ISO date: YYYY-MM-DD (awal bulan/minggu)
  note: text("note"),
  numerator: real("numerator"), // opsional: value = numerator / denominator (x100 untuk unit %)
  denominator: real("denominator"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => [
  index("idx_kpi_entries_kpi_id").on(table.kpiId),
  index("idx_kpi_entries_period").on(table.periodDate),
  index("idx_kpi_entries_kpi_period").on(table.kpiId, table.periodDate),
]);

export const kpiTargets = sqliteTable("kpi_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kpiId: integer("kpi_id")
    .notNull()
    .references(() => kpis.id, { onDelete: "cascade" }),
  periodDate: text("period_date").notNull(), // ISO date: YYYY-MM-DD (awal bulan)
  target: real("target").notNull(),
  thresholdGreen: real("threshold_green").notNull(),
  thresholdYellow: real("threshold_yellow").notNull(),
}, (table) => [
  uniqueIndex("uq_kpi_targets_kpi_period").on(table.kpiId, table.periodDate),
]);

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
}, (table) => [
  index("idx_kpi_comments_kpi_id").on(table.kpiId),
]);

export const kpiActionPlans = sqliteTable("kpi_action_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kpiId: integer("kpi_id")
    .notNull()
    .references(() => kpis.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  owner: text("owner").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["open", "in_progress", "done", "cancelled"] })
    .notNull()
    .default("open"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => [
  index("idx_kpi_action_plans_kpi_id").on(table.kpiId),
  index("idx_kpi_action_plans_status_due").on(table.status, table.dueDate),
]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  userEmail: text("user_email"),
  action: text("action").notNull(), // 'create' | 'update' | 'delete'
  entity: text("entity").notNull(), // lihat AUDIT_ENTITIES di lib/db/audit.ts
  entityId: text("entity_id"),
  detail: text("detail"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => [
  index("idx_audit_logs_user_id").on(table.userId),
  index("idx_audit_logs_created_at").on(table.createdAt),
]);
export type AuditLog = typeof auditLogs.$inferSelect;

export const monthlyReports = sqliteTable("monthly_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domainId: integer("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  content: text("content", { mode: "json" }).notNull(),
  revision: integer("revision").notNull().default(1),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("uq_monthly_reports_domain_period").on(table.domainId, table.period),
  index("idx_monthly_reports_period").on(table.period),
]);
export const monthlyReportRevisions = sqliteTable("monthly_report_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportId: integer("report_id").notNull().references(() => monthlyReports.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  content: text("content", { mode: "json" }).notNull(),
  authorId: text("author_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("uq_monthly_report_revisions_report_revision").on(table.reportId, table.revision),
]);


// Types
export type Domain = typeof domains.$inferSelect;
export type KPI = typeof kpis.$inferSelect;
export type KPIEntry = typeof kpiEntries.$inferSelect;
export type KPITarget = typeof kpiTargets.$inferSelect;
export type KPIComment = typeof kpiComments.$inferSelect;
export type KPIActionPlan = typeof kpiActionPlans.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type NewKPI = typeof kpis.$inferInsert;
export type NewKPIEntry = typeof kpiEntries.$inferInsert;
export type NewKPITarget = typeof kpiTargets.$inferInsert;
export type NewKPIComment = typeof kpiComments.$inferInsert;
export type NewKPIActionPlan = typeof kpiActionPlans.$inferInsert;

// `users` is better-auth's user model (modelName "users"). The credential lives in
// `account.password`; `password_hash` is a legacy next-auth column that is no longer
// written (it keeps the "" default only because the column is NOT NULL and better-auth
// refuses a required column it never writes).
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull().$defaultFn(() => ""),
  role: text("role", { enum: ["admin", "viewer"] }).notNull().default("viewer"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  // SQLite cannot ADD COLUMN with a non-constant default, so the SQL default is 0
  // (the migration backfills it from created_at); the app always sets a real date.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull()
    .default(sql`0`),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_id_idx").on(t.userId)]);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (t) => [
  index("account_user_id_idx").on(t.userId),
  uniqueIndex("account_provider_account_uq").on(t.providerId, t.accountId),
]);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

// better-auth's database rate limiter (model `rateLimit`; `lastRequest` is epoch milliseconds).
export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

// Our own counters (D1 rate limiter in rate-limit-d1.ts); separate from better-auth's pruned `rate_limit`.
export const appRateLimit = sqliteTable("app_rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// --- Timeline / Gantt Tables ---

export const timelineProjectStatuses = sqliteTable("timeline_project_statuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#9ca3af"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type TimelineProjectStatus = typeof timelineProjectStatuses.$inferSelect;
export type NewTimelineProjectStatus = typeof timelineProjectStatuses.$inferInsert;

export const timelineProjects = sqliteTable("timeline_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  progress: integer("progress").notNull().default(0),
  launchBufferDays: integer("launch_buffer_days").notNull().default(7),
  estimatedLaunchDate: text("estimated_launch_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  statusId: integer("status_id").references(() => timelineProjectStatuses.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => [
  index("idx_timeline_projects_sort").on(table.sortOrder),
  index("idx_timeline_projects_status_sort").on(table.statusId, table.sortOrder),
  index("idx_timeline_projects_dates").on(table.startDate, table.endDate),
]);

export type TimelineProject = typeof timelineProjects.$inferSelect;
export type NewTimelineProject = typeof timelineProjects.$inferInsert;

export const timelineProjectLogs = sqliteTable("timeline_project_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => timelineProjects.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  progressBefore: integer("progress_before"),
  progressAfter: integer("progress_after"),
  author: text("author").notNull().default("Admin"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => [
  index("idx_timeline_project_logs_project_created").on(table.projectId, table.createdAt),
]);

export type TimelineProjectLog = typeof timelineProjectLogs.$inferSelect;
export type NewTimelineProjectLog = typeof timelineProjectLogs.$inferInsert;

export const presentationBrandStyles = sqliteTable("presentation_brand_styles", {
  revision: integer("revision").primaryKey(),
  style: text("style", { mode: "json" }).notNull(),
  description: text("description").notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});
