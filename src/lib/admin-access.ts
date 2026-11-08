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
