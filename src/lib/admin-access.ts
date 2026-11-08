export function canAccessAdminRoute(role: string | undefined): boolean {
  return role === "admin";
}

export function getAdminDeniedRedirectPath(isAuthenticated: boolean): "/" | "/login" {
  return isAuthenticated ? "/" : "/login";
}

/** Viewers may only reach their own account page (to change their password) under /admin. */
export function canAccessAdminPath(role: string | undefined, pathname: string): boolean {
  return canAccessAdminRoute(role) || (role === "viewer" && /^\/admin\/account\/?$/.test(pathname));
}

/** Decode percent-escapes so `/%61dmin` is judged as `/admin`; a malformed escape keeps the raw path. */
export function decodePathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Fold `Set-Cookie` values into a request `Cookie` header so the render sees a session the proxy just refreshed. */
export function mergeSetCookies(cookieHeader: string | null, setCookies: string[]): string {
  const jar = new Map<string, string>();
  for (const pair of (cookieHeader ?? "").split(";")) {
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  for (const setCookie of setCookies) {
    const [pair = "", ...attrs] = setCookie.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value === "" || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a))) jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
