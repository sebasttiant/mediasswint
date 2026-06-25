import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeAge, ageToApproxBirthDate, formatISODate } from "../lib/patient-age";

describe("computeAge", () => {
  it("returns the correct whole years when birthday was reached this year", () => {
    // born 1990-03-15, now 2026-03-15 → exactly 36
    const dob = new Date(Date.UTC(1990, 2, 15));
    const now = new Date(Date.UTC(2026, 2, 15));
    assert.equal(computeAge(dob, now), 36);
  });

  it("returns age minus 1 when birthday has not yet occurred this year", () => {
    // born 1990-03-15, now 2026-03-14 → still 35
    const dob = new Date(Date.UTC(1990, 2, 15));
    const now = new Date(Date.UTC(2026, 2, 14));
    assert.equal(computeAge(dob, now), 35);
  });

  it("returns correct age when birthday is today (same month and day)", () => {
    // born 2000-06-24, now 2026-06-24 → exactly 26
    const dob = new Date(Date.UTC(2000, 5, 24));
    const now = new Date(Date.UTC(2026, 5, 24));
    assert.equal(computeAge(dob, now), 26);
  });

  it("handles leap year birth date (Feb 29) correctly", () => {
    // born 1992-02-29, now 2026-03-01 → 34 (passed the anniversary)
    const dob = new Date(Date.UTC(1992, 1, 29));
    const now = new Date(Date.UTC(2026, 2, 1));
    assert.equal(computeAge(dob, now), 34);
  });

  it("handles leap year birth date (Feb 29) before anniversary in a non-leap year", () => {
    // born 1992-02-29, now 2026-02-28 → 33 (haven't crossed Feb 29 yet)
    const dob = new Date(Date.UTC(1992, 1, 29));
    const now = new Date(Date.UTC(2026, 1, 28));
    assert.equal(computeAge(dob, now), 33);
  });

  it("clamps to 0 for a future birth date", () => {
    const dob = new Date(Date.UTC(2030, 0, 1));
    const now = new Date(Date.UTC(2026, 5, 24));
    assert.equal(computeAge(dob, now), 0);
  });

  it("returns 0 when birth date equals now", () => {
    const dob = new Date(Date.UTC(2026, 5, 24));
    const now = new Date(Date.UTC(2026, 5, 24));
    assert.equal(computeAge(dob, now), 0);
  });

  it("uses the current date as default for now", () => {
    // A very old birth date must yield a positive age with default now
    const dob = new Date(Date.UTC(1900, 0, 1));
    const age = computeAge(dob);
    assert.ok(age > 100);
  });
});

describe("ageToApproxBirthDate", () => {
  it("returns July 1 of (currentYear - age) as a UTC date", () => {
    const now = new Date(Date.UTC(2026, 5, 24));
    const result = ageToApproxBirthDate(30, now);
    assert.equal(result.getUTCFullYear(), 1996);
    assert.equal(result.getUTCMonth(), 6); // July = month index 6
    assert.equal(result.getUTCDate(), 1);
  });

  it("handles age 0", () => {
    const now = new Date(Date.UTC(2026, 5, 24));
    const result = ageToApproxBirthDate(0, now);
    assert.equal(result.getUTCFullYear(), 2026);
    assert.equal(result.getUTCMonth(), 6);
    assert.equal(result.getUTCDate(), 1);
  });

  it("round-trips with computeAge within ±1 year", () => {
    const now = new Date(Date.UTC(2026, 5, 24));
    const age = 45;
    const approxDob = ageToApproxBirthDate(age, now);
    const roundTripped = computeAge(approxDob, now);
    assert.ok(
      Math.abs(roundTripped - age) <= 1,
      `Expected round-tripped age ${roundTripped} to be within ±1 of ${age}`,
    );
  });

  it("uses the current date as default for now", () => {
    const result = ageToApproxBirthDate(25);
    const expectedYear = new Date().getUTCFullYear() - 25;
    assert.equal(result.getUTCFullYear(), expectedYear);
  });
});

describe("formatISODate", () => {
  it("formats a known UTC date as YYYY-MM-DD", () => {
    const date = new Date(Date.UTC(1994, 10, 20)); // 1994-11-20
    assert.equal(formatISODate(date), "1994-11-20");
  });

  it("zero-pads month and day", () => {
    const date = new Date(Date.UTC(2000, 0, 5)); // 2000-01-05
    assert.equal(formatISODate(date), "2000-01-05");
  });

  it("formats a leap day", () => {
    const date = new Date(Date.UTC(1992, 1, 29)); // 1992-02-29
    assert.equal(formatISODate(date), "1992-02-29");
  });

  it("formats July 1 correctly", () => {
    const date = new Date(Date.UTC(1996, 6, 1)); // 1996-07-01
    assert.equal(formatISODate(date), "1996-07-01");
  });
});
