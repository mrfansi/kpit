import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { getMonthlyReportBundle, MonthlyReportError, saveMonthlyReport } from "@/lib/monthly-report-store";
import { checkMonthlyMutationRequest } from "@/lib/monthly-report-request";

export const runtime = "nodejs";

function params(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain") ?? "";
  const period = request.nextUrl.searchParams.get("period") ?? "";
  if (!domain || !period) throw new MonthlyReportError(400, "Domain and period are required");
  return { domain, period };
}
function errorResponse(error: unknown) {
  if (error instanceof MonthlyReportError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid report content", issues: error.issues }, { status: 400 });
  console.error("Monthly report request failed", error);
  return NextResponse.json({ error: "Could not process monthly report" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { domain, period } = params(request);
    const bundle = await getMonthlyReportBundle(domain, period);
    return bundle ? NextResponse.json(bundle) : NextResponse.json({ error: "Domain not found" }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: NextRequest) {
  const rejection = checkMonthlyMutationRequest(request);
  if (rejection) return NextResponse.json({ error: rejection.error }, { status: rejection.status });
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let domain = "", period = "";
  try {
    ({ domain, period } = params(request));
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("content" in body) || !("revision" in body)) throw new MonthlyReportError(400, "Expected content and revision");
    const { content, revision } = body as { content: unknown; revision: unknown };
    if (typeof revision !== "number") throw new MonthlyReportError(400, "Invalid revision");
    return NextResponse.json(await saveMonthlyReport(domain, period, content, revision, { id: session.user.id, email: session.user.email }));
  } catch (error) {
    if (error instanceof MonthlyReportError && error.status === 409 && domain && period) {
      const bundle = await getMonthlyReportBundle(domain, period);
      return NextResponse.json({ error: error.message, bundle }, { status: 409 });
    }
    return errorResponse(error);
  }
}
