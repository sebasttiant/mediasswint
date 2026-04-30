import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCompressionTemplate } from "../lib/compression-template";
import {
  syncMeasurementTemplate,
  type MeasurementTemplatesRepository,
  type UpsertFieldInput,
  type UpsertSectionInput,
  type UpsertTemplateInput,
} from "../lib/measurement-templates";

type TemplateRow = UpsertTemplateInput & { id: string };
type SectionRow = UpsertSectionInput & { id: string };
type FieldRow = UpsertFieldInput & { id: string };

function createInMemoryRepository() {
  const templates = new Map<string, TemplateRow>();
  const sections = new Map<string, SectionRow>();
  const fields = new Map<string, FieldRow>();

  const templateCalls: UpsertTemplateInput[] = [];
  const sectionCalls: UpsertSectionInput[] = [];
  const fieldCalls: UpsertFieldInput[] = [];

  const repository: MeasurementTemplatesRepository = {
    async upsertTemplate(input) {
      templateCalls.push(input);
      const existing = templates.get(input.code);
      if (existing) {
        const updated = { ...existing, ...input };
        templates.set(input.code, updated);
        return { id: existing.id };
      }
      const id = `tpl-${templates.size + 1}`;
      templates.set(input.code, { ...input, id });
      return { id };
    },

    async upsertSection(input) {
      sectionCalls.push(input);
      const key = `${input.templateId}::${input.title}`;
      const existing = sections.get(key);
      if (existing) {
        const updated = { ...existing, ...input };
        sections.set(key, updated);
        return { id: existing.id };
      }
      const id = `sec-${sections.size + 1}`;
      sections.set(key, { ...input, id });
      return { id };
    },

    async upsertField(input) {
      fieldCalls.push(input);
      const key = `${input.sectionId}::${input.key}`;
      const existing = fields.get(key);
      if (existing) {
        const updated = { ...existing, ...input };
        fields.set(key, updated);
        return { id: existing.id };
      }
      const id = `fld-${fields.size + 1}`;
      fields.set(key, { ...input, id });
      return { id };
    },
  };

  return { repository, templates, sections, fields, templateCalls, sectionCalls, fieldCalls };
}

describe("syncMeasurementTemplate", () => {
  it("creates the template with its sections and fields on first run", async () => {
    const template = buildCompressionTemplate();
    const store = createInMemoryRepository();

    const result = await syncMeasurementTemplate(template, store.repository);

    assert.equal(result.sectionsCount, 4);
    assert.equal(result.fieldsCount, 94);
    assert.equal(store.templates.size, 1);
    assert.equal(store.sections.size, 4);
    assert.equal(store.fields.size, 94);

    const stored = store.templates.get(template.code);
    assert.ok(stored);
    assert.equal(stored.name, template.name);
    assert.equal(stored.version, template.version);
    assert.equal(result.templateId, stored.id);
  });

  it("is idempotent — second run does not duplicate template/sections/fields", async () => {
    const template = buildCompressionTemplate();
    const store = createInMemoryRepository();

    const firstRun = await syncMeasurementTemplate(template, store.repository);
    const secondRun = await syncMeasurementTemplate(template, store.repository);

    assert.equal(secondRun.templateId, firstRun.templateId);
    assert.equal(store.templates.size, 1);
    assert.equal(store.sections.size, 4);
    assert.equal(store.fields.size, 94);

    assert.equal(store.templateCalls.length, 2);
    assert.equal(store.sectionCalls.length, 8);
    assert.equal(store.fieldCalls.length, 188);
  });

  it("propagates min/max ranges and metadata to every field", async () => {
    const template = buildCompressionTemplate();
    const store = createInMemoryRepository();

    await syncMeasurementTemplate(template, store.repository);

    for (const field of store.fields.values()) {
      assert.equal(field.fieldType, "NUMBER");
      assert.equal(field.unit, "cm");
      assert.equal(field.isRequired, false);
      assert.equal(field.minValue, 0.1);
      assert.equal(field.maxValue, 300);
      assert.ok(field.metadata);
      const metadata = field.metadata as {
        anatomyZone: string;
        group: string;
        side: string;
        point: number;
      };
      assert.equal(
        metadata.anatomyZone,
        `${metadata.group}.${metadata.side}.${metadata.point}`,
      );
    }
  });
});
