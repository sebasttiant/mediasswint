import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type AuthUser } from "@/lib/auth";
import {
  handleGetAuditLogRequest,
  type AuditLogRouteDeps,
} from "@/app/api/admin/audit-log/route";
import type { AuditLogRow } from "@/lib/audit-log";

const adminUser: AuthUser = {
  id: "admin-1",
  email: "admin@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Admin User",
  role: "ADMIN",
};

function makeRow(overrides: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: "log-1",
    userId: "admin-1",
    action: "CREATE",
    entityType: "Patient",
    entityId: "pat-1",
    diff: { after: { id: "pat-1" } },
    createdAt: new Date("2025-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeRequest(url: string): Request {
  return new Request(`http://localhost${url}`);
}

function createDeps(overrides: Partial<AuditLogRouteDeps> = {}): AuditLogRouteDeps {
  return {
    list: async () => [makeRow()],
    ...overrides,
  };
}

describe("GET /api/admin/audit-log — from/to date filter", () => {
  it("Scenario 2.1: forwards valid from+to as Date objects to listAuditLog", async () => {
    let capturedFilters: Parameters<AuditLogRouteDeps["list"]>[0] | undefined;
    const deps = createDeps({
      list: async (filters) => {
        capturedFilters = filters;
        return [];
      },
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?from=2025-01-01T00:00:00Z&to=2025-12-31T23:59:59Z"),
      adminUser,
      deps,
    );

    assert.equal(response.status, 200);
    assert.ok(capturedFilters?.from instanceof Date, "from should be a Date");
    assert.ok(capturedFilters?.to instanceof Date, "to should be a Date");
    assert.equal(capturedFilters!.from!.toISOString(), "2025-01-01T00:00:00.000Z");
    assert.equal(capturedFilters!.to!.toISOString(), "2025-12-31T23:59:59.000Z");
  });

  it("Scenario 2.2: invalid from value returns 400 with field error", async () => {
    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?from=not-a-date"),
      adminUser,
      createDeps(),
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { errors: Array<{ field: string }> };
    assert.ok(body.errors.some((e) => e.field === "from"), "errors should include from field");
  });

  it("Scenario 2.3: to without from is valid (200)", async () => {
    let capturedFilters: Parameters<AuditLogRouteDeps["list"]>[0] | undefined;
    const deps = createDeps({
      list: async (filters) => {
        capturedFilters = filters;
        return [];
      },
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?to=2025-06-01T00:00:00Z"),
      adminUser,
      deps,
    );

    assert.equal(response.status, 200);
    assert.equal(capturedFilters?.from, undefined, "from should be undefined");
    assert.ok(capturedFilters?.to instanceof Date, "to should be a Date");
  });
});

describe("GET /api/admin/audit-log — action guard", () => {
  it("Scenario 3.1: valid action=UPDATE is accepted (200) and forwarded", async () => {
    let capturedFilters: Parameters<AuditLogRouteDeps["list"]>[0] | undefined;
    const deps = createDeps({
      list: async (filters) => {
        capturedFilters = filters;
        return [];
      },
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?action=UPDATE"),
      adminUser,
      deps,
    );

    assert.equal(response.status, 200);
    assert.equal(capturedFilters?.action, "UPDATE");
  });

  it("Scenario 3.2: invalid action=DESTROY returns 400 with field error", async () => {
    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?action=DESTROY"),
      adminUser,
      createDeps(),
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { errors: Array<{ field: string }> };
    assert.ok(body.errors.some((e) => e.field === "action"), "errors should include action field");
  });

  it("Scenario 3.3: missing action passes through as undefined", async () => {
    let capturedFilters: Parameters<AuditLogRouteDeps["list"]>[0] | undefined;
    const deps = createDeps({
      list: async (filters) => {
        capturedFilters = filters;
        return [];
      },
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log"),
      adminUser,
      deps,
    );

    assert.equal(response.status, 200);
    assert.equal(capturedFilters?.action, undefined);
  });
});
