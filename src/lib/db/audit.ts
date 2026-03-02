import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

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

export async function getRecentAuditLogs(limit = 50) {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).all();
}
