import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADMIN_NAVIGATION,
  APP_SHELL_NAVIGATION,
  buildAppShellAriaLabel,
  buildAppShellNavGroups,
  findAppShellActiveItem,
  getDashboardNavigationItem,
} from "../app/_components/app-shell/navigation";

describe("app shell navigation", () => {
  it("defines dashboard, patients, measurements, operations and finance navigation with return-to-dashboard", () => {
    assert.deepEqual(
      APP_SHELL_NAVIGATION.map((item) => item.label),
      ["Dashboard", "Pacientes", "Mediciones", "Operaciones", "Caja y Finanzas"],
    );
    assert.equal(getDashboardNavigationItem().href, "/");
    assert.equal(APP_SHELL_NAVIGATION.every((item) => item.dashboardHref === "/"), true);
  });

  it("places Caja y Finanzas in the Gestión group right after Operaciones", () => {
    const gestion = buildAppShellNavGroups("STAFF").find((group) => group.label === "Gestión");
    const keys = gestion!.items.map((item) => item.key);
    assert.deepEqual(keys, ["patients", "measurements", "operations", "finance"]);
    assert.equal(findAppShellActiveItem("/finance")?.key, "finance");
  });

  it("keeps submenus reachable through stable hrefs", () => {
    const patients = APP_SHELL_NAVIGATION.find((item) => item.key === "patients");
    const measurements = APP_SHELL_NAVIGATION.find((item) => item.key === "measurements");
    const operations = APP_SHELL_NAVIGATION.find((item) => item.key === "operations");

    assert.equal(patients?.children?.[0]?.href, "/patients");
    assert.equal(measurements?.children?.[0]?.href, "/patients");
    assert.equal(operations?.children?.[0]?.href, "/operations");
  });

  it("resolves active module context from nested routes", () => {
    assert.equal(findAppShellActiveItem("/patients/pat-1")?.key, "patients");
    assert.equal(findAppShellActiveItem("/patients/pat-1/measurements/new")?.key, "measurements");
    assert.equal(findAppShellActiveItem("/operations")?.key, "operations");
    assert.equal(findAppShellActiveItem("/")?.key, "dashboard");
  });

  it("keeps adopted patient and measurement routes oriented to the correct shell section", () => {
    assert.equal(findAppShellActiveItem("/patients")?.key, "patients");
    assert.equal(findAppShellActiveItem("/patients/pat-1")?.key, "patients");
    assert.equal(findAppShellActiveItem("/patients/pat-1/measurements/new")?.key, "measurements");
    assert.equal(findAppShellActiveItem("/patients/pat-1/measurements/session-1")?.key, "measurements");
  });

  it("exposes a patients context label and description for the shell topbar", () => {
    const active = findAppShellActiveItem("/patients");

    assert.equal(active?.label, "Pacientes");
    assert.equal(active?.description, "Alta, búsqueda y ficha clínica");
  });

  it("builds accessible labels that expose active state", () => {
    assert.equal(buildAppShellAriaLabel(APP_SHELL_NAVIGATION[0]!, true), "Dashboard, sección activa");
    assert.equal(buildAppShellAriaLabel(APP_SHELL_NAVIGATION[1]!, false), "Pacientes");
  });
});

describe("admin navigation", () => {
  it("resolves /admin/* to the admin section instead of falling back to dashboard", () => {
    assert.equal(findAppShellActiveItem("/admin")?.key, "admin");
    assert.equal(findAppShellActiveItem("/admin/users")?.key, "admin-users");
    assert.equal(findAppShellActiveItem("/admin/users/new")?.key, "admin-users");
    assert.equal(findAppShellActiveItem("/admin/audit-log")?.key, "admin-audit");
  });

  it("exposes Usuarios and Auditoría as admin destinations", () => {
    const hrefs = ADMIN_NAVIGATION.map((item) => item.href);
    assert.ok(hrefs.includes("/admin/users"), "must offer /admin/users");
    assert.ok(hrefs.includes("/admin/audit-log"), "must offer /admin/audit-log");
  });
});

describe("buildAppShellNavGroups role gating", () => {
  it("hides the Administración group for STAFF and anonymous users", () => {
    for (const role of ["STAFF", undefined] as const) {
      const labels = buildAppShellNavGroups(role).map((group) => group.label);
      assert.ok(!labels.includes("Administración"), `role ${role} must NOT see the admin group`);
    }
  });

  it("shows the Administración group with Usuarios and Auditoría for ADMIN", () => {
    const adminGroup = buildAppShellNavGroups("ADMIN").find(
      (group) => group.label === "Administración",
    );
    assert.ok(adminGroup, "ADMIN must see the admin group");
    const itemLabels = adminGroup!.items.map((item) => item.label);
    assert.ok(itemLabels.includes("Usuarios"));
    assert.ok(itemLabels.includes("Auditoría"));
  });

  it("always includes the core Principal and Gestión groups regardless of role", () => {
    const labels = buildAppShellNavGroups("STAFF").map((group) => group.label);
    assert.ok(labels.includes("Principal"));
    assert.ok(labels.includes("Gestión"));
  });
});
