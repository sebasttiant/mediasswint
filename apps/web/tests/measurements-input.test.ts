import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseCreateMeasurementInput,
  parseListMeasurementsQuery,
  parseUpdateMeasurementValuesInput,
} from "../lib/measurements-input";
import { GARMENT_FIGURE_KEY } from "../lib/garment-catalog";

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
  });

  it("rejects string body", () => {
    const result = parseCreateMeasurementInput("not-an-object");
    assert.equal(result.ok, false);
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
  });

  it("rejects date-only '2026-04-28'", () => {
    const result = parseCreateMeasurementInput({ measuredAt: "2026-04-28" });
    assert.equal(result.ok, false);
  });

  it("rejects ISO-shaped but invalid calendar date '2026-02-30T10:00:00Z'", () => {
    const result = parseCreateMeasurementInput({ measuredAt: "2026-02-30T10:00:00Z" });
    assert.equal(result.ok, false);
  });
});

describe("parseCreateMeasurementInput — measuredAt future tolerance", () => {
  it("rejects measuredAt 1 hour in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = parseCreateMeasurementInput({ measuredAt: future });
    assert.equal(result.ok, false);
  });

  it("accepts measuredAt 2 minutes in the future (within tolerance)", () => {
    const near = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const result = parseCreateMeasurementInput({ measuredAt: near });
    assert.equal(result.ok, true);
  });
});

describe("parseCreateMeasurementInput — text + flags", () => {
  it("trims notes/garmentType/compressionClass/diagnosis", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      notes: " Medias de compresión hasta rodilla ",
      garmentType: " Media hasta rodilla ",
      compressionClass: " Clase II ",
      diagnosis: " Insuficiencia venosa crónica ",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.notes, "Medias de compresión hasta rodilla");
    assert.equal(result.value.garmentType, "Media hasta rodilla");
    assert.equal(result.value.compressionClass, "Clase II");
    assert.equal(result.value.diagnosis, "Insuficiencia venosa crónica");
  });

  it("treats blanks as null", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      notes: "   ",
      garmentType: "   ",
      compressionClass: "   ",
      diagnosis: "   ",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.notes, null);
    assert.equal(result.value.diagnosis, null);
  });

  it("rejects notes > 1000 chars", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      notes: "n".repeat(1001),
    });
    assert.equal(result.ok, false);
  });

  it("accepts a productFlags map of booleans", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      productFlags: { mediaCorta: true, mediaLarga: false },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.productFlags, { mediaCorta: true, mediaLarga: false });
  });

  it("rejects productFlags with non-boolean values", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      productFlags: { mediaCorta: "yes" },
    });
    assert.equal(result.ok, false);
  });

  it("rejects productFlags as an array", () => {
    const result = parseCreateMeasurementInput({
      measuredAt: "2026-04-28T10:00:00Z",
      productFlags: ["mediaCorta"],
    });
    assert.equal(result.ok, false);
  });
});

