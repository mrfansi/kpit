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
