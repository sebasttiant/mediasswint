import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAdminAccess, type AdminAccessUser } from "../app/admin/admin-access";

describe("admin page access", () => {
  it("redirects anonymous users to login", () => {
    assert.deepEqual(resolveAdminAccess(null), { allowed: false, redirectTo: "/login" });
  });

  it("redirects STAFF users to patients", () => {
    const staffUser: AdminAccessUser = { id: "staff-1", role: "STAFF" };

    assert.deepEqual(resolveAdminAccess(staffUser), { allowed: false, redirectTo: "/patients" });
  });

  it("allows ADMIN users to render the admin entrypoint", () => {
    const adminUser: AdminAccessUser = { id: "admin-1", role: "ADMIN" };

    assert.deepEqual(resolveAdminAccess(adminUser), { allowed: true });
  });
});
