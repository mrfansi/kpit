import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdminRoute, decodePathname, getAdminDeniedRedirectPath, isPublicPath } from "./admin-access";

test("allows admin users to access admin routes", () => {
  assert.equal(canAccessAdminRoute("admin"), true);
});

test("blocks viewers and missing roles from admin routes", () => {
  assert.equal(canAccessAdminRoute("viewer"), false);
  assert.equal(canAccessAdminRoute(undefined), false);
});

test("keeps unauthenticated admin users on login flow and redirects authenticated non-admin users home", () => {
  assert.equal(getAdminDeniedRedirectPath(false), "/login");
  assert.equal(getAdminDeniedRedirectPath(true), "/");
});

test("lets viewers reach only /admin/account", async () => {
  const { canAccessAdminPath } = await import("./admin-access");
  assert.equal(canAccessAdminPath("viewer", "/admin/account"), true);
  assert.equal(canAccessAdminPath("viewer", "/admin/account/"), true);
  assert.equal(canAccessAdminPath("viewer", "/admin/account/x"), false);
  assert.equal(canAccessAdminPath("viewer", "/admin/kpi"), false);
  assert.equal(canAccessAdminPath(undefined, "/admin/account"), false);
  assert.equal(canAccessAdminPath("admin", "/admin/kpi"), true);
});

test("decodes percent-escaped admin paths and tolerates malformed ones", async () => {
  const { decodePathname } = await import("./admin-access");
  assert.equal(decodePathname("/%61dmin/kpi"), "/admin/kpi");
  assert.equal(decodePathname("/%E0%A4%A"), "/%E0%A4%A");
});

test("merges refreshed Set-Cookie values into the request Cookie header", async () => {
  const { mergeSetCookies } = await import("./admin-access");
  assert.equal(
    mergeSetCookies("a=1; session_data=old", ["session_data=new; Max-Age=300; Path=/; HttpOnly", "b=2; Path=/"]),
    "a=1; session_data=new; b=2",
  );
  assert.equal(mergeSetCookies("a=1; b=2", ["a=; Max-Age=0; Path=/"]), "b=2");
  assert.equal(mergeSetCookies(null, []), "");
});

test("treats only login, better-auth and static build assets as public", () => {
  for (const p of ["/login", "/api/auth/sign-in/email", "/_next/x.js", "/assets/a.css", "/favicon.ico"]) {
    assert.equal(isPublicPath(p), true, p);
  }
  for (const p of [
    "/",
    "/kpi/1",
    "/report/all",
    "/timeline",
    "/api/export/csv",
    "/api/report/markdown",
    "/uploads/comments/a.png",
    "/login/x",
    "/api/authx",
    "/api/auth/../export/csv",
  ]) {
    assert.equal(isPublicPath(p), false, p);
  }
  assert.equal(isPublicPath(decodePathname("/%61pi/export/csv")), false);
  assert.equal(isPublicPath(decodePathname("/api/auth%2F..%2Fexport/csv")), false);
});
