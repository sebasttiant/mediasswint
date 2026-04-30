import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCompressionTemplate } from "../lib/compression-template";
import {
  completeMeasurement,
  createDraftMeasurement,
  getMeasurement,
  listPatientMeasurements,
  updateMeasurementValues,
  type MeasurementSessionDetail,
  type MeasurementSessionStatus,
  type MeasurementsRepository,
  type TemplateSnapshot,
} from "../lib/measurements";

function buildTemplateSnapshot(): TemplateSnapshot {
  const template = buildCompressionTemplate();
  let fieldCounter = 0;
  return {
    templateId: "tpl-1",
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
    sections: template.sections.map((section) => ({
      title: section.title,
      sortOrder: section.sortOrder,
      fields: section.fields.map((field) => {
        fieldCounter += 1;
        return {
          id: `fld-${fieldCounter}`,
          key: field.key,
          label: field.label,
          fieldType: field.fieldType,
          unit: field.unit,
          isRequired: field.isRequired,
          sortOrder: field.sortOrder,
          minValue: field.minValue,
          maxValue: field.maxValue,
          metadata: field.metadata as unknown as Record<string, unknown>,
        };
      }),
    })),
  };
}

type Stored = {
  detail: MeasurementSessionDetail;
};

function createInMemoryRepository(options?: {
  templateSnapshot?: TemplateSnapshot | null;
  knownPatientIds?: ReadonlyArray<string>;
}) {
  const snapshot =
    options && "templateSnapshot" in options ? options.templateSnapshot : buildTemplateSnapshot();
  const patients = new Set(options?.knownPatientIds ?? ["patient-1"]);
  const sessions = new Map<string, Stored>();
  let counter = 0;

  function setStatus(id: string, status: MeasurementSessionStatus) {
    const stored = sessions.get(id);
    if (!stored) return;
    stored.detail = { ...stored.detail, status };
  }

  const repository: MeasurementsRepository = {
    async getActiveTemplateSnapshot(code) {
      if (snapshot && snapshot.code === code) return snapshot;
      return null;
    },

    async patientExists(patientId) {
      return patients.has(patientId);
    },

    async createDraft(input) {
      counter += 1;
      const id = `sess-${counter}`;
      const now = new Date("2026-04-30T12:00:00Z");
      const detail: MeasurementSessionDetail = {
        id,
        patientId: input.patientId,
        templateId: input.templateId,
        status: "DRAFT",
        measuredAt: input.measuredAt,
        notes: input.notes,
        diagnosis: input.diagnosis,
        garmentType: input.garmentType,
        compressionClass: input.compressionClass,
        productFlags: input.productFlags,
        metadata: input.metadata,
        templateSnapshot: input.templateSnapshot,
        values: {},
        createdAt: now,
        updatedAt: now,
      };
      sessions.set(id, { detail });
      return { id };
    },

    async getDetail(id) {
      return sessions.get(id)?.detail ?? null;
    },

    async listByPatient(patientId, limit) {
      const matched = [...sessions.values()]
        .filter((stored) => stored.detail.patientId === patientId)
        .sort((a, b) => b.detail.measuredAt.getTime() - a.detail.measuredAt.getTime())
        .slice(0, limit);
      return matched.map((stored) => ({
        id: stored.detail.id,
        patientId: stored.detail.patientId,
        status: stored.detail.status,
        measuredAt: stored.detail.measuredAt,
        garmentType: stored.detail.garmentType,
        compressionClass: stored.detail.compressionClass,
        diagnosis: stored.detail.diagnosis,
        createdAt: stored.detail.createdAt,
        updatedAt: stored.detail.updatedAt,
      }));
    },

    async replaceValues(input) {
      const stored = sessions.get(input.sessionId);
      if (!stored) return { ok: false, status: null };
      if (stored.detail.status !== "DRAFT") return { ok: false, status: stored.detail.status };

      const fieldIdToKey = new Map<string, string>();
      for (const section of stored.detail.templateSnapshot?.sections ?? []) {
        for (const field of section.fields) fieldIdToKey.set(field.id, field.key);
      }

      const nextValues = { ...stored.detail.values };
      for (const value of input.values) {
        const key = fieldIdToKey.get(value.fieldId);
        if (!key) continue;
        if (value.valueNumber === null) {
          delete nextValues[key];
        } else {
          nextValues[key] = value.valueNumber;
        }
      }
      stored.detail = { ...stored.detail, values: nextValues };
      return { ok: true, status: "DRAFT" };
    },

    async markCompleted(id) {
      const stored = sessions.get(id);
      if (!stored) return { status: "NOT_FOUND" };
      if (stored.detail.status !== "DRAFT") return { status: "INVALID_STATE" };
      setStatus(id, "COMPLETED");
      return { status: "COMPLETED" };
    },
  };

  return { repository, sessions, snapshot };
}

const baseInput = {
  patientId: "patient-1",
  templateCode: "compression-v1",
  measuredAt: new Date("2026-04-30T12:00:00Z"),
  notes: null,
  diagnosis: null,
  garmentType: "media-corta",
  compressionClass: "II",
  productFlags: { mediaCorta: true },
  metadata: null,
};