describe("parseUpdateMeasurementValuesInput", () => {
  it("requires valuesByKey", () => {
    const result = parseUpdateMeasurementValuesInput({});
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((error) => error.field === "valuesByKey"), true);
  });

  it("accepts valid keys with numeric values inside range", () => {
    const result = parseUpdateMeasurementValuesInput({
      valuesByKey: { legRight1: 24.5, legLeft28: 38.5, armRight1: 22 },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.valuesByKey.legRight1, 24.5);
    assert.equal(result.value.valuesByKey.legLeft28, 38.5);
    assert.equal(result.value.valuesByKey.armRight1, 22);
    assert.equal(result.value.complete, false);
  });

  it("accepts null to clear a value", () => {
    const result = parseUpdateMeasurementValuesInput({
      valuesByKey: { legRight1: null },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.valuesByKey.legRight1, null);
  });

  it("rejects unknown keys", () => {
    const result = parseUpdateMeasurementValuesInput({
      valuesByKey: { temperatureC: 36.5 },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0].field, "valuesByKey.temperatureC");
  });

  it("rejects out-of-range values", () => {
    const result = parseUpdateMeasurementValuesInput({
      valuesByKey: { legRight1: 0 },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0].field, "valuesByKey.legRight1");
  });

  it("rejects non-finite numbers", () => {
    const result = parseUpdateMeasurementValuesInput({
      valuesByKey: { legRight1: Number.POSITIVE_INFINITY },
    });
    assert.equal(result.ok, false);
  });

  it("accepts complete: true", () => {
    const result = parseUpdateMeasurementValuesInput({
      valuesByKey: { legRight1: 24.5 },
      complete: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.complete, true);
  });

  it("rejects non-boolean complete", () => {
    const result = parseUpdateMeasurementValuesInput({
      valuesByKey: { legRight1: 24.5 },
      complete: "yes",
    });
    assert.equal(result.ok, false);
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
  });

  it("rejects limit = 101", () => {
    const result = parseListMeasurementsQuery(new URLSearchParams({ limit: "101" }));
    assert.equal(result.ok, false);
  });

  it("rejects non-integer limit", () => {
    const result = parseListMeasurementsQuery(new URLSearchParams({ limit: "20.5" }));
    assert.equal(result.ok, false);
  });

  it("accepts limit = 50", () => {
    const result = parseListMeasurementsQuery(new URLSearchParams({ limit: "50" }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.limit, 50);
  });
});

// ---------------------------------------------------------------------------
// Phase 2: garmentSnapshot persistence contract
// ---------------------------------------------------------------------------

describe("parseCreateMeasurementInput — garmentSnapshot in metadata", () => {
  const BASE = { measuredAt: "2026-04-28T10:00:00Z" };

  const VALID_SNAPSHOT = {
    reference: "MR",
    label: "Media a la Rodilla Par Adulto",
    family: "Lower limb",
    figureKey: GARMENT_FIGURE_KEY.LOWER_LIMB,
  };

  it("returns garmentSnapshot: null when metadata is absent", () => {
    const result = parseCreateMeasurementInput({ ...BASE });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.garmentSnapshot, null);
  });

  it("parses a valid garmentSnapshot from metadata", () => {
    const result = parseCreateMeasurementInput({
      ...BASE,
      metadata: { garmentSnapshot: VALID_SNAPSHOT },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.garmentSnapshot, VALID_SNAPSHOT);
  });

  it("ignores a malformed garmentSnapshot (missing figureKey) without failing", () => {
    const result = parseCreateMeasurementInput({
      ...BASE,
      metadata: { garmentSnapshot: { reference: "MR", label: "Media", family: "Lower limb" } },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.garmentSnapshot, null);
  });

  it("ignores a garmentSnapshot that is not an object without failing", () => {
    const result = parseCreateMeasurementInput({
      ...BASE,
      metadata: { garmentSnapshot: "not-an-object" },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.garmentSnapshot, null);
  });

  it("ignores a garmentSnapshot with invalid figureKey value without failing", () => {
    const result = parseCreateMeasurementInput({
      ...BASE,
      metadata: {
        garmentSnapshot: {
          reference: "MR",
          label: "Media",
          family: "Lower limb",
          figureKey: "not-a-valid-figure-key",
        },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.garmentSnapshot, null);
  });

  it("preserves patientSex alongside a valid garmentSnapshot", () => {
    const result = parseCreateMeasurementInput({
      ...BASE,
      patientSex: "FEMALE",
      metadata: { garmentSnapshot: VALID_SNAPSHOT },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.patientSex, "FEMALE");
    assert.deepEqual(result.value.garmentSnapshot, VALID_SNAPSHOT);
  });

  it("preserves patientSex even when garmentSnapshot is absent", () => {
    const result = parseCreateMeasurementInput({
      ...BASE,
      patientSex: "MALE",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.patientSex, "MALE");
    assert.equal(result.value.garmentSnapshot, null);
  });

  it("accepts legacy free-text garmentType without garmentSnapshot", () => {
    const result = parseCreateMeasurementInput({
      ...BASE,
      garmentType: "Media corta libre texto",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.garmentType, "Media corta libre texto");
    assert.equal(result.value.garmentSnapshot, null);
  });
});

describe("parseUpdateMeasurementValuesInput — garmentSnapshot in metadata", () => {
  const BASE_VALUES = { valuesByKey: { legRight1: 24.5 } };

  const VALID_SNAPSHOT = {
    reference: "BP",
    label: "Bermuda Ambas Piernas Adulto",
    family: "Lower limb",
    figureKey: GARMENT_FIGURE_KEY.LOWER_LIMB,
  };

  it("returns garmentSnapshot: undefined when metadata is absent", () => {
    const result = parseUpdateMeasurementValuesInput({ ...BASE_VALUES });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.garmentSnapshot, undefined);
  });

  it("parses a valid garmentSnapshot from metadata", () => {
    const result = parseUpdateMeasurementValuesInput({
      ...BASE_VALUES,
      metadata: { garmentSnapshot: VALID_SNAPSHOT },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.garmentSnapshot, VALID_SNAPSHOT);
  });

  it("normalizes a malformed garmentSnapshot to null without failing", () => {
    const result = parseUpdateMeasurementValuesInput({
      ...BASE_VALUES,
      metadata: { garmentSnapshot: { reference: 42 } },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.garmentSnapshot, null);
  });

  it("normalizes a garmentSnapshot with invalid figureKey to null without failing", () => {
    const result = parseUpdateMeasurementValuesInput({
      ...BASE_VALUES,
      metadata: {
        garmentSnapshot: {
          reference: "MR",
          label: "Media",
          family: "Lower limb",
          figureKey: "invalid-key",
        },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.garmentSnapshot, null);
  });
});
