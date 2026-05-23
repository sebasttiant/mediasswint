import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type AuthUser } from "../lib/auth";
import { type AuthedHandler, withAdminAuth, withAuth } from "../lib/with-auth";

const adminUser: AuthUser = {
  id: "admin-1",
  email: "admin@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Admin User",
  role: "ADMIN",
};

const staffUser: AuthUser = {
  id: "staff-1",
  email: "staff@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Staff User",
  role: "STAFF",
};

function buildRequest() {
  return new Request("http://localhost/api/anything");
}

function emptyCtx() {
  return { params: Promise.resolve({}) };
}

describe("withAuth", () => {
  it("returns 401 with lowercase 'unauthorized' when requireUser resolves null", async () => {
    const handler: AuthedHandler = async () => new Response("must not run", { status: 500 });
    const wrapped = withAuth(handler, { requireUser: async () => null });

    const response = await wrapped(buildRequest(), emptyCtx());

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("invokes the handler with the authenticated user when requireUser resolves a user", async () => {
    let receivedUser: AuthUser | null = null;
    const handler: AuthedHandler = async (_request, _ctx, { user }) => {
      receivedUser = user;
      return Response.json({ ok: true });
    };
    const wrapped = withAuth(handler, { requireUser: async () => staffUser });

    const response = await wrapped(buildRequest(), emptyCtx());

    assert.equal(response.status, 200);
    assert.equal(receivedUser, staffUser);
  });

  it("forwards the context to the handler verbatim", async () => {
    type RouteCtx = { params: Promise<{ id: string }> };
    let receivedCtx: RouteCtx | null = null;

    const handler: AuthedHandler<RouteCtx> = async (_request, ctx) => {
      receivedCtx = ctx;
      const { id } = await ctx.params;
      return Response.json({ id });
    };
    const wrapped = withAuth<RouteCtx>(handler, { requireUser: async () => staffUser });
    const ctx: RouteCtx = { params: Promise.resolve({ id: "pat-1" }) };

    const response = await wrapped(buildRequest(), ctx);
    const payload = (await response.json()) as { id: string };

    assert.equal(receivedCtx, ctx);
    assert.equal(payload.id, "pat-1");
  });

  it("does not invoke the handler when requireUser resolves null", async () => {
    let handlerCalled = false;
    const handler: AuthedHandler = async () => {
      handlerCalled = true;
      return new Response("must not run", { status: 500 });
    };
    const wrapped = withAuth(handler, { requireUser: async () => null });

    await wrapped(buildRequest(), emptyCtx());

    assert.equal(handlerCalled, false);
  });

  it("uses requireActiveUserFromRequest by default when no override is given", async () => {
    // With no AUTH_SECRET trickery and no cookie, the default requireUser must
    // resolve null and the wrapper must produce the 401 contract response.
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "with-auth-default-test-secret";

    try {
      const handler: AuthedHandler = async () => new Response("must not run", { status: 500 });
      const wrapped = withAuth(handler);

      const response = await wrapped(buildRequest(), emptyCtx());

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    } finally {
      process.env.AUTH_SECRET = previous;
    }
  });
});

describe("withAdminAuth", () => {
  it("returns 401 (not 403) when requireUser resolves null", async () => {
    const handler: AuthedHandler = async () => new Response("must not run", { status: 500 });
    const wrapped = withAdminAuth(handler, { requireUser: async () => null });

    const response = await wrapped(buildRequest(), emptyCtx());

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("returns 403 with 'forbidden' when the user is not an admin", async () => {
    const handler: AuthedHandler = async () => new Response("must not run", { status: 500 });
    const wrapped = withAdminAuth(handler, { requireUser: async () => staffUser });

    const response = await wrapped(buildRequest(), emptyCtx());

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "forbidden" });
  });

  it("invokes the handler with the admin user when the role check passes", async () => {
    let receivedUser: AuthUser | null = null;
    const handler: AuthedHandler = async (_request, _ctx, { user }) => {
      receivedUser = user;
      return Response.json({ ok: true });
    };
    const wrapped = withAdminAuth(handler, { requireUser: async () => adminUser });

    const response = await wrapped(buildRequest(), emptyCtx());

    assert.equal(response.status, 200);
    assert.equal(receivedUser, adminUser);
  });

  it("does not invoke the handler when the user is not admin", async () => {
    let handlerCalled = false;
    const handler: AuthedHandler = async () => {
      handlerCalled = true;
      return new Response("must not run", { status: 500 });
    };
    const wrapped = withAdminAuth(handler, { requireUser: async () => staffUser });

    await wrapped(buildRequest(), emptyCtx());

    assert.equal(handlerCalled, false);
  });

  it("forwards context to the handler when the role check passes", async () => {
    type RouteCtx = { params: Promise<{ id: string }> };
    let receivedCtx: RouteCtx | null = null;

    const handler: AuthedHandler<RouteCtx> = async (_request, ctx) => {
      receivedCtx = ctx;
      const { id } = await ctx.params;
      return Response.json({ id });
    };
    const wrapped = withAdminAuth<RouteCtx>(handler, { requireUser: async () => adminUser });
    const ctx: RouteCtx = { params: Promise.resolve({ id: "pat-1" }) };

    const response = await wrapped(buildRequest(), ctx);
    const payload = (await response.json()) as { id: string };

    assert.equal(receivedCtx, ctx);
    assert.equal(payload.id, "pat-1");
  });
});
