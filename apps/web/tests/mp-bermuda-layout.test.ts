import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyMpBermudaSnapshot } from "../lib/mp-bermuda-layout";
import { buildMpBermudaTemplate } from "../lib/mp-bermuda-template";

function snapshot() {
  const template = buildMpBermudaTemplate();
  return { ...template, templateId: "mp", sections: template.sections.map((section, index) => ({
    ...section,
    sortOrder: index,
    fields: section.fields.map((field, fieldIndex) => ({ ...field, id: field.key, sortOrder: fieldIndex })),
  })) };
}

describe("MP/Bermuda snapshot layout", () => {
  it("classifies a complete clinical snapshot and visual degradation separately", () => {
    const complete = classifyMpBermudaSnapshot(snapshot());
    const degraded = classifyMpBermudaSnapshot({
      ...snapshot(),
      sections: snapshot().sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => ({ ...field, metadata: { ...field.metadata, markerId: undefined } })),
      })),
    });

    assert.equal(complete.kind, "complete");
    assert.equal(degraded.kind, "visual-degraded");
  });

  it("blocks incomplete clinical snapshots including duplicate keys without treating them as visual degradation", () => {
    const valid = snapshot();
    const fields = valid.sections[0]!.fields;
    const incomplete = classifyMpBermudaSnapshot({ ...valid, sections: [{ ...valid.sections[0]!, fields: fields.slice(0, -1) }] });
    const duplicate = classifyMpBermudaSnapshot({ ...valid, sections: [{ ...valid.sections[0]!, fields: [...fields, fields[0]!] }] });

    assert.equal(incomplete.kind, "clinical-incomplete");
    assert.equal(duplicate.kind, "clinical-incomplete");
  });

  // A snapshot that is not MP is not a broken MP snapshot. Collapsing the two
  // would hand every compression, Mentonera and Máscara session to the MP
  // degraded path and erase their own rendering.
  it("leaves absent and non-MP snapshots outside MP ownership", () => {
    assert.equal(classifyMpBermudaSnapshot(null).kind, "not-mp");
    assert.equal(classifyMpBermudaSnapshot(undefined).kind, "not-mp");
    assert.equal(classifyMpBermudaSnapshot({ ...snapshot(), code: "compression-v1" }).kind, "not-mp");
  });

  it("reports structural malformation only when the frozen MP code survives but its fields do not", () => {
    assert.equal(classifyMpBermudaSnapshot({ ...snapshot(), sections: [] }).kind, "structurally-malformed");
  });
});
