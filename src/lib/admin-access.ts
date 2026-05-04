export function canAccessAdminRoute(role: string | undefined): boolean {
  return role === "admin";
}

export function getAdminDeniedRedirectPath(isAuthenticated: boolean): "/" | "/login" {
  return isAuthenticated ? "/" : "/login";
}
