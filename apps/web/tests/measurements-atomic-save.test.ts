import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  updateMeasurementValues,
  type MeasurementSessionDetail,
  type MeasurementsRepository,
  type TemplateSnapshot,
} from "../lib/measurements";
import { classifyPersistedSnapshot } from "../lib/template-snapshot";

/**
 * B3 — a draft save is ONE clinical operation.
 *
 * Context and values were written through two separate repository calls, each
 * with its own transaction. If the second failed — or the session was completed
 * concurrently between them — the API reported failure while the context change
 * had already committed. The record then carried new context with old values,
 * and the audit entry describing the change never ran.
 */

const SNAPSHOT: TemplateSnapshot = {
  templateId: "tpl-1",
  code: "compression-v1",
  name: "Compresión v1",
  version: 1,
  description: null,
  sections: [
    {
      title: "Pierna derecha",
      sortOrder: 0,
      fields: [
        {
          id: "fld-1",
          key: "legRight1",
          label: "Pierna derecha 1",
          fieldType: "NUMBER",
          unit: "cm",
          isRequired: false,
          sortOrder: 1,
          minValue: 5,
          maxValue: 200,
          metadata: {},
        },
      ],
    },
  ],
};

type Store = {
  repository: MeasurementsRepository;
  session: MeasurementSessionDetail;
  calls: string[];
};

function buildStore(options: { failSave?: boolean; completeDuring?: boolean; throwSecret?: boolean } = {}): Store {
  const calls: string[] = [];
  const session: MeasurementSessionDetail = {
    id: "ses-1",
    patientId: "pat-1",
    templateId: "tpl-1",
    status: "DRAFT",
    measuredAt: new Date("2026-05-04T10:00:00Z"),
    notes: "nota original",
    diagnosis: "dx original",
    garmentType: "MC",
    compressionClass: null,
    productFlags: null,
    metadata: null,
    ...classifyPersistedSnapshot(SNAPSHOT),
    values: { legRight1: 30 },
    createdAt: new Date("2026-05-04T10:00:00Z"),
    updatedAt: new Date("2026-05-04T10:00:00Z"),
  };

  const repository: MeasurementsRepository = {
    async getActiveTemplateSnapshot() {
      return SNAPSHOT;
    },
    async patientExists() {
      return true;
    },
    async createDraft() {
      calls.push("createDraft");
      return { id: "ses-new" };
    },
    async getDetail() {
      return session;
    },
    async listByPatient() {
      return [];
    },
    async saveDraft(input: { sessionId: string; context?: { notes?: string | null; diagnosis?: string | null }; values: Array<{ fieldId: string; valueNumber: number | null }> }) {
      calls.push("saveDraft");
      // A real transaction re-checks status inside the transaction.
      if (options.completeDuring) {
        session.status = "COMPLETED";
        return { ok: false, status: "COMPLETED" };
      }
      if (session.status !== "DRAFT") return { ok: false, status: session.status };
      if (options.failSave) return { ok: false, status: "DRAFT" };
      if (options.throwSecret) {
        const error = new Error("INSERT clinical value = 42.5");
        Object.assign(error, { code: "P2003" });
        throw error;
      }

      if (input.context) {
        if (input.context.notes !== undefined) session.notes = input.context.notes;
        if (input.context.diagnosis !== undefined) session.diagnosis = input.context.diagnosis;
      }
      const next = { ...session.values };
      const byId = new Map(SNAPSHOT.sections[0]!.fields.map((f) => [f.id, f.key]));
      for (const value of input.values) {
        const key = byId.get(value.fieldId);
        if (!key) continue;
        if (value.valueNumber === null) delete next[key];
        else next[key] = value.valueNumber;
      }
      session.values = next;
      return { ok: true, status: "DRAFT" };
    },
    async replaceValues() {
      calls.push("replaceValues");
      return { ok: true, status: "DRAFT" };
    },
    async updateContext() {
      calls.push("updateContext");
      return { ok: true, status: "DRAFT" };
    },
    async markCompleted() {
      return { status: "COMPLETED", completedAt: new Date() };
    },
    async reopenToDraft() {
      return { ok: true, status: "DRAFT" };
    },
  } as unknown as MeasurementsRepository;

  return { repository, session, calls };
}

describe("a draft save is one atomic clinical operation", () => {
  it("persists context and values through a SINGLE repository call", async () => {
    const store = buildStore();

    const result = await updateMeasurementValues(
      "ses-1",
      { valuesByKey: { legRight1: 42 }, notes: "nota nueva" },
      store.repository,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(
      store.calls.filter((c) => c === "saveDraft"),
      ["saveDraft"],
    );
    assert.equal(
      store.calls.includes("updateContext"),
      false,
      "context must not be written in its own transaction",
    );
    assert.equal(store.calls.includes("replaceValues"), false);
    assert.equal(store.session.notes, "nota nueva");
    assert.deepEqual(store.session.values, { legRight1: 42 });
  });

  it("changes NOTHING when the save fails", async () => {
    const store = buildStore({ failSave: true });

    const result = await updateMeasurementValues(
      "ses-1",
      { valuesByKey: { legRight1: 42 }, notes: "nota nueva", diagnosis: "dx nuevo" },
      store.repository,
    );

    assert.equal(result.ok, false);
    assert.equal(store.session.notes, "nota original", "context must not have committed");
    assert.equal(store.session.diagnosis, "dx original");
    assert.deepEqual(store.session.values, { legRight1: 30 }, "values must not have changed");
  });

  it("a concurrent completion leaves no partial context change", async () => {
    const store = buildStore({ completeDuring: true });

    const result = await updateMeasurementValues(
      "ses-1",
      { valuesByKey: { legRight1: 42 }, notes: "nota nueva" },
      store.repository,
    );

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "INVALID_STATE");
    assert.equal(store.session.notes, "nota original");
    assert.deepEqual(store.session.values, { legRight1: 30 });
  });

  it("a values-only save still goes through the single atomic call", async () => {
    const store = buildStore();

    const result = await updateMeasurementValues(
      "ses-1",
      { valuesByKey: { legRight1: 55 } },
      store.repository,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(store.calls, ["saveDraft"]);
    assert.deepEqual(store.session.values, { legRight1: 55 });
  });

  it("never logs raw driver messages or clinical values when a save fails", async () => {
    const store = buildStore({ throwSecret: true });
    const calls: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => calls.push(args);
    try {
      const result = await updateMeasurementValues(
        "ses-1",
        { valuesByKey: { legRight1: 42.5 } },
        store.repository,
      );
      assert.equal(result.ok, false);
    } finally {
      console.error = originalError;
    }

    const output = JSON.stringify(calls);
    assert.match(output, /P2003/);
    assert.doesNotMatch(output, /INSERT clinical value|42\.5/);
  });
});
