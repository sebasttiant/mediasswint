import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCreateMeasurementInput, parseListMeasurementsQuery } from "../lib/measurements-input";

describe("parseCreateMeasurementInput — body shape", () => {
  it("rejects null body", () => {
    const result = parseCreateMeasurementInput(null);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "body"), true);
  });

  it("rejects array body", () => {
    const result = parseCreateMeasurementInput([]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "body"), true);
  });

  it("rejects string body", () => {
    const result = parseCreateMeasurementInput("not-an-object");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "body"), true);
  });
});

describe("parseCreateMeasurementInput — measuredAt strict ISO", () => {
  it("rejects missing measuredAt", () => {
    const result = parseCreateMeasurementInput({});
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measuredAt"), true);
  });

  it("rejects 'not-a-date'", () => {
    const result = parseCreateMeasurementInput({ measuredAt: "not-a-date" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measuredAt"), true);
  });

  it("rejects date-only '2026-04-28'", () => {
    const result = parseCreateMeasurementInput({ measuredAt: "2026-04-28" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measuredAt"), true);
  });

  it("rejects non-ISO separator '2026/04/28T10:00:00Z'", () => {
    const result = parseCreateMeasurementInput({ measuredAt: "2026/04/28T10:00:00Z" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measuredAt"), true);
  });

  it("rejects ISO-shaped but invalid calendar date '2026-02-30T10:00:00Z'", () => {
    const result = parseCreateMeasurementInput({ measuredAt: "2026-02-30T10:00:00Z" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measuredAt"), true);
  });
});

describe("parseCreateMeasurementInput — measuredAt future tolerance", () => {
  it("rejects measuredAt 1 hour in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = parseCreateMeasurementInput({ measuredAt: future });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measuredAt"), true);
  });

  it("accepts measuredAt 2 minutes in the future (within tolerance)", () => {
    const near = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const result = parseCreateMeasurementInput({ measuredAt: near });
    assert.equal(result.ok, true);
  });
});

describe("parseCreateMeasurementInput — compression measurements + notes", () => {
  it("accepts payload with measuredAt + notes and no body measurements", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      notes: " Medias de compresión hasta rodilla ",
      garmentType: " Media hasta rodilla ",
      compressionClass: " Clase II ",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.notes, "Medias de compresión hasta rodilla");
    assert.equal(result.value.garmentType, "Media hasta rodilla");
    assert.equal(result.value.compressionClass, "Clase II");
    assert.equal(result.value.measurements.legRight1, null);
    assert.equal(result.value.measurements.legLeft28, null);
    assert.equal(result.value.measurements.armRight1, null);
    assert.equal(result.value.measurements.armLeft19, null);
  });

  it("treats blank notes, garmentType and compressionClass as null", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      notes: "   ",
      garmentType: "   ",
      compressionClass: "   ",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.notes, null);
    assert.equal(result.value.garmentType, null);
    assert.equal(result.value.compressionClass, null);
  });
});

describe("parseCreateMeasurementInput — compression measurement ranges", () => {
  it("rejects legRight1 below plausible range", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      measurements: { legRight1: 0 },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measurements.legRight1"), true);
  });

  it("accepts legRight1 on lower boundary", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      measurements: { legRight1: 0.1 },
    });
    assert.equal(result.ok, true);
  });

  it("accepts legLeft28 in range", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      measurements: { legLeft28: 38.5 },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.measurements.legLeft28, 38.5);
  });

  it("rejects armLeft19 above plausible range", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      measurements: { armLeft19: 300.01 },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measurements.armLeft19"), true);
  });

  it("rejects non-number body measurement", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      measurements: { armRight1: "82" },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "measurements.armRight1"), true);
  });
});

describe("parseCreateMeasurementInput — text field length", () => {
  it("rejects notes > 1000 chars", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      notes: "n".repeat(1001),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "notes"), true);
  });

  it("rejects garmentType > 100 chars", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      garmentType: "g".repeat(101),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "garmentType"), true);
  });

  it("accepts notes of exactly 1000 chars", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      notes: "n".repeat(1000),
    });
    assert.equal(result.ok, true);
  });
});

describe("parseListMeasurementsQuery", () => {
  it("uses default limit when params are empty", () => {
    const result = parseListMeasurementsQuery(new URLSearchParams());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.limit, 20);
  });

  it("rejects limit = 0", () => {
    const result = parseListMeasurementsQuery(new URLSearchParams({ limit: "0" }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.errors, [{ field: "limit", message: "must be between 1 and 100" }]);
  });

  it("rejects limit = 101", () => {
    const result = parseListMeasurementsQuery(new URLSearchParams({ limit: "101" }));
    assert.equal(result.ok, false);
  });

  it("rejects non-integer limit", () => {
    const result = parseListMeasurementsQuery(new URLSearchParams({ limit: "20.5" }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.errors, [{ field: "limit", message: "must be an integer" }]);
  });

  it("accepts limit = 50", () => {
    const result = parseListMeasurementsQuery(new URLSearchParams({ limit: "50" }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.limit, 50);
  });
});
