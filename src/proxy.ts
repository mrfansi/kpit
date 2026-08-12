import { auth } from "@/auth";
import { canAccessAdminRoute, getAdminDeniedRedirectPath } from "@/lib/admin-access";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthenticated = !!req.auth;
  const role = req.auth?.user?.role;

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
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
