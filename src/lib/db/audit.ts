import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

/**
 * Append an audit log entry. Pass a transaction handle as `executor` to make
 * the audit write atomic with the entity mutation it records.
 */
export function logAudit(
  data: {
    userId?: string;
    userEmail?: string;
    action: "create" | "update" | "delete";
    entity: string;
    entityId?: string;
    detail?: string;
  },
  executor: Pick<typeof db, "insert"> = db
) {
  // better-sqlite3 is synchronous; .run() executes the insert immediately so
  // this works both standalone and inside a synchronous db.transaction(tx).
  executor
    .insert(auditLogs)
    .values({
      ...data,
      createdAt: new Date(),
    })
    .run();
}

export async function getRecentAuditLogs(limit = 50, offset = 0) {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset).all();
}

export async function getAuditLogCount() {
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs);
  return row?.count ?? 0;
}
