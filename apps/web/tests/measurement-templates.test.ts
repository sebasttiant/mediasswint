import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCompressionTemplate } from "../lib/compression-template";
import { buildMentoneraTemplate } from "../lib/mentonera-template";
import { buildMascaraTemplate } from "../lib/mascara-template";
import {
  syncMeasurementTemplate,
  syncMentoneraTemplate,
  syncMascaraTemplate,
  type MeasurementTemplatesRepository,
  type UpsertFieldInput,
  type UpsertSectionInput,
  type UpsertTemplateInput,
} from "../lib/measurement-templates";

type TemplateRow = UpsertTemplateInput & { id: string };
type SectionRow = UpsertSectionInput & { id: string; isActive?: boolean };
type FieldRow = UpsertFieldInput & { id: string; isActive?: boolean };

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

    // Retirement is a state change, never a removal — the fake must model that
    // faithfully or it would hide the very bug this contract exists to prevent.
    async deactivateFieldsNotIn(input) {
      let deactivated = 0;
      for (const [key, field] of fields.entries()) {
        if (field.sectionId !== input.sectionId) continue;
        if (input.keys.includes(field.key)) continue;
        if (field.isActive === false) continue;
        fields.set(key, { ...field, isActive: false });
        deactivated += 1;
      }
      return { deactivated };
    },

    async deactivateSectionsNotIn(input) {
      let deactivated = 0;
      for (const [key, section] of sections.entries()) {
        if (section.templateId !== input.templateId) continue;
        if (input.titles.includes(section.title)) continue;
        if (section.isActive === false) continue;
        sections.set(key, { ...section, isActive: false });
        for (const [fieldKey, field] of fields.entries()) {
          if (field.sectionId === section.id) fields.set(fieldKey, { ...field, isActive: false });
        }
        deactivated += 1;
      }
      return { deactivated };
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

// ---------------------------------------------------------------------------
// Regression guard: syncMeasurementTemplate must accept a structurally
// different (Mentonera-shaped) template without any change to compression
// behavior, output, or field count/keys.
// ---------------------------------------------------------------------------
describe("syncMeasurementTemplate — Mentonera input (non-regression)", () => {
  it("accepts a Mentonera-shaped template and syncs it as a separate template", async () => {
    const compressionTemplate = buildCompressionTemplate();
    const mentoneraTemplate = buildMentoneraTemplate();
    const store = createInMemoryRepository();

    const compressionResult = await syncMeasurementTemplate(compressionTemplate, store.repository);
    const mentoneraResult = await syncMeasurementTemplate(mentoneraTemplate, store.repository);

    assert.equal(compressionResult.fieldsCount, 94);
    assert.equal(mentoneraResult.fieldsCount, 3);
    assert.notEqual(compressionResult.templateId, mentoneraResult.templateId);
    assert.equal(store.templates.size, 2);
    assert.ok(store.templates.get(compressionTemplate.code));
    assert.ok(store.templates.get(mentoneraTemplate.code));
  });

  it("leaves compression template output unchanged (field count/keys/values identical)", async () => {
    const compressionTemplate = buildCompressionTemplate();
    const store = createInMemoryRepository();

    // Sync Mentonera first to prove it never mutates the compression path.
    await syncMeasurementTemplate(buildMentoneraTemplate(), store.repository);
    const result = await syncMeasurementTemplate(compressionTemplate, store.repository);

    assert.equal(result.sectionsCount, 4);
    assert.equal(result.fieldsCount, 94);
    assert.equal(store.sections.size, 4 + 1);
    assert.equal(store.fields.size, 94 + 3);
  });
});

describe("syncMentoneraTemplate", () => {
  it("syncs the mentonera-v1 template via an injectable repository", async () => {
    const store = createInMemoryRepository();

    const result = await syncMentoneraTemplate(store.repository);

    assert.equal(result.sectionsCount, 1);
    assert.equal(result.fieldsCount, 3);
    const stored = store.templates.get("mentonera-v1");
    assert.ok(stored);
    assert.equal(result.templateId, stored.id);
  });

  it("is idempotent — second run does not duplicate rows", async () => {
    const store = createInMemoryRepository();

    const first = await syncMentoneraTemplate(store.repository);
    const second = await syncMentoneraTemplate(store.repository);

    assert.equal(second.templateId, first.templateId);
    assert.equal(store.templates.size, 1);
    assert.equal(store.sections.size, 1);
    assert.equal(store.fields.size, 3);
  });
});

describe("syncMascaraTemplate", () => {
  it("syncs the mascara-v1 template via an injectable repository", async () => {
    const store = createInMemoryRepository();

    const result = await syncMascaraTemplate(store.repository);

    assert.equal(result.sectionsCount, 1);
    assert.equal(result.fieldsCount, 2);
    assert.equal(result.templateId, store.templates.get(buildMascaraTemplate().code)?.id);
  });

  it("is idempotent — second run does not duplicate rows", async () => {
    const store = createInMemoryRepository();

    const first = await syncMascaraTemplate(store.repository);
    const second = await syncMascaraTemplate(store.repository);

    assert.equal(second.templateId, first.templateId);
    assert.equal(store.templates.size, 1);
    assert.equal(store.sections.size, 1);
    assert.equal(store.fields.size, 2);
  });
});
