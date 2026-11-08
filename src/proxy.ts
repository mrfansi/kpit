import { getSessionWithCookies, type AuthSession } from "@/auth";
import { canAccessAdminPath, decodePathname, getAdminDeniedRedirectPath, isPublicPath, mergeSetCookies } from "@/lib/admin-access";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(req: NextRequest) {
  // Judge the decoded path so `/%61dmin` cannot slip past the prefix check.
  const pathname = decodePathname(req.nextUrl.pathname);
  const isLoginPage = pathname === "/login";
  // Public paths other than /login need no session read (keeps the Free-plan CPU budget).
  if (isPublicPath(pathname) && !isLoginPage) return NextResponse.next();

  // A throwing read (deleted session mid-refresh, D1 error) must not 500 every page: treat it as anonymous.
  let session: AuthSession | null = null;
  let setCookies: string[] = [];
  try {
    ({ session, setCookies } = await getSessionWithCookies(req.headers));
  } catch (err) {
    console.error("proxy session read failed", err);
  }
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

  // Pages get a per-request script nonce. Data endpoints and uploads keep the static config CSP, and
  // the deck routes set their own: a middleware header would override both (vinext lets middleware win).
  const isPage = !(pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/uploads/"));
  // The brand editor previews the deck in a srcdoc iframe, which inherits this page's CSP; the deck's inline
  // script has no nonce, so this one page keeps 'unsafe-inline' until the preview loads from its own URL.
  const needsInlineScript = pathname.startsWith("/admin/presentation/brand");
  let csp: string | null = null;
  if (isPage) {
    const nonce = btoa(crypto.randomUUID());
    csp = buildPageCsp(needsInlineScript ? "'self' 'unsafe-inline'" : `'self' 'nonce-${nonce}' 'strict-dynamic'`);
    // vinext reads the nonce from the request CSP first; set it so a client-forged header cannot win.
    requestHeaders.set("content-security-policy", csp);
    if (needsInlineScript) requestHeaders.delete("x-nonce");
    else requestHeaders.set("x-nonce", nonce);
  }
  const res = withCookies(NextResponse.next({ request: { headers: requestHeaders } }));
  if (csp) res.headers.set("Content-Security-Policy", csp);
  return res;
}

const isDev = process.env.NODE_ENV !== "production";

// Keep the non-script directives in sync with next.config.ts, which serves the policy for non-page paths.
function buildPageCsp(scriptSources: string): string {
  return [
    "default-src 'self'",
    // strict-dynamic: scripts loaded by the nonced bootstrap are trusted. Dev (vite) needs 'unsafe-eval'.
    `script-src ${scriptSources}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    isDev ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:*" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Everything except static build assets and better-auth; `isPublicPath` re-checks the decoded path.
// No `.*\..*` extension exclusion: /uploads/*.png and /api/*.json must stay behind the login.
export const config = {
  matcher: ["/((?!_next/|assets/|favicon\\.ico$|api/auth(?:/|$)).*)"],
};
