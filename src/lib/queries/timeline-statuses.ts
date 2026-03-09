import { db } from "@/lib/db";
import { timelineProjectStatuses } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export function getAllStatuses() {
  return db
    .select()
    .from(timelineProjectStatuses)
    .orderBy(asc(timelineProjectStatuses.sortOrder));
}
