import { getSessionWithCookies } from "@/auth";
import { canAccessAdminPath, decodePathname, getAdminDeniedRedirectPath, isPublicPath, mergeSetCookies } from "@/lib/admin-access";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(req: NextRequest) {
  // Judge the decoded path so `/%61dmin` cannot slip past the prefix check.
  const pathname = decodePathname(req.nextUrl.pathname);
  const isLoginPage = pathname === "/login";
  // Public paths other than /login need no session read (keeps the Free-plan CPU budget).
  if (isPublicPath(pathname) && !isLoginPage) return NextResponse.next();

  const { session, setCookies } = await getSessionWithCookies(req.headers);
  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthenticated = !!session;
  const role = session?.user.role;

  const withCookies = (res: NextResponse) => {
    for (const cookie of setCookies) res.headers.append("set-cookie", cookie);
    return res;
  };

  if (!isAuthenticated && !isLoginPage) {
    // Data endpoints answer 401 instead of redirecting to an HTML page.
    if (pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) {
      return withCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    const redirectUrl = new URL(getAdminDeniedRedirectPath(false), req.nextUrl.origin);
    redirectUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return withCookies(NextResponse.redirect(redirectUrl));
  }

  if (isAdminRoute && !canAccessAdminPath(role, pathname)) {
    return withCookies(NextResponse.redirect(new URL(getAdminDeniedRedirectPath(true), req.nextUrl.origin)));
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

// Everything except static build assets and better-auth; `isPublicPath` re-checks the decoded path.
// No `.*\..*` extension exclusion: /uploads/*.png and /api/*.json must stay behind the login.
export const config = {
  matcher: ["/((?!_next/|assets/|favicon\\.ico$|api/auth(?:/|$)).*)"],
};
