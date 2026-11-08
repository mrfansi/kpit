import { getSessionFromHeaders } from "@/auth";
import { canAccessAdminRoute, getAdminDeniedRedirectPath } from "@/lib/admin-access";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(req: NextRequest) {
  const session = await getSessionFromHeaders(req.headers);
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthenticated = !!session;
  const role = session?.user.role;

  if (isAdminRoute && !canAccessAdminRoute(role)) {
    const redirectUrl = new URL(getAdminDeniedRedirectPath(isAuthenticated), req.nextUrl.origin);
    if (!isAuthenticated) {
      redirectUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin/kpi", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
