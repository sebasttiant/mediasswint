import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseCreateUserInput,
  parseUpdateUserPatchInput,
  parseListUsersQuery,
} from "@/lib/users-input";

// ---------------------------------------------------------------------------
// parseCreateUserInput
// ---------------------------------------------------------------------------

describe("parseCreateUserInput", () => {
  it("Scenario 15.1: happy path — all fields valid returns ok", () => {
    const result = parseCreateUserInput({
      email: "alice@example.com",
      fullName: "Alice Doe",
      role: "STAFF",
      password: "secure123",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.email, "alice@example.com");
    assert.equal(result.value.fullName, "Alice Doe");
    assert.equal(result.value.role, "STAFF");
    assert.equal(result.value.password, "secure123");
  });

  it("Scenario 5.3: rejects empty fullName", () => {
    const result = parseCreateUserInput({
      email: "x@x.com",
      fullName: "",
      role: "STAFF",
      password: "12345678",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.errors.some((e) => e.field === "fullName"),
      "errors should include fullName",
    );
  });

  it("Scenario 5.4: rejects password shorter than 8 characters", () => {
    const result = parseCreateUserInput({
      email: "x@x.com",
      fullName: "Alice",
      role: "STAFF",
      password: "short",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.errors.some((e) => e.field === "password"),
      "errors should include password",
    );
  });

  it("Scenario 5.5: rejects invalid email format", () => {
    const result = parseCreateUserInput({
      email: "not-an-email",
      fullName: "Alice",
      role: "STAFF",
      password: "secure123",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.errors.some((e) => e.field === "email"),
      "errors should include email",
    );
  });

  it("Scenario 5.6: rejects unknown role (e.g. SUPERUSER)", () => {
    const result = parseCreateUserInput({
      email: "x@x.com",
      fullName: "Alice",
      role: "SUPERUSER",
      password: "secure123",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.errors.some((e) => e.field === "role"),
      "errors should include role",
    );
  });

  it("accumulates multiple validation errors", () => {
    const result = parseCreateUserInput({
      email: "bad",
      fullName: "",
      role: "SUPERUSER",
      password: "short",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.length >= 3, "should have multiple errors");
  });
});

// ---------------------------------------------------------------------------
// parseUpdateUserPatchInput
// ---------------------------------------------------------------------------

describe("parseUpdateUserPatchInput", () => {
  it("Scenario 15.2: accepts { role } only", () => {
    const result = parseUpdateUserPatchInput({ role: "ADMIN" });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.role, "ADMIN");
    assert.equal("isActive" in result.value, false);
  });

  it("accepts { isActive } only", () => {
    const result = parseUpdateUserPatchInput({ isActive: false });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.isActive, false);
    assert.equal("role" in result.value, false);
  });

  it("accepts { role, isActive } together", () => {
    const result = parseUpdateUserPatchInput({ role: "STAFF", isActive: true });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.role, "STAFF");
    assert.equal(result.value.isActive, true);
  });

  it("Scenario 15.3: rejects unknown fields (e.g. { email })", () => {
    const result = parseUpdateUserPatchInput({ email: "hacker@test.com" });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.errors.some((e) => e.field === "email"),
      "errors should include the unknown field",
    );
  });

  it("rejects { isActive: 'yes' } (non-boolean)", () => {
    const result = parseUpdateUserPatchInput({ isActive: "yes" });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.errors.some((e) => e.field === "isActive"),
      "errors should include isActive",
    );
  });

  it("rejects empty body (no valid fields)", () => {
    const result = parseUpdateUserPatchInput({});

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.length >= 1, "should have at least one error");
  });

  it("rejects non-object body", () => {
    const result = parseUpdateUserPatchInput("not-an-object");

    assert.equal(result.ok, false);
  });
});

// ---------------------------------------------------------------------------
// parseListUsersQuery
// ---------------------------------------------------------------------------

describe("parseListUsersQuery", () => {
  it("Scenario 15.4: defaults limit to 20 with empty params", () => {
    const result = parseListUsersQuery(new URLSearchParams());

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.limit, 20);
    assert.equal(result.value.q, null);
  });

  it("accepts a valid q and limit", () => {
    const result = parseListUsersQuery(new URLSearchParams("?q=alice&limit=50"));

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.q, "alice");
    assert.equal(result.value.limit, 50);
  });

  it("rejects limit > 100", () => {
    const result = parseListUsersQuery(new URLSearchParams("?limit=101"));

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.errors.some((e) => e.field === "limit"),
      "errors should include limit",
    );
  });

  it("rejects non-integer limit", () => {
    const result = parseListUsersQuery(new URLSearchParams("?limit=abc"));

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(
      result.errors.some((e) => e.field === "limit"),
      "errors should include limit",
    );
  });

  it("trims q and returns null for blank query", () => {
    const result = parseListUsersQuery(new URLSearchParams("?q=   "));

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.q, null);
  });
});
