import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCompressionTemplate } from "../lib/compression-template";
import type { TemplateSnapshot } from "../lib/measurements";
import {
  buildMeasurementTableRows,
  getActiveZoneIdForField,
  type MeasurementUiField,
} from "../app/patients/[id]/measurements/measurements-ui";

function buildSnapshot(): TemplateSnapshot {
  const template = buildCompressionTemplate();
  let fieldId = 0;

  return {
    templateId: "template-1",
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
    sections: template.sections.map((section) => ({
      title: section.title,
      sortOrder: section.sortOrder,
      fields: section.fields.map((field) => {
        fieldId += 1;
        return {
          id: `field-${fieldId}`,
          key: field.key,
          label: field.label,
          fieldType: field.fieldType,
          unit: field.unit,
          isRequired: field.isRequired,
          sortOrder: field.sortOrder,
          minValue: field.minValue,
          maxValue: field.maxValue,
          metadata: field.metadata,
        };
      }),
    })),
  };
}

describe("measurement UI helpers", () => {
  it("builds paired leg rows for points 1..28 with right and left values", () => {
    const rows = buildMeasurementTableRows(buildSnapshot(), "legs", {
      legRight1: 24.5,
      legLeft1: 25,
      legRight28: null,
    });

    assert.equal(rows.length, 28);
    assert.equal(rows[0]?.point, 1);
    assert.equal(rows[0]?.right?.key, "legRight1");
    assert.equal(rows[0]?.right?.value, 24.5);
    assert.equal(rows[0]?.left?.key, "legLeft1");
    assert.equal(rows[0]?.left?.value, 25);
    assert.equal(rows[27]?.point, 28);
  });

  it("builds paired arm rows for points 1..19", () => {
    const rows = buildMeasurementTableRows(buildSnapshot(), "arms", {
      armRight19: 31,
      armLeft19: 32,
    });

    assert.equal(rows.length, 19);
    assert.equal(rows[18]?.right?.key, "armRight19");
    assert.equal(rows[18]?.right?.value, 31);
    assert.equal(rows[18]?.left?.key, "armLeft19");
  });

  it("resolves the BodyHighlight zone id from field metadata", () => {
    const field: MeasurementUiField = {
      key: "legRight7",
      label: "Pierna derecha punto 7",
      unit: "cm",
      minValue: 0.1,
      maxValue: 300,
      metadata: { anatomyZone: "legs.right.7" },
      value: null,
    };

    assert.equal(getActiveZoneIdForField(field), "legs.right.7");
    assert.equal(getActiveZoneIdForField(null), null);
    assert.equal(getActiveZoneIdForField({ ...field, metadata: {} }), null);
  });
});
