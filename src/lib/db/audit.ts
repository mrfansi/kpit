import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

/** Build an audit insert so it can commit atomically in a D1 batch. */
export function auditInsert(
  data: {
    userId?: string;
    userEmail?: string;
    action: "create" | "update" | "delete";
    entity: string;
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
