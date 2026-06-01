import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { describe, it } from "node:test";

import { AppShell } from "../app/_components/app-shell/app-shell";
import { AdminPage } from "../app/admin/page";
import { resolveAdminAccess, type AdminAccessUser } from "../app/admin/admin-access";
import { AdminDashboard } from "../app/admin/admin-dashboard";
import {
  ADMIN_DESTINATIONS,
  renderAdminView,
  type AdminDestination,
  type AdminViewUser,
} from "../app/admin/admin-view";

type AdminAppShellProps = {
  currentPath: string;
  title: string;
  kicker: string;
  description?: string;
  userLabel?: string;
  children: ReactElement;
};

function readAdminViewProps(view: ReactElement): AdminAppShellProps {
  return view.props as AdminAppShellProps;
}

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

describe("ADMIN_DESTINATIONS", () => {
  it("declares /patients and /operations as actionable destinations", () => {
    const hrefs = ADMIN_DESTINATIONS.map((destination: AdminDestination) => destination.href);
    assert.ok(hrefs.includes("/patients"), "must offer /patients as a destination");
    assert.ok(hrefs.includes("/operations"), "must offer /operations as a destination");
  });

  it("declares /admin/users and /admin/audit-log as actionable destinations", () => {
    const hrefs = ADMIN_DESTINATIONS.map((destination: AdminDestination) => destination.href);
    assert.ok(hrefs.includes("/admin/users"), "must offer /admin/users as a destination");
    assert.ok(
      hrefs.includes("/admin/audit-log"),
      "must offer /admin/audit-log as a destination",
    );
  });

  it("provides Spanish labels and descriptions for every destination", () => {
    for (const destination of ADMIN_DESTINATIONS) {
      assert.ok(destination.label.length > 0, `destination ${destination.key} must have a label`);
      assert.ok(
        destination.description.length > 0,
        `destination ${destination.key} must have a description`,
      );
    }
  });
});

describe("renderAdminView composition", () => {
  it("wraps the AdminDashboard inside AppShell with admin context", () => {
    const user: AdminViewUser = { fullName: "Ada Lovelace" };
    const view = renderAdminView({ user, role: "ADMIN" });

    assert.equal(view.type, AppShell);
    const props = readAdminViewProps(view);
    assert.equal(props.currentPath, "/admin");
    assert.equal(props.kicker, "MEDIASSWINT · Administración");
    assert.equal(props.title, "Administración");
    assert.equal(props.userLabel, "Bienvenido, Ada Lovelace");
    assert.equal(props.children.type, AdminDashboard);
  });

  it("falls back to a neutral userLabel when fullName is missing", () => {
    const view = renderAdminView({ user: { fullName: null }, role: "ADMIN" });
    const props = readAdminViewProps(view);
    assert.equal(props.userLabel, "Bienvenido");
  });
});

describe("AdminPage route", () => {
  function adminUser() {
    return { id: "admin-1", role: "ADMIN" as const, fullName: "Ada Lovelace" };
  }

  it("renders AppShell with the AdminDashboard for ADMIN users", async () => {
    const view = await AdminPage({
      readUser: async () => adminUser(),
    });

    assert.equal(view.type, AppShell);
    const props = readAdminViewProps(view);
    assert.equal(props.children.type, AdminDashboard);
  });
});
