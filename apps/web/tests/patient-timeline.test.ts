import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPatientTimeline,
  PATIENT_TIMELINE_EVENT_TYPE,
  type PatientTimelineMeasurement,
  type PatientTimelinePatient,
} from "../lib/patient-timeline";

function patientFixture(overrides: Partial<PatientTimelinePatient> = {}): PatientTimelinePatient {
  return {
    id: "patient-1",
    createdAt: new Date("2026-04-01T10:00:00.000Z"),
    updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    ...overrides,
  };
}

function measurementFixture(overrides: Partial<PatientTimelineMeasurement> = {}): PatientTimelineMeasurement {
  return {
    id: "measurement-1",
    patientId: "patient-1",
    status: "DRAFT",
    measuredAt: new Date("2026-04-10T10:00:00.000Z"),
    garmentType: "Media corta",
    compressionClass: "II",
    diagnosis: "Linfedema",
    createdAt: new Date("2026-04-10T10:00:00.000Z"),
    updatedAt: new Date("2026-04-10T10:00:00.000Z"),
    ...overrides,
  };
}

describe("buildPatientTimeline", () => {
  it("orders events by occurrence date descending", () => {
    const timeline = buildPatientTimeline(
      patientFixture({ updatedAt: new Date("2026-04-02T10:00:00.000Z") }),
      [
        measurementFixture({
          id: "old-measurement",
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          updatedAt: new Date("2026-04-03T10:00:00.000Z"),
        }),
        measurementFixture({
          id: "new-measurement",
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
          updatedAt: new Date("2026-04-05T10:00:00.000Z"),
        }),
      ],
    );

    assert.deepEqual(
      timeline.map((event) => event.id),
      [
        "measurement:new-measurement:created",
        "measurement:old-measurement:created",
        "patient:patient-1:updated",
        "patient:patient-1:created",
      ],
    );
  });

  it("adds only patient creation when createdAt and updatedAt are equal", () => {
    const timeline = buildPatientTimeline(patientFixture(), []);

    assert.equal(timeline.length, 1);
    assert.equal(timeline[0]?.type, PATIENT_TIMELINE_EVENT_TYPE.PATIENT_CREATED);
  });

  it("adds patient update when updatedAt differs from createdAt", () => {
    const timeline = buildPatientTimeline(
      patientFixture({ updatedAt: new Date("2026-04-02T10:00:00.000Z") }),
      [],
    );

    assert.deepEqual(
      timeline.map((event) => event.type),
      [PATIENT_TIMELINE_EVENT_TYPE.PATIENT_UPDATED, PATIENT_TIMELINE_EVENT_TYPE.PATIENT_CREATED],
    );
  });

  it("adds creation event for DRAFT measurements", () => {
    const timeline = buildPatientTimeline(patientFixture(), [measurementFixture({ status: "DRAFT" })]);

    assert.deepEqual(
      timeline.map((event) => event.type),
      [PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_CREATED, PATIENT_TIMELINE_EVENT_TYPE.PATIENT_CREATED],
    );
  });

  it("adds creation and completion events for COMPLETED measurements", () => {
    const timeline = buildPatientTimeline(patientFixture(), [
      measurementFixture({
        status: "COMPLETED",
        createdAt: new Date("2026-04-10T10:00:00.000Z"),
        updatedAt: new Date("2026-04-10T12:00:00.000Z"),
      }),
    ]);

    assert.deepEqual(
      timeline.map((event) => event.type),
      [
        PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_COMPLETED,
        PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_CREATED,
        PATIENT_TIMELINE_EVENT_TYPE.PATIENT_CREATED,
      ],
    );
  });

  it("is stable with an empty measurement list", () => {
    const timeline = buildPatientTimeline(patientFixture(), []);

    assert.deepEqual(timeline.map((event) => event.id), ["patient:patient-1:created"]);
  });
});
