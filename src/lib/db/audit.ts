import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

/** Setiap nilai `entity` yang boleh ditulis ke audit_logs; filter halaman audit memakai daftar yang sama. */
export const AUDIT_ENTITIES = [
  "kpi",
  "kpi_entry",
  "kpi_target",
  "kpi_comment",
  "kpi_action_plan",
  "domain",
  "user",
  "timeline_project",
  "timeline_project_log",
  "timeline_project_status",
  "monthly_report",
] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

const MAX_VALUE_LENGTH = 80;

function formatValue(value: unknown): string {
  const text = value === null || value === undefined || value === "" ? "-" : String(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

/**
 * "field: lama → baru" untuk field yang berubah saja; "" kalau tidak ada yang berubah.
 * null, undefined, dan "" dianggap sama-sama kosong, supaya mengosongkan catatan
 * yang memang sudah kosong tidak tampak sebagai perubahan.
 */
export function formatChanges(before: Record<string, unknown>, after: Record<string, unknown>): string {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => (before[key] ?? "") !== (after[key] ?? ""))
    .map((key) => `${key}: ${formatValue(before[key])} → ${formatValue(after[key])}`)
    .join(", ");
}

/** Build an audit insert so it can commit atomically in a D1 batch. */
export function auditInsert(
  data: {
    userId?: string;
    userEmail?: string;
    action: "create" | "update" | "delete";
    entity: AuditEntity;
    entityId?: string;
    detail?: string;
  }
) {
  return db.insert(auditLogs)
    .values({
      ...data,
      createdAt: new Date(),
    });
}

export async function logAudit(data: Parameters<typeof auditInsert>[0]) {
  await auditInsert(data);
}
