"use server";

import { db } from "@/lib/db";
import { domains, kpiActionPlans, kpis } from "@/lib/db/schema";
import { actionPlanSchema, actionPlanUpdateSchema } from "@/lib/validations/action-plan";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getActionContext(kpiId: number) {
  const [row] = await db
    .select({
      kpiName: kpis.name,
      domainSlug: domains.slug,
    })
    .from(kpis)
    .innerJoin(domains, eq(kpis.domainId, domains.id))
    .where(eq(kpis.id, kpiId))
    .limit(1);

  return row ?? null;
}

function revalidateActionPlanViews(kpiId: number, domainSlug?: string) {
  revalidatePath("/");
  revalidatePath(`/kpi/${kpiId}`);
  revalidatePath("/admin/actions");
  if (domainSlug) revalidatePath(`/domain/${domainSlug}`);
}

export async function createActionPlan(input: unknown) {
  const session = await requireAdmin();
  const parsed = actionPlanSchema.parse(input);
  const context = await getActionContext(parsed.kpiId);

  await db.insert(kpiActionPlans).values({
    ...parsed,
    description: parsed.description || null,
    updatedAt: new Date(),
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "create",
    entity: "kpi_action_plan",
    detail: `${context?.kpiName ?? "KPI"}: ${parsed.title}`,
  });

  revalidateActionPlanViews(parsed.kpiId, context?.domainSlug);
}

export async function updateActionPlan(id: number, kpiId: number, input: unknown) {
  const session = await requireAdmin();
  const parsed = actionPlanUpdateSchema.parse(input);
  const context = await getActionContext(kpiId);

  await db
    .update(kpiActionPlans)
    .set({
      ...parsed,
      description: parsed.description === "" ? null : parsed.description,
      updatedAt: new Date(),
    })
    .where(eq(kpiActionPlans.id, id));

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "update",
    entity: "kpi_action_plan",
    entityId: String(id),
    detail: parsed.title ?? parsed.status ?? "updated",
  });

  revalidateActionPlanViews(kpiId, context?.domainSlug);
}

export async function deleteActionPlan(id: number, kpiId: number) {
  const session = await requireAdmin();
  const context = await getActionContext(kpiId);

  await db.delete(kpiActionPlans).where(eq(kpiActionPlans.id, id));

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "delete",
    entity: "kpi_action_plan",
    entityId: String(id),
  });

  revalidateActionPlanViews(kpiId, context?.domainSlug);
}
