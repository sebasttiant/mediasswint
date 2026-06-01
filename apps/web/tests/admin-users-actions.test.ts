import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SafeUser } from "../lib/users";
import {
  authorizeAndSetActive,
  authorizeAndUpdateRole,
} from "../app/admin/users/user-actions-core";

function safeUserFixture(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: "user-1",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    role: "STAFF",
    isActive: true,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

function formDataFrom(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const ADMIN = { id: "admin-1", role: "ADMIN" as const };
const STAFF = { id: "staff-1", role: "STAFF" as const };

describe("authorizeAndUpdateRole security boundary", () => {
  it("does not call updateRole for STAFF actors", async () => {
    let called = false;
    const state = await authorizeAndUpdateRole(formDataFrom({ userId: "u-2", role: "ADMIN" }), {
      readUser: async () => STAFF,
      updateRoleFn: async () => {
        called = true;
        return { ok: true as const, value: safeUserFixture() };
      },
    });
    assert.equal(called, false);
    assert.equal(state.status, "error");
  });

  it("does not call updateRole for anonymous actors", async () => {
    let called = false;
    const state = await authorizeAndUpdateRole(formDataFrom({ userId: "u-2", role: "ADMIN" }), {
      readUser: async () => null,
      updateRoleFn: async () => {
        called = true;
        return { ok: true as const, value: safeUserFixture() };
      },
    });
    assert.equal(called, false);
    assert.equal(state.status, "error");
  });

  it("updates role for ADMIN actors, passing the actor id", async () => {
    const calls: Array<[string, string, string]> = [];
    const state = await authorizeAndUpdateRole(formDataFrom({ userId: "u-2", role: "ADMIN" }), {
      readUser: async () => ADMIN,
      updateRoleFn: async (id, role, actorId) => {
        calls.push([id, role, actorId]);
        return { ok: true as const, value: safeUserFixture({ id, role }) };
      },
    });
    assert.deepEqual(calls, [["u-2", "ADMIN", "admin-1"]]);
    assert.equal(state.status, "success");
  });

  it("maps a CONFLICT result to a self-lockout message", async () => {
    const state = await authorizeAndUpdateRole(formDataFrom({ userId: "admin-1", role: "STAFF" }), {
      readUser: async () => ADMIN,
      updateRoleFn: async () => ({ ok: false as const, error: "CONFLICT" }),
    });
    assert.equal(state.status, "error");
    assert.match(state.message ?? "", /administrador/i);
  });

  it("rejects an invalid role without calling updateRole", async () => {
    let called = false;
    const state = await authorizeAndUpdateRole(formDataFrom({ userId: "u-2", role: "OWNER" }), {
      readUser: async () => ADMIN,
      updateRoleFn: async () => {
        called = true;
        return { ok: true as const, value: safeUserFixture() };
      },
    });
    assert.equal(called, false);
    assert.equal(state.status, "error");
  });
});

describe("authorizeAndSetActive security boundary", () => {
  it("does not call setActive for STAFF actors", async () => {
    let called = false;
    const state = await authorizeAndSetActive(formDataFrom({ userId: "u-2", isActive: "false" }), {
      readUser: async () => STAFF,
      setActiveFn: async () => {
        called = true;
        return { ok: true as const, value: safeUserFixture() };
      },
    });
    assert.equal(called, false);
    assert.equal(state.status, "error");
  });

  it("toggles active state for ADMIN actors, passing the actor id", async () => {
    const calls: Array<[string, boolean, string]> = [];
    const state = await authorizeAndSetActive(formDataFrom({ userId: "u-2", isActive: "false" }), {
      readUser: async () => ADMIN,
      setActiveFn: async (id, isActive, actorId) => {
        calls.push([id, isActive, actorId]);
        return { ok: true as const, value: safeUserFixture({ id, isActive }) };
      },
    });
    assert.deepEqual(calls, [["u-2", false, "admin-1"]]);
    assert.equal(state.status, "success");
  });

  it("maps a CONFLICT result (self-lockout) to a protective message", async () => {
    const state = await authorizeAndSetActive(
      formDataFrom({ userId: "admin-1", isActive: "false" }),
      {
        readUser: async () => ADMIN,
        setActiveFn: async () => ({ ok: false as const, error: "CONFLICT" }),
      },
    );
    assert.equal(state.status, "error");
    assert.match(state.message ?? "", /administrador/i);
  });
});
