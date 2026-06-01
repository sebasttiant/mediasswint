import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type AuthUser } from "@/lib/auth";
import {
  handleGetAuditLogRequest,
  type AuditLogRouteDeps,
} from "@/app/api/admin/audit-log/route";
import type { AuditLogRow } from "@/lib/audit-log";
import type { GetAuditLogsResponse } from "@/app/api/admin/audit-log/route";

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
    user: null,
    ...overrides,
  };
}

function makeRequest(url: string): Request {
  return new Request(`http://localhost${url}`);
}

function createDeps(overrides: Partial<AuditLogRouteDeps> = {}): AuditLogRouteDeps {
  return {
    list: async () => ({ rows: [makeRow()], total: 1 }),
    ...overrides,
  };
}

describe("GET /api/admin/audit-log — pagination (skip / total / hasMore)", () => {
  it("Scenario 1.1: page=2 passes correct skip to the data layer", async () => {
    let capturedFilters: Parameters<AuditLogRouteDeps["list"]>[0] | undefined;
    const deps = createDeps({
      list: async (filters) => {
        capturedFilters = filters;
        return { rows: [], total: 0 };
      },
    });

    await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?page=2&limit=10"),
      adminUser,
      deps,
    );

    assert.equal(capturedFilters?.skip, 10, "skip should be (page-1)*limit = 10");
  });

  it("Scenario 1.2: page=2 does not return page 1 rows (distinct skip applied)", async () => {
    const page1Rows = [
      makeRow({ id: "log-1", entityId: "p1" }),
      makeRow({ id: "log-2", entityId: "p2" }),
    ];
    const page2Rows = [makeRow({ id: "log-3", entityId: "p3" })];

    const deps = createDeps({
      list: async (filters) => {
        // Simulate DB-side pagination: page 1 skip=0, page 2 skip=2
        if ((filters.skip ?? 0) === 0) {
          return { rows: page1Rows, total: 3 };
        }
        return { rows: page2Rows, total: 3 };
      },
    });

    const res2 = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?page=2&limit=2"),
      adminUser,
      deps,
    );
    const body2 = (await res2.json()) as GetAuditLogsResponse;

    assert.equal(body2.auditLogs.length, 1);
    assert.equal(body2.auditLogs[0].id, "log-3", "page 2 should return log-3, not page 1 rows");
  });

  it("Scenario 1.3: total reflects real DB count, not page length", async () => {
    const deps = createDeps({
      list: async () => ({
        rows: [makeRow()], // only 1 row in page
        total: 50,         // but 50 total in DB
      }),
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?page=1&limit=20"),
      adminUser,
      deps,
    );
    const body = (await response.json()) as GetAuditLogsResponse;

    assert.equal(body.total, 50, "total should be 50 (from DB), not 1 (page length)");
  });

  it("Scenario 1.4: hasMore is true when total exceeds current page coverage", async () => {
    const deps = createDeps({
      list: async () => ({
        rows: [makeRow({ id: "log-1" }), makeRow({ id: "log-2" })],
        total: 5,
      }),
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?page=1&limit=2"),
      adminUser,
      deps,
    );
    const body = (await response.json()) as GetAuditLogsResponse;

    assert.equal(body.hasMore, true, "hasMore should be true when total=5 > skip(0)+rows(2)");
  });

  it("Scenario 1.5: hasMore is false on the last page", async () => {
    const deps = createDeps({
      list: async () => ({
        rows: [makeRow({ id: "log-5" })],
        total: 5,
      }),
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log?page=3&limit=2"),
      adminUser,
      deps,
    );
    const body = (await response.json()) as GetAuditLogsResponse;

    // page=3, limit=2 → skip=4, skip+rows.length=5, total=5 → no more
    assert.equal(body.hasMore, false, "hasMore should be false on last page");
  });
});

describe("GET /api/admin/audit-log — user relation", () => {
  it("Scenario 4.1: user is populated when the row carries a user relation", async () => {
    const deps = createDeps({
      list: async () => ({
        rows: [
          makeRow({
            user: { id: "u-1", email: "alice@test.com", fullName: "Alice" },
          }),
        ],
        total: 1,
      }),
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log"),
      adminUser,
      deps,
    );
    const body = (await response.json()) as GetAuditLogsResponse;

    assert.deepEqual(body.auditLogs[0].user, {
      id: "u-1",
      email: "alice@test.com",
      fullName: "Alice",
    });
  });

  it("Scenario 4.2: user is null when the row has no user relation", async () => {
    const deps = createDeps({
      list: async () => ({
        rows: [makeRow({ userId: null, user: null })],
        total: 1,
      }),
    });

    const response = await handleGetAuditLogRequest(
      makeRequest("/api/admin/audit-log"),
      adminUser,
      deps,
    );
    const body = (await response.json()) as GetAuditLogsResponse;

    assert.equal(body.auditLogs[0].user, null);
  });
});

describe("GET /api/admin/audit-log — from/to date filter", () => {
  it("Scenario 2.1: forwards valid from+to as Date objects to listAuditLog", async () => {
    let capturedFilters: Parameters<AuditLogRouteDeps["list"]>[0] | undefined;
    const deps = createDeps({
      list: async (filters) => {
        capturedFilters = filters;
        return { rows: [], total: 0 };
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
        return { rows: [], total: 0 };
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
        return { rows: [], total: 0 };
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
        return { rows: [], total: 0 };
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
