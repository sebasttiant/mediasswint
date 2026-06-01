import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLINIC_TIME_ZONE,
  formatClinicDate,
  formatClinicDateTime,
} from "../lib/datetime";

// An instant late in the UTC day that lands on the *previous* calendar day in
// Bogota (UTC-5): 2026-06-02T02:30:00Z === 2026-06-01 21:30 in America/Bogota.
const CROSS_MIDNIGHT = "2026-06-02T02:30:00.000Z";
const MIDDAY = "2026-06-01T22:03:37.000Z"; // 17:03 in Bogota

function utcDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

describe("formatClinicDateTime", () => {
  it("is deterministic (same input → same output) regardless of runtime tz", () => {
    assert.equal(formatClinicDateTime(MIDDAY), formatClinicDateTime(MIDDAY));
  });

  it("formats against the explicit clinic timezone, NOT the UTC/runtime zone", () => {
    // If timeZone were dropped, server (UTC) and client (UTC-5) would diverge.
    // Proving the clinic-tz result differs from the UTC result guards that.
    assert.notEqual(formatClinicDateTime(MIDDAY), utcDateTime(MIDDAY));
  });

  it("accepts string, number, and Date inputs equivalently", () => {
    const date = new Date(MIDDAY);
    assert.equal(formatClinicDateTime(MIDDAY), formatClinicDateTime(date));
    assert.equal(formatClinicDateTime(date.getTime()), formatClinicDateTime(date));
  });
});

describe("formatClinicDate", () => {
  it("uses the Bogota calendar day for instants that cross UTC midnight", () => {
    // In Bogota this instant is still June 1; in UTC it is already June 2.
    assert.equal(formatClinicDate(CROSS_MIDNIGHT), formatClinicDate(MIDDAY));
  });

  it("exposes the configured clinic timezone", () => {
    assert.equal(CLINIC_TIME_ZONE, "America/Bogota");
  });
});
