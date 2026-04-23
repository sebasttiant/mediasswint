import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createSessionToken,
  getCookieValue,
  getSessionCookieName,
  verifySessionToken,
} from "../lib/auth";

describe("auth session token", () => {
  it("creates and verifies a valid token", async () => {
    process.env.AUTH_SECRET = "test-secret";

    const token = await createSessionToken("admin");
    const payload = await verifySessionToken(token);

    assert.equal(payload?.sub, "admin");
    assert.equal(typeof payload?.exp, "number");
  });

  it("returns null for invalid signature", async () => {
    process.env.AUTH_SECRET = "test-secret";

    const token = await createSessionToken("admin");
    const invalidToken = `${token}corrupted`;
    const payload = await verifySessionToken(invalidToken);

    assert.equal(payload, null);
  });
});

describe("cookie parser", () => {
  it("extracts session cookie value from header", () => {
    const cookieName = getSessionCookieName();
    const header = `a=1; ${cookieName}=abc123; theme=dark`;

    const value = getCookieValue(header, cookieName);
    assert.equal(value, "abc123");
  });
});
