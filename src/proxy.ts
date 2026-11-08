import { getSessionWithCookies } from "@/auth";
import { canAccessAdminPath, decodePathname, getAdminDeniedRedirectPath, mergeSetCookies } from "@/lib/admin-access";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(req: NextRequest) {
  const { session, setCookies } = await getSessionWithCookies(req.headers);
  // Judge the decoded path so `/%61dmin` cannot slip past the prefix check.
  const pathname = decodePathname(req.nextUrl.pathname);
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/login";
  const isAuthenticated = !!session;
  const role = session?.user.role;

  const withCookies = (res: NextResponse) => {
    for (const cookie of setCookies) res.headers.append("set-cookie", cookie);
    return res;
  };

  if (isAdminRoute && !canAccessAdminPath(role, pathname)) {
    const redirectUrl = new URL(getAdminDeniedRedirectPath(isAuthenticated), req.nextUrl.origin);
    if (!isAuthenticated) {
      redirectUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    }
    return withCookies(NextResponse.redirect(redirectUrl));
  }

  if (isLoginPage && isAuthenticated) {
    return withCookies(NextResponse.redirect(new URL("/admin/kpi", req.nextUrl.origin)));
  }

  // The render must see the refreshed session cookie too, or it falls back to a D1 read per check.
  const requestHeaders = new Headers(req.headers);
  if (setCookies.length) requestHeaders.set("cookie", mergeSetCookies(req.headers.get("cookie"), setCookies));
  const res = withCookies(NextResponse.next({ request: { headers: requestHeaders } }));
  if (isAdminRoute) {
    // Report-only: measures what a nonce-based policy would block before the enforced 'unsafe-inline' one is dropped.
    const nonce = btoa(crypto.randomUUID());
    res.headers.set("Content-Security-Policy-Report-Only", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
  }
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
