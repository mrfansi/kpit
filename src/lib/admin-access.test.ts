import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdminRoute, getAdminDeniedRedirectPath } from "./admin-access";

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
