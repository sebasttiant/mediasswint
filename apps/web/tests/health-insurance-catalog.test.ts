import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COLOMBIA_HEALTH_INSURERS, HEALTH_INSURANCE_OTHER } from "../lib/health-insurance-catalog";

describe("COLOMBIA_HEALTH_INSURERS", () => {
  it("is non-empty", () => {
    assert.ok(COLOMBIA_HEALTH_INSURERS.length > 0);
  });

  it("has no duplicate entries", () => {
    const unique = new Set(COLOMBIA_HEALTH_INSURERS);
    assert.equal(unique.size, COLOMBIA_HEALTH_INSURERS.length);
  });

  it("contains expected Colombian EPS entries", () => {
    assert.ok(COLOMBIA_HEALTH_INSURERS.includes("Nueva EPS"));
    assert.ok(COLOMBIA_HEALTH_INSURERS.includes("Sura EPS"));
    assert.ok(COLOMBIA_HEALTH_INSURERS.includes("EPS Sanitas"));
    assert.ok(COLOMBIA_HEALTH_INSURERS.includes("Compensar EPS"));
  });

  it("all entries are non-empty strings", () => {
    for (const entry of COLOMBIA_HEALTH_INSURERS) {
      assert.ok(typeof entry === "string" && entry.trim().length > 0, `entry should be non-empty: ${entry}`);
    }
  });

  it("exports HEALTH_INSURANCE_OTHER sentinel as a non-empty string", () => {
    assert.ok(typeof HEALTH_INSURANCE_OTHER === "string" && HEALTH_INSURANCE_OTHER.length > 0);
  });

  it("HEALTH_INSURANCE_OTHER is not in the main list", () => {
    assert.ok(!COLOMBIA_HEALTH_INSURERS.includes(HEALTH_INSURANCE_OTHER));
  });
});
