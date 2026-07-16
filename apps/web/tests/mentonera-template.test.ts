import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMentoneraTemplate,
  MENTONERA_TEMPLATE_CODE,
} from "../lib/mentonera-template";

describe("buildMentoneraTemplate", () => {
  it("returns exactly 3 fields with stable keys in a fixed order", () => {
    const template = buildMentoneraTemplate();
    const fields = template.sections.flatMap((section) => section.fields);

    assert.equal(fields.length, 3);
    assert.deepEqual(
      fields.map((field) => field.key),
      ["mentoneraCrownChin", "mentoneraFaceLength", "mentoneraNeck"],
    );
  });

  it("uses centimeters as the unit for every field", () => {
    const template = buildMentoneraTemplate();
    for (const field of template.sections.flatMap((section) => section.fields)) {
      assert.equal(field.unit, "cm");
    }
  });

  it("assigns the correct kind to each field", () => {
    const template = buildMentoneraTemplate();
    const byKey = new Map(
      template.sections.flatMap((section) => section.fields).map((field) => [field.key, field]),
    );

    assert.equal(byKey.get("mentoneraCrownChin")?.metadata.kind, "circumference");
    assert.equal(byKey.get("mentoneraFaceLength")?.metadata.kind, "length");
    assert.equal(byKey.get("mentoneraNeck")?.metadata.kind, "circumference");
  });

  it("uses head.* anatomy zone ids for each field", () => {
    const template = buildMentoneraTemplate();
    const byKey = new Map(
      template.sections.flatMap((section) => section.fields).map((field) => [field.key, field]),
    );

    assert.equal(byKey.get("mentoneraCrownChin")?.metadata.anatomyZone, "head.crownChin");
    assert.equal(byKey.get("mentoneraFaceLength")?.metadata.anatomyZone, "head.faceLength");
    assert.equal(byKey.get("mentoneraNeck")?.metadata.anatomyZone, "head.neck");
  });

  it("exposes the mentonera-v1 template code, name, and version", () => {
    const template = buildMentoneraTemplate();
    assert.equal(template.code, MENTONERA_TEMPLATE_CODE);
    assert.equal(template.code, "mentonera-v1");
    assert.equal(template.version, 1);
    assert.ok(template.name.length > 0);
  });
});
