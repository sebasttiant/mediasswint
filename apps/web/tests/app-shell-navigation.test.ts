import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APP_SHELL_NAVIGATION,
  buildAppShellAriaLabel,
  findAppShellActiveItem,
  getDashboardNavigationItem,
} from "../app/_components/app-shell/navigation";

describe("app shell navigation", () => {
  it("defines dashboard, patients, measurements, and operations navigation with return-to-dashboard", () => {
    assert.deepEqual(
      APP_SHELL_NAVIGATION.map((item) => item.label),
      ["Dashboard", "Pacientes", "Mediciones", "Operaciones"],
    );
    assert.equal(getDashboardNavigationItem().href, "/");
    assert.equal(APP_SHELL_NAVIGATION.every((item) => item.dashboardHref === "/"), true);
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

  it("builds accessible labels that expose active state", () => {
    assert.equal(buildAppShellAriaLabel(APP_SHELL_NAVIGATION[0]!, true), "Dashboard, sección activa");
    assert.equal(buildAppShellAriaLabel(APP_SHELL_NAVIGATION[1]!, false), "Pacientes");
  });
});
