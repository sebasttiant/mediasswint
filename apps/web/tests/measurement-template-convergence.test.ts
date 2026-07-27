import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  syncMeasurementTemplate,
  type MeasurementTemplateInput,
  type MeasurementTemplatesRepository,
} from "../lib/measurement-templates";

/**
 * Convergence contract: the ACTIVE definition of a template must equal exactly
 * what the code declares, while every row that history points at survives.
 *
 * The rejected alternative was deleting obsolete rows. That cannot work here:
 * MeasurementValue.field is onDelete: Restrict, so deleting a field that was
 * ever measured is refused by Postgres and aborts the whole seed. Filtering the
 * delete to unreferenced rows only moved the bug — a field referenced solely by
 * a draft's persisted snapshot JSON has no MeasurementValue, so it was deleted
 * out from under a live draft.
 *
 * Deactivation solves both: nothing is ever deleted, and snapshots project only
 * active rows.
 */

type FieldRow = {
  id: string;
  sectionId: string;
  key: string;
  sortOrder: number;
  isActive: boolean;
};

type SectionRow = {
  id: string;
  templateId: string;
  title: string;
  isActive: boolean;
};

function createInMemoryRepository() {
  const templates = new Map<string, { id: string; code: string }>();
  const sections = new Map<string, SectionRow>();
  const fields = new Map<string, FieldRow>();
  let seq = 0;

  const repository: MeasurementTemplatesRepository = {
    async upsertTemplate(input) {
      const existing = templates.get(input.code);
      if (existing) return { id: existing.id };
      const id = `tpl_${(seq += 1)}`;
      templates.set(input.code, { id, code: input.code });
      return { id };
    },

    async upsertSection(input) {
      for (const section of sections.values()) {
        if (section.templateId === input.templateId && section.title === input.title) {
          // Re-declaring a section revives it.
          section.isActive = true;
          return { id: section.id };
        }
      }
      const id = `sec_${(seq += 1)}`;
      sections.set(id, { id, templateId: input.templateId, title: input.title, isActive: true });
      return { id };
    },

    async upsertField(input) {
      for (const field of fields.values()) {
        if (field.sectionId === input.sectionId && field.key === input.key) {
          field.isActive = true;
          field.sortOrder = input.sortOrder;
          return { id: field.id };
        }
      }
      const id = `fld_${(seq += 1)}`;
      fields.set(id, {
        id,
        sectionId: input.sectionId,
        key: input.key,
        sortOrder: input.sortOrder,
        isActive: true,
      });
      return { id };
    },

    async deactivateFieldsNotIn(input) {
      let deactivated = 0;
      for (const field of fields.values()) {
        if (field.sectionId !== input.sectionId) continue;
        if (input.keys.includes(field.key)) continue;
        if (!field.isActive) continue;
        field.isActive = false;
        deactivated += 1;
      }
      return { deactivated };
    },

    async deactivateSectionsNotIn(input) {
      let deactivated = 0;
      for (const section of sections.values()) {
        if (section.templateId !== input.templateId) continue;
        if (input.titles.includes(section.title)) continue;
        if (!section.isActive) continue;
        section.isActive = false;
        // Fields of a retired section are retired with it.
        for (const field of fields.values()) {
          if (field.sectionId === section.id) field.isActive = false;
        }
        deactivated += 1;
      }
      return { deactivated };
    },
  };

  return { repository, templates, sections, fields };
}

function buildTemplate(fieldKeys: string[], sectionTitles = ["Cabeza"]): MeasurementTemplateInput {
  return {
    code: "probe-v1",
    name: "Probe v1",
    version: 1,
    description: "Probe template",
    sections: sectionTitles.map((title, sectionIndex) => ({
      title,
      sortOrder: sectionIndex,
      fields: fieldKeys.map((key, fieldIndex) => ({
        key,
        label: `Label ${key}`,
        fieldType: "NUMBER" as const,
        unit: "cm",
        isRequired: false,
        sortOrder: fieldIndex,
        minValue: 1,
        maxValue: 100,
        metadata: {},
      })),
    })),
  };
}

describe("template sync converges the ACTIVE definition without deleting history", () => {
  it("deactivates a field dropped from the current definition", async () => {
    const store = createInMemoryRepository();

    await syncMeasurementTemplate(buildTemplate(["a", "b", "stale"]), store.repository);
    await syncMeasurementTemplate(buildTemplate(["a", "b"]), store.repository);

    const stale = [...store.fields.values()].find((field) => field.key === "stale");
    assert.ok(stale, "the obsolete row must still exist");
    assert.equal(stale.isActive, false);
  });

  it("never deletes a row, so history and draft snapshots keep resolving", async () => {
    const store = createInMemoryRepository();

    await syncMeasurementTemplate(buildTemplate(["a", "stale"]), store.repository);
    const staleIdBefore = [...store.fields.values()].find((f) => f.key === "stale")?.id;

    await syncMeasurementTemplate(buildTemplate(["a"]), store.repository);

    assert.equal(store.fields.size, 2);
    const staleIdAfter = [...store.fields.values()].find((f) => f.key === "stale")?.id;
    assert.equal(staleIdAfter, staleIdBefore, "the row id must be stable for snapshot references");
  });

  it("reports what it deactivated", async () => {
    const store = createInMemoryRepository();

    await syncMeasurementTemplate(buildTemplate(["a", "b", "c"]), store.repository);
    const result = await syncMeasurementTemplate(buildTemplate(["a"]), store.repository);

    assert.equal(result.deactivatedFieldsCount, 2);
    assert.equal(result.deactivatedSectionsCount, 0);
  });

  it("is idempotent — a second identical sync deactivates nothing", async () => {
    const store = createInMemoryRepository();

    await syncMeasurementTemplate(buildTemplate(["a", "b", "stale"]), store.repository);
    await syncMeasurementTemplate(buildTemplate(["a", "b"]), store.repository);
    const third = await syncMeasurementTemplate(buildTemplate(["a", "b"]), store.repository);

    assert.equal(third.deactivatedFieldsCount, 0);
    assert.equal(third.deactivatedSectionsCount, 0);
    assert.equal(third.fieldsCount, 2);
  });

  it("revives a field that comes back in a later definition", async () => {
    const store = createInMemoryRepository();

    await syncMeasurementTemplate(buildTemplate(["a", "b"]), store.repository);
    await syncMeasurementTemplate(buildTemplate(["a"]), store.repository);
    await syncMeasurementTemplate(buildTemplate(["a", "b"]), store.repository);

    const revived = [...store.fields.values()].find((field) => field.key === "b");
    assert.equal(revived?.isActive, true);
    assert.equal(store.fields.size, 2, "reviving must reuse the row, not create a duplicate");
  });

  it("deactivates a whole section dropped from the definition, and its fields with it", async () => {
    const store = createInMemoryRepository();

    await syncMeasurementTemplate(buildTemplate(["a"], ["Cabeza", "Cuello"]), store.repository);
    const result = await syncMeasurementTemplate(
      buildTemplate(["a"], ["Cabeza"]),
      store.repository,
    );

    assert.equal(result.deactivatedSectionsCount, 1);
    const retired = [...store.sections.values()].find((section) => section.title === "Cuello");
    assert.equal(retired?.isActive, false);
    const retiredFields = [...store.fields.values()].filter((f) => f.sectionId === retired?.id);
    assert.ok(retiredFields.length > 0);
    assert.ok(retiredFields.every((field) => !field.isActive));
  });
});
