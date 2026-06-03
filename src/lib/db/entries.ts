import { db } from "@/lib/db";
import { kpiEntries } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function upsertKPIEntry(data: {
  kpiId: number;
  periodDate: string;
  value: number;
  note?: string;
}) {
  db.transaction((tx) => {
    tx
      .delete(kpiEntries)
      .where(and(eq(kpiEntries.kpiId, data.kpiId), eq(kpiEntries.periodDate, data.periodDate)))
      .run();
    tx.insert(kpiEntries).values(data).run();
  });
}