describe("createDraftMeasurement", () => {
  it("creates a DRAFT session with the active template snapshot", async () => {
    const store = createInMemoryRepository();
    const result = await createDraftMeasurement(baseInput, store.repository);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.templateSnapshot.code, "compression-v1");

    const stored = store.sessions.get(result.value.id);
    assert.ok(stored);
    assert.equal(stored.detail.status, "DRAFT");
    assert.equal(stored.detail.garmentType, "media-corta");
    assert.equal(stored.detail.compressionClass, "II");
    assert.deepEqual(stored.detail.productFlags, { mediaCorta: true });
    assert.equal(stored.detail.templateSnapshot?.sections.length, 4);
  });

  it("returns PATIENT_NOT_FOUND when patient does not exist", async () => {
    const store = createInMemoryRepository({ knownPatientIds: [] });
    const result = await createDraftMeasurement(baseInput, store.repository);
    assert.deepEqual(result, { ok: false, error: "PATIENT_NOT_FOUND" });
  });

  it("returns TEMPLATE_NOT_FOUND when no active template matches the code", async () => {
    const store = createInMemoryRepository({ templateSnapshot: null });
    const result = await createDraftMeasurement(baseInput, store.repository);
    assert.deepEqual(result, { ok: false, error: "TEMPLATE_NOT_FOUND" });
  });
});

describe("updateMeasurementValues", () => {
  it("upserts numeric values keyed by template field key in DRAFT", async () => {
    const store = createInMemoryRepository();
    const created = await createDraftMeasurement(baseInput, store.repository);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const result = await updateMeasurementValues(
      created.value.id,
      { valuesByKey: { legRight1: 24.5, legRight2: 25 } },
      store.repository,
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.updated, 2);

    const detail = store.sessions.get(created.value.id)?.detail;
    assert.equal(detail?.values.legRight1, 24.5);
    assert.equal(detail?.values.legRight2, 25);
  });

  it("clears a key when value is null", async () => {
    const store = createInMemoryRepository();
    const created = await createDraftMeasurement(baseInput, store.repository);
    if (!created.ok) throw new Error("setup failed");

    await updateMeasurementValues(
      created.value.id,
      { valuesByKey: { legRight1: 24.5 } },
      store.repository,
    );
    await updateMeasurementValues(
      created.value.id,
      { valuesByKey: { legRight1: null } },
      store.repository,
    );

    const detail = store.sessions.get(created.value.id)?.detail;
    assert.equal(detail?.values.legRight1, undefined);
  });

  it("rejects unknown field keys", async () => {
    const store = createInMemoryRepository();
    const created = await createDraftMeasurement(baseInput, store.repository);
    if (!created.ok) throw new Error("setup failed");

    const result = await updateMeasurementValues(
      created.value.id,
      { valuesByKey: { temperatureC: 36.5 } },
      store.repository,
    );

    assert.deepEqual(result, { ok: false, error: "UNKNOWN_KEYS" });
  });

  it("returns NOT_FOUND when session does not exist", async () => {
    const store = createInMemoryRepository();
    const result = await updateMeasurementValues(
      "missing",
      { valuesByKey: {} },
      store.repository,
    );
    assert.deepEqual(result, { ok: false, error: "NOT_FOUND" });
  });

  it("returns INVALID_STATE when session is not DRAFT", async () => {
    const store = createInMemoryRepository();
    const created = await createDraftMeasurement(baseInput, store.repository);
    if (!created.ok) throw new Error("setup failed");
    await completeMeasurement(created.value.id, store.repository);

    const result = await updateMeasurementValues(
      created.value.id,
      { valuesByKey: { legRight1: 24.5 } },
      store.repository,
    );

    assert.deepEqual(result, { ok: false, error: "INVALID_STATE" });
  });
});

describe("completeMeasurement", () => {
  it("transitions DRAFT to COMPLETED", async () => {
    const store = createInMemoryRepository();
    const created = await createDraftMeasurement(baseInput, store.repository);
    if (!created.ok) throw new Error("setup failed");

    const result = await completeMeasurement(created.value.id, store.repository);
    assert.deepEqual(result, { ok: true, value: { id: created.value.id, status: "COMPLETED" } });
    assert.equal(store.sessions.get(created.value.id)?.detail.status, "COMPLETED");
  });

  it("returns NOT_FOUND for missing session", async () => {
    const store = createInMemoryRepository();
    const result = await completeMeasurement("missing", store.repository);
    assert.deepEqual(result, { ok: false, error: "NOT_FOUND" });
  });

  it("returns INVALID_STATE when already COMPLETED", async () => {
    const store = createInMemoryRepository();
    const created = await createDraftMeasurement(baseInput, store.repository);
    if (!created.ok) throw new Error("setup failed");
    await completeMeasurement(created.value.id, store.repository);

    const result = await completeMeasurement(created.value.id, store.repository);
    assert.deepEqual(result, { ok: false, error: "INVALID_STATE" });
  });
});

describe("getMeasurement", () => {
  it("returns the persisted detail", async () => {
    const store = createInMemoryRepository();
    const created = await createDraftMeasurement(baseInput, store.repository);
    if (!created.ok) throw new Error("setup failed");

    const result = await getMeasurement(created.value.id, store.repository);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.id, created.value.id);
    assert.equal(result.value.status, "DRAFT");
  });

  it("returns NOT_FOUND when missing", async () => {
    const store = createInMemoryRepository();
    const result = await getMeasurement("missing", store.repository);
    assert.deepEqual(result, { ok: false, error: "NOT_FOUND" });
  });
});

describe("listPatientMeasurements", () => {
  it("returns sessions for the patient ordered by measuredAt desc", async () => {
    const store = createInMemoryRepository();
    const first = await createDraftMeasurement(
      { ...baseInput, measuredAt: new Date("2026-04-29T10:00:00Z") },
      store.repository,
    );
    const second = await createDraftMeasurement(
      { ...baseInput, measuredAt: new Date("2026-04-30T10:00:00Z") },
      store.repository,
    );
    if (!first.ok || !second.ok) throw new Error("setup failed");

    const result = await listPatientMeasurements(
      "patient-1",
      { limit: 10 },
      store.repository,
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.length, 2);
    assert.equal(result.value[0].id, second.value.id);
    assert.equal(result.value[1].id, first.value.id);
  });
});
