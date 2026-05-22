import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { createSessionToken, getSessionCookieName } from "../lib/auth";
import { middleware, config } from "../middleware";

/** Build a NextRequest for the given path, optionally with a session cookie. */
function makeRequest(pathname: string, token?: string): NextRequest {
  const url = `http://localhost${pathname}`;
  const headers: Record<string, string> = {};

  if (token !== undefined) {
    headers["cookie"] = `${getSessionCookieName()}=${encodeURIComponent(token)}`;
  }

  return new NextRequest(url, { headers });
}

describe("middleware — token verification", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-middleware-secret";
  });

  it("redirects to /login when no session cookie is present", async () => {
    const req = makeRequest("/dashboard");
    const res = await middleware(req);

    assert.equal(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.startsWith("http://localhost/login"), `expected /login redirect, got ${location}`);
    assert.ok(location?.includes("next=%2Fdashboard"), `expected next param, got ${location}`);
  });

  it("redirects to /login when the session cookie has an invalid token", async () => {
    const req = makeRequest("/patients", "this.is.not.a.valid.token");
    const res = await middleware(req);

    assert.equal(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login"), `expected /login redirect, got ${location}`);
  });

  it("redirects to /login when the session token signature is tampered with", async () => {
    const token = await createSessionToken("user-1");
    const tampered = token + "corrupted";

    const req = makeRequest("/patients", tampered);
    const res = await middleware(req);

    assert.equal(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login"), `expected /login redirect, got ${location}`);
  });

  it("redirects to /login when the session token is expired", async () => {
    // Build a token with exp in the past by encoding the payload manually.
    const secret = process.env.AUTH_SECRET!;
    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

    const payload = JSON.stringify({ sub: "user-expired", exp: Math.floor(Date.now() / 1000) - 60 });
    const encoded = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

    const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

    const expiredToken = `${encoded}.${sig}`;
    const req = makeRequest("/patients", expiredToken);
    const res = await middleware(req);

    assert.equal(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login"), `expected /login redirect, got ${location}`);
  });

  it("allows the request through when the session token is valid", async () => {
    const token = await createSessionToken("user-123");
    const req = makeRequest("/dashboard", token);
    const res = await middleware(req);

    // NextResponse.next() returns a 200-type response (no redirect)
    assert.notEqual(res.status, 307);
    assert.notEqual(res.status, 302);
    assert.equal(res.headers.get("location"), null);
  });

  it("preserves the original pathname in the next query param on redirect", async () => {
    const req = makeRequest("/patients/abc-123/measurements/new");
    const res = await middleware(req);

    assert.equal(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(
      location?.includes("next=%2Fpatients%2Fabc-123%2Fmeasurements%2Fnew"),
      `expected encoded next param, got ${location}`,
    );
  });

  it("returns 401 JSON for unauthenticated API requests (no redirect)", async () => {
    const req = makeRequest("/api/patients");
    const res = await middleware(req);

    assert.equal(res.status, 401);
    assert.equal(res.headers.get("location"), null);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "unauthorized");
  });

  it("returns 401 JSON for nested API paths", async () => {
    const req = makeRequest("/api/patients/abc-123/measurements");
    const res = await middleware(req);

    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "unauthorized");
  });

  it("returns 401 JSON for API requests with an invalid token", async () => {
    const req = makeRequest("/api/patients", "not.a.valid.token");
    const res = await middleware(req);

    assert.equal(res.status, 401);
  });
});

describe("middleware — matcher config", () => {
  /**
   * The Next.js matcher string uses a path-to-regexp negative lookahead.
   * Pattern: "/((?!<exclusions>).*)"
   *
   * We extract the exclusion group from the pattern and build a RegExp that
   * matches paths which SHOULD be excluded (i.e. the lookahead condition is
   * true), so we can assert those paths are NOT intercepted.
   */
  function buildExclusionRegex(pattern: string): RegExp {
    // Extract the content of the negative lookahead: (?!<exclusions>)
    const lookaheadMatch = /\(\?!([^)]+)\)/.exec(pattern);
    if (!lookaheadMatch) throw new Error(`Could not extract exclusions from pattern: ${pattern}`);
    // Build a regex that matches when the path starts with one of the excluded prefixes
    return new RegExp(`^/(?:${lookaheadMatch[1]})`);
  }

  function isExcluded(pathname: string): boolean {
    const [pattern] = config.matcher as [string];
    const exclusionRe = buildExclusionRegex(pattern);
    return exclusionRe.test(pathname);
  }

  it("excludes /login from middleware matching", () => {
    assert.equal(isExcluded("/login"), true);
  });

  it("excludes /api/auth/login from middleware matching", () => {
    assert.equal(isExcluded("/api/auth/login"), true);
  });

  it("excludes /api/health from middleware matching", () => {
    assert.equal(isExcluded("/api/health"), true);
  });

  it("excludes /_next/static assets from middleware matching", () => {
    assert.equal(isExcluded("/_next/static/chunks/main.js"), true);
  });

  it("excludes /_next/image from middleware matching", () => {
    assert.equal(isExcluded("/_next/image"), true);
  });

  it("includes /dashboard in middleware matching (should be intercepted)", () => {
    assert.equal(isExcluded("/dashboard"), false);
  });

  it("includes /patients in middleware matching (should be intercepted)", () => {
    assert.equal(isExcluded("/patients"), false);
  });
});
