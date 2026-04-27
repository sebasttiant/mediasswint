import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionCookieName } from "../lib/auth";
import { handleLoginRequest, type LoginDeps } from "../app/api/auth/login/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function buildAuthUser(overrides?: Partial<{ id: string; email: string; passwordHash: string; isActive: boolean }>) {
  return {
    id: overrides?.id ?? "user-1",
    email: overrides?.email ?? "admin@mediasswint.test",
    passwordHash: overrides?.passwordHash ?? "hash",
    isActive: overrides?.isActive ?? true,
  };
}

function buildDeps(overrides: Partial<LoginDeps> = {}): LoginDeps {
  return {
    authenticate: async () => null,
    createToken: async (subject: string) => `token-for-${subject}`,
    ...overrides,
  };
}

describe("handleLoginRequest", () => {
  it("returns 400 when the body is not valid JSON", async () => {
    const response = await handleLoginRequest(jsonRequest("not-json"), buildDeps());

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { error?: string };
    assert.equal(typeof payload.error, "string");
    assert.equal(response.headers.get("set-cookie"), null);
  });

  it("returns 400 when user or password is missing", async () => {
    const response = await handleLoginRequest(jsonRequest({ user: "", password: "" }), buildDeps());

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("set-cookie"), null);
  });

  it("returns 401 when credentials are invalid", async () => {
    const deps = buildDeps({ authenticate: async () => null });

    const response = await handleLoginRequest(
      jsonRequest({ user: "someone@mediasswint.test", password: "wrong" }),
      deps,
    );

    assert.equal(response.status, 401);
    const payload = (await response.json()) as { error?: string };
    assert.equal(typeof payload.error, "string");
    assert.equal(response.headers.get("set-cookie"), null);
  });

  it("returns 401 when the authenticated user is inactive", async () => {
    const deps = buildDeps({
      authenticate: async () => null,
    });

    const response = await handleLoginRequest(
      jsonRequest({ user: "inactive@mediasswint.test", password: "secret123" }),
      deps,
    );

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
  });

  it("returns 401 when authenticate throws", async () => {
    const deps = buildDeps({
      authenticate: async () => {
        throw new Error("db down");
      },
    });

    const response = await handleLoginRequest(
      jsonRequest({ user: "someone@mediasswint.test", password: "x" }),
      deps,
    );

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
  });

  it("returns 200 with a session cookie using persisted user.id on success", async () => {
    const persistedUser = buildAuthUser({ id: "user-abc" });
    const deps = buildDeps({
      authenticate: async () => persistedUser,
    });

    const response = await handleLoginRequest(
      jsonRequest({ user: persistedUser.email, password: "secret123" }),
      deps,
    );

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { ok?: boolean };
    assert.equal(payload.ok, true);

    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie, "expected set-cookie header");
    assert.ok(setCookie!.includes(`${getSessionCookieName()}=token-for-${persistedUser.id}`));
    assert.ok(setCookie!.toLowerCase().includes("httponly"));
  });
});
