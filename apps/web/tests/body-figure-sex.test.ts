import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BODY_FIGURE_SEX,
  getMeasurementSnapshotPatientSex,
  normalizePatientSex,
  PATIENT_SEX,
  resolveBodyFigureSex,
  resolveMeasurementBodyFigureSex,
} from "../lib/body-figure-sex";

describe("body figure sex helpers", () => {
  it("normalizes patient sex values from persisted and UI sources", () => {
    assert.equal(normalizePatientSex("MALE"), PATIENT_SEX.MALE);
    assert.equal(normalizePatientSex("male"), PATIENT_SEX.MALE);
    assert.equal(normalizePatientSex(" Masculino "), PATIENT_SEX.MALE);
    assert.equal(normalizePatientSex("FEMALE"), PATIENT_SEX.FEMALE);
    assert.equal(normalizePatientSex("female"), PATIENT_SEX.FEMALE);
    assert.equal(normalizePatientSex(null), null);
  });

  it("resolves unknown sex defensively to the existing female default", () => {
    assert.equal(resolveBodyFigureSex("MALE"), BODY_FIGURE_SEX.MALE);
    assert.equal(resolveBodyFigureSex("unknown"), BODY_FIGURE_SEX.FEMALE);
    assert.equal(resolveBodyFigureSex(null), BODY_FIGURE_SEX.FEMALE);
  });

  it("resolves OTHER to the female silhouette (regression)", () => {
    assert.equal(resolveBodyFigureSex("OTHER"), BODY_FIGURE_SEX.FEMALE);
  });

  it("prefers the measurement snapshot sex over the current patient sex", () => {
    assert.equal(
      resolveMeasurementBodyFigureSex({ patientSex: "MALE" }, "FEMALE"),
      BODY_FIGURE_SEX.MALE,
    );
    assert.equal(getMeasurementSnapshotPatientSex({ patientSex: "female" }), PATIENT_SEX.FEMALE);
    assert.equal(getMeasurementSnapshotPatientSex({}), null);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — Garment catalog regression: sex-aware resolution is not disturbed
// ---------------------------------------------------------------------------

describe("garment catalog does not alter sex-aware figure resolution (regression)", () => {
  const GARMENT_SNAPSHOT = {
    reference: "MR",
    label: "Media a la Rodilla Par Adulto",
    family: "Lower limb",
    figureKey: "lower-limb",
  };

  it("metadata with patientSex + garmentSnapshot resolves the same sex as patientSex alone", () => {
    const withSnapshot = resolveMeasurementBodyFigureSex(
      { patientSex: "MALE", garmentSnapshot: GARMENT_SNAPSHOT },
      "FEMALE",
    );
    const withoutSnapshot = resolveMeasurementBodyFigureSex({ patientSex: "MALE" }, "FEMALE");

    assert.equal(withSnapshot, BODY_FIGURE_SEX.MALE);
    assert.equal(withoutSnapshot, BODY_FIGURE_SEX.MALE);
    assert.equal(withSnapshot, withoutSnapshot);
  });

  it("female patientSex + garmentSnapshot still resolves to female figure", () => {
    const withSnapshot = resolveMeasurementBodyFigureSex(
      { patientSex: "FEMALE", garmentSnapshot: GARMENT_SNAPSHOT },
      "MALE",
    );
    const withoutSnapshot = resolveMeasurementBodyFigureSex({ patientSex: "FEMALE" }, "MALE");

    assert.equal(withSnapshot, BODY_FIGURE_SEX.FEMALE);
    assert.equal(withoutSnapshot, BODY_FIGURE_SEX.FEMALE);
    assert.equal(withSnapshot, withoutSnapshot);
  });

  it("garmentSnapshot with no patientSex falls back to currentPatientSex without crashing", () => {
    // No patientSex in metadata → getMeasurementSnapshotPatientSex returns null
    // → falls back to currentPatientSex "FEMALE" → female figure
    const result = resolveMeasurementBodyFigureSex(
      { garmentSnapshot: GARMENT_SNAPSHOT },
      "FEMALE",
    );

    assert.equal(result, BODY_FIGURE_SEX.FEMALE);
  });

  it("garmentSnapshot with no patientSex and null currentPatientSex falls back to female default", () => {
    // Both sources absent → resolveBodyFigureSex(null) → FEMALE (existing default)
    const result = resolveMeasurementBodyFigureSex(
      { garmentSnapshot: GARMENT_SNAPSHOT },
      null,
    );

    assert.equal(result, BODY_FIGURE_SEX.FEMALE);
  });

  it("getMeasurementSnapshotPatientSex ignores garmentSnapshot and reads only patientSex", () => {
    assert.equal(
      getMeasurementSnapshotPatientSex({ garmentSnapshot: GARMENT_SNAPSHOT }),
      null,
    );
    assert.equal(
      getMeasurementSnapshotPatientSex({ patientSex: "MALE", garmentSnapshot: GARMENT_SNAPSHOT }),
      PATIENT_SEX.MALE,
    );
  });
});
