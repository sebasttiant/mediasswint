import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMpBermudaTemplate } from "../lib/mp-bermuda-template";
import {
  classifyMpCompletionSnapshot,
  mergeAndValidateMpCompletionValues,
} from "../lib/mp-bermuda-completion";
import {
  saveAndCompleteMeasurement,
  type MeasurementSessionDetail,
  type MeasurementsRepository,
  type TemplateSnapshot,
} from "../lib/measurements";

function mpSnapshot(): TemplateSnapshot {
  const template = buildMpBermudaTemplate();
  return {
    templateId: "mp-template",
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
    sections: template.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field, index) => ({ ...field, id: `field-${index}` })),
    })),
  };
}

describe("MP/Bermuda completion contract", () => {
  it("rejects a frozen snapshot missing one canonical field", () => {
    const snapshot = mpSnapshot();
    const [firstSection, ...otherSections] = snapshot.sections;
    const incomplete = {
      ...snapshot,
      sections: [{ ...firstSection, fields: firstSection.fields.slice(1) }, ...otherSections],
    };

    assert.deepEqual(classifyMpCompletionSnapshot(incomplete), {
      ok: false,
      errors: [
        {
          field: `templateSnapshot.fields.${firstSection.fields[0].key}`,
          message: "required MP/Bermuda field is missing",
        },
      ],
    });
  });

  it("uses submitted values, including null, over persisted values and reports the value key", () => {
    const snapshot = mpSnapshot();
    const values = Object.fromEntries(
      snapshot.sections.flatMap((section) => section.fields.map((field) => [field.key, 12])),
    );
    const key = snapshot.sections[0].fields[0].key;

    assert.deepEqual(mergeAndValidateMpCompletionValues(values, { [key]: null }), {
      ok: false,
      errors: [{ field: `valuesByKey.${key}`, message: "a finite value is required" }],
    });
  });

  it("classifies duplicate, unexpected, malformed side, and malformed endpoints by their keys", () => {
    const snapshot = mpSnapshot();
    const field = snapshot.sections[0].fields[0];
    const duplicate = { ...field, id: "duplicate" };
    const unexpected = { ...field, id: "unexpected", key: "notMp" };
    const distance = snapshot.sections.flatMap((section) => section.fields).find((candidate) => "fromStationId" in candidate.metadata)!;
    const withExtra = (broken: typeof field) => ({ ...snapshot, sections: [{ ...snapshot.sections[0], fields: [...snapshot.sections[0].fields, broken] }, ...snapshot.sections.slice(1)] });
    const withReplacement = (key: string, broken: typeof field) => ({ ...snapshot, sections: snapshot.sections.map((section) => ({ ...section, fields: section.fields.map((candidate) => candidate.key === key ? broken : candidate) })) });

    for (const [broken, message] of [[withExtra(duplicate), "duplicated"], [withExtra(unexpected), "unexpected"], [withReplacement(field.key, { ...field, metadata: { ...field.metadata, side: "left" } }), "ownership"], [withReplacement(distance.key, { ...distance, metadata: { ...distance.metadata, toStationId: "wrong" } }), "ownership"]] as const) {
      const result = classifyMpCompletionSnapshot(broken);
      assert.equal(result.ok, false);
      if (!result.ok) assert.ok(result.errors.some((error) => error.message.includes(message)));
    }
  });

  it("rejects an incomplete MP completion before the atomic primitive but completes an exact merged snapshot atomically", async () => {
    const snapshot = mpSnapshot();
    const completeValues = Object.fromEntries(
      snapshot.sections.flatMap((section) => section.fields.map((field) => [field.key, field.minValue])),
    );
    let atomicCalls = 0;
    const detail: MeasurementSessionDetail = {
      id: "session-1", patientId: "patient-1", templateId: "mp-template", status: "DRAFT", measuredAt: new Date(),
      notes: null, diagnosis: null, garmentType: "MP", compressionClass: null, productFlags: null, metadata: null,
      templateSnapshot: snapshot, templateSnapshotState: "valid", values: completeValues, createdAt: new Date(), updatedAt: new Date(),
    };
    const repository = {
      getDetail: async () => detail,
      saveDraftAndComplete: async () => { atomicCalls += 1; return { status: "COMPLETED" as const }; },
    } as unknown as MeasurementsRepository;

    const incomplete = await saveAndCompleteMeasurement("session-1", { valuesByKey: { mpHeight: null } }, repository);
    assert.deepEqual(incomplete, {
      ok: false,
      error: "MP_COMPLETION_INVALID",
      errors: [{ field: "valuesByKey.mpHeight", message: "a finite value is required" }],
    });
    assert.equal(atomicCalls, 0);

    const completed = await saveAndCompleteMeasurement("session-1", { valuesByKey: { mpHeight: 180 } }, repository);
    assert.deepEqual(completed, { ok: true, value: { id: "session-1", status: "COMPLETED" } });
    assert.equal(atomicCalls, 1);
  });
});
