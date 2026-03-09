import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export async function logAudit(data: {
  userId?: string;
  userEmail?: string;
  action: "create" | "update" | "delete";
  entity: string;
  entityId?: string;
  detail?: string;
}) {
  await db.insert(auditLogs).values({
    ...data,
    createdAt: new Date(),
  });
}

export async function getRecentAuditLogs(limit = 50, offset = 0) {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset).all();
}

export async function getAuditLogCount() {
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs);
  return row?.count ?? 0;
}
