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

  it("prefers the measurement snapshot sex over the current patient sex", () => {
    assert.equal(
      resolveMeasurementBodyFigureSex({ patientSex: "MALE" }, "FEMALE"),
      BODY_FIGURE_SEX.MALE,
    );
    assert.equal(getMeasurementSnapshotPatientSex({ patientSex: "female" }), PATIENT_SEX.FEMALE);
    assert.equal(getMeasurementSnapshotPatientSex({}), null);
  });
});
