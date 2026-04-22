import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getHealthHttpStatus, type HealthPayload } from "../lib/health";

function createPayload(overrides: Partial<HealthPayload["services"]>): HealthPayload {
  return {
    app: { ok: true },
    services: {
      postgres: { ok: true, latency_ms: 5 },
      redis: { ok: true, latency_ms: 4 },
      ...overrides,
    },
  };
}

describe("getHealthHttpStatus", () => {
  it("returns 200 when all services are healthy", () => {
    const payload = createPayload({});
    assert.equal(getHealthHttpStatus(payload), 200);
  });

  it("returns 503 when postgres is down", () => {
    const payload = createPayload({ postgres: { ok: false, error: "connection refused" } });
    assert.equal(getHealthHttpStatus(payload), 503);
  });

  it("returns 503 when redis is down", () => {
    const payload = createPayload({ redis: { ok: false, error: "timeout" } });
    assert.equal(getHealthHttpStatus(payload), 503);
  });
});
