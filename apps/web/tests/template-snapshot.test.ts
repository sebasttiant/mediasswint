import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCompressionTemplate } from "../lib/compression-template";
import { parseTemplateSnapshot } from "../lib/template-snapshot";
import type { TemplateSnapshot } from "../lib/measurements";

function buildValidSnapshot(): TemplateSnapshot {
  const definition = buildCompressionTemplate();
  return {
    templateId: "tpl_1",
    code: definition.code,
    name: definition.name,
    version: definition.version,
    description: definition.description,
    sections: definition.sections.slice(0, 1).map((section, sectionIndex) => ({
      title: section.title,
      sortOrder: sectionIndex,
      fields: section.fields.slice(0, 2).map((field, fieldIndex) => ({
        id: `fld_${fieldIndex}`,
        key: field.key,
        label: field.label,
        fieldType: "NUMBER" as const,
        unit: field.unit,
        isRequired: field.isRequired,
        sortOrder: fieldIndex,
        minValue: field.minValue,
        maxValue: field.maxValue,
        metadata: field.metadata as Record<string, unknown>,
      })),
    })),
  };
}

describe("parseTemplateSnapshot — runtime validation of persisted JSON", () => {
  it("accepts a well-formed snapshot and returns it unchanged in shape", () => {
    const snapshot = buildValidSnapshot();

    const parsed = parseTemplateSnapshot(snapshot);

    assert.ok(parsed);
    assert.equal(parsed.code, snapshot.code);
    assert.equal(parsed.sections.length, 1);
    assert.equal(parsed.sections[0]?.fields.length, 2);
    assert.equal(parsed.sections[0]?.fields[0]?.key, snapshot.sections[0]?.fields[0]?.key);
  });

  // This is the exact shape the demo seeder wrote into production-shaped rows:
  // template identity without any `sections` key at all. Every consumer that
  // iterates `snapshot.sections` threw a TypeError on it.
  it("rejects the seeder-shaped snapshot that carries no sections key", () => {
    const seeded = {
      templateCode: "compression-v1",
      templateName: "Compresión v1",
      version: 1,
      marker: "demo",
    };

    assert.equal(parseTemplateSnapshot(seeded), null);
  });

  it("rejects a snapshot whose sections is not an array", () => {
    const snapshot = { ...buildValidSnapshot(), sections: { nope: true } };

    assert.equal(parseTemplateSnapshot(snapshot), null);
  });

  it("rejects a snapshot carrying a malformed field entry", () => {
    const snapshot = buildValidSnapshot();
    const broken = {
      ...snapshot,
      sections: [
        {
          ...snapshot.sections[0],
          fields: [{ key: "legRight1" /* no id, no label, no ranges */ }],
        },
      ],
    };

    assert.equal(parseTemplateSnapshot(broken), null);
  });

  it("rejects a snapshot whose field ranges are not finite numbers", () => {
    const snapshot = buildValidSnapshot();
    const broken = {
      ...snapshot,
      sections: [
        {
          ...snapshot.sections[0],
          fields: [{ ...snapshot.sections[0]!.fields[0]!, minValue: "abc", maxValue: null }],
        },
      ],
    };

    assert.equal(parseTemplateSnapshot(broken), null);
  });

  it("rejects null, primitives and arrays", () => {
    assert.equal(parseTemplateSnapshot(null), null);
    assert.equal(parseTemplateSnapshot(undefined), null);
    assert.equal(parseTemplateSnapshot("compression-v1"), null);
    assert.equal(parseTemplateSnapshot(42), null);
    assert.equal(parseTemplateSnapshot([buildValidSnapshot()]), null);
  });

  // A snapshot persisted before `code` was introduced must stay usable: the
  // clinical values attached to it are still valid history.
  it("accepts a historical snapshot with a missing optional description", () => {
    const snapshot = buildValidSnapshot();
    const historical = { ...snapshot, description: null };

    const parsed = parseTemplateSnapshot(historical);

    assert.ok(parsed);
    assert.equal(parsed.description, null);
  });

  it("tolerates unknown extra properties without dropping known ones", () => {
    const snapshot = { ...buildValidSnapshot(), marker: "demo", legacyFlag: true };

    const parsed = parseTemplateSnapshot(snapshot);

    assert.ok(parsed);
    assert.equal(parsed.sections[0]?.fields.length, 2);
  });

  it("defaults a missing field metadata object rather than rejecting the snapshot", () => {
    const snapshot = buildValidSnapshot();
    const withoutMetadata = {
      ...snapshot,
      sections: [
        {
          ...snapshot.sections[0],
          fields: [
            { ...snapshot.sections[0]!.fields[0]!, metadata: undefined },
            snapshot.sections[0]!.fields[1]!,
          ],
        },
      ],
    };

    const parsed = parseTemplateSnapshot(withoutMetadata);

    assert.ok(parsed);
    assert.deepEqual(parsed.sections[0]?.fields[0]?.metadata, {});
  });
});
