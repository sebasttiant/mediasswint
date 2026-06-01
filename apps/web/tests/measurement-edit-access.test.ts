import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDraftEditAccess } from "../app/patients/[id]/measurements/[sessionId]/edit/edit-access";
import type { MeasurementSessionDetail, TemplateSnapshot } from "../lib/measurements";

const SNAPSHOT: TemplateSnapshot = {
  templateId: "tpl-1",
  code: "COMPRESSION",
  name: "Compresión",
  version: 1,
  description: null,
  sections: [
    {
      title: "Piernas",
      sortOrder: 0,
      fields: [
        {
          id: "field-1",
          key: "leg_b",
          label: "B",
          fieldType: "NUMBER",
          unit: "cm",
          isRequired: false,
          sortOrder: 0,
          minValue: 1,
          maxValue: 100,
          metadata: {},
        },
      ],
    },
  ],
};

function detailFixture(overrides: Partial<MeasurementSessionDetail> = {}): MeasurementSessionDetail {
  return {
    id: "sess-1",
    patientId: "pat-1",
    templateId: "tpl-1",
    status: "DRAFT",
    measuredAt: new Date("2026-05-01T10:00:00.000Z"),
    notes: null,
    diagnosis: null,
    garmentType: null,
    compressionClass: null,
    productFlags: null,
    metadata: null,
    templateSnapshot: SNAPSHOT,
    values: { leg_b: 42 },
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    updatedAt: new Date("2026-05-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("resolveDraftEditAccess", () => {
  it("renders a DRAFT that owns a snapshot and belongs to the patient, exposing its detail", () => {
    const access = resolveDraftEditAccess("pat-1", { ok: true, value: detailFixture() });

    assert.equal(access.action, "render");
    if (access.action === "render") {
      assert.equal(access.detail.id, "sess-1");
      assert.deepEqual(access.detail.values, { leg_b: 42 });
      assert.equal(access.templateSnapshot, SNAPSHOT);
    }
  });

  it("blocks a COMPLETED measurement from being edited directly", () => {
    const access = resolveDraftEditAccess("pat-1", {
      ok: true,
      value: detailFixture({ status: "COMPLETED" }),
    });

    assert.equal(access.action, "notFound");
  });

  it("blocks a VOID measurement", () => {
    const access = resolveDraftEditAccess("pat-1", {
      ok: true,
      value: detailFixture({ status: "VOID" }),
    });

    assert.equal(access.action, "notFound");
  });

  it("returns notFound when the measurement does not belong to the patient in the URL", () => {
    const access = resolveDraftEditAccess("other-pat", { ok: true, value: detailFixture() });

    assert.equal(access.action, "notFound");
  });

  it("returns notFound when the DRAFT has no template snapshot", () => {
    const access = resolveDraftEditAccess("pat-1", {
      ok: true,
      value: detailFixture({ templateSnapshot: null }),
    });

    assert.equal(access.action, "notFound");
  });

  it("returns notFound when the measurement lookup failed", () => {
    const access = resolveDraftEditAccess("pat-1", { ok: false });

    assert.equal(access.action, "notFound");
  });
});
