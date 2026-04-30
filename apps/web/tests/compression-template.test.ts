import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCompressionTemplate,
  COMPRESSION_TEMPLATE_CODE,
  COMPRESSION_TEMPLATE_NAME,
  COMPRESSION_TEMPLATE_VERSION,
} from "../lib/compression-template";
import { COMPRESSION_MEASUREMENTS } from "../lib/compression-measurements";

describe("buildCompressionTemplate", () => {
  it("returns the canonical compression template metadata", () => {
    const template = buildCompressionTemplate();
    assert.equal(template.code, COMPRESSION_TEMPLATE_CODE);
    assert.equal(template.name, COMPRESSION_TEMPLATE_NAME);
    assert.equal(template.version, COMPRESSION_TEMPLATE_VERSION);
    assert.equal(typeof template.description, "string");
    assert.ok(template.description.length > 0);
  });

  it("groups the catalog into 4 ordered sections (legs/arms × right/left)", () => {
    const template = buildCompressionTemplate();
    assert.equal(template.sections.length, 4);
    assert.deepEqual(
      template.sections.map((section) => section.title),
      ["Pierna derecha", "Pierna izquierda", "Brazo derecho", "Brazo izquierdo"],
    );
    template.sections.forEach((section, index) => {
      assert.equal(section.sortOrder, index);
    });
  });

  it("includes 28 leg fields per side and 19 arm fields per side", () => {
    const template = buildCompressionTemplate();
    const [legRight, legLeft, armRight, armLeft] = template.sections;
    assert.equal(legRight.fields.length, 28);
    assert.equal(legLeft.fields.length, 28);
    assert.equal(armRight.fields.length, 19);
    assert.equal(armLeft.fields.length, 19);
  });

  it("derives every field from the catalog with NUMBER fieldType, cm unit, and ranges", () => {
    const template = buildCompressionTemplate();
    const totalFields = template.sections.reduce(
      (count, section) => count + section.fields.length,
      0,
    );
    assert.equal(totalFields, COMPRESSION_MEASUREMENTS.length);

    for (const section of template.sections) {
      for (const field of section.fields) {
        assert.equal(field.fieldType, "NUMBER");
        assert.equal(field.unit, "cm");
        assert.equal(field.isRequired, false);
        assert.equal(field.minValue, 0.1);
        assert.equal(field.maxValue, 300);
        assert.equal(field.sortOrder, field.metadata.point);
        assert.equal(
          field.metadata.anatomyZone,
          `${field.metadata.group}.${field.metadata.side}.${field.metadata.point}`,
        );
      }
    }
  });

  it("preserves catalog field keys exactly", () => {
    const template = buildCompressionTemplate();
    const keys = template.sections.flatMap((section) => section.fields.map((field) => field.key));
    const catalogKeys = COMPRESSION_MEASUREMENTS.map((definition) => definition.key);
    assert.deepEqual(keys.sort(), [...catalogKeys].sort());
  });

  it("is a pure function — same catalog input yields equal output", () => {
    const a = buildCompressionTemplate();
    const b = buildCompressionTemplate();
    assert.deepEqual(a, b);
  });
});
