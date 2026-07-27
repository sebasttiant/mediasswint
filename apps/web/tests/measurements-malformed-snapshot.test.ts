import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  duplicateCompletedMeasurement,
  updateMeasurementValues,
  type MeasurementSessionDetail,
  type MeasurementsRepository,
  type TemplateSnapshot,
} from "../lib/measurements";

/**
 * The demo seeder persisted template identity WITHOUT a `sections` key. Every
 * consumer that iterated `snapshot.sections` threw a TypeError on those rows,
 * turning a data problem into a 500 and — in the duplication path — into an
 * orphan draft left behind in the database.
 */
const SEEDER_SHAPED_SNAPSHOT = {
  templateCode: "compression-v1",
  templateName: "Compresión v1",
  version: 1,
  marker: "demo",
} as unknown as TemplateSnapshot;

function buildDetail(overrides: Partial<MeasurementSessionDetail> = {}): MeasurementSessionDetail {
  return {
    id: "ses_1",
    patientId: "pat_1",
    templateId: "tpl_1",
    status: "DRAFT",
    measuredAt: new Date("2026-01-01T12:00:00.000Z"),
    notes: null,
    diagnosis: null,
    garmentType: "MC",
    compressionClass: null,
    productFlags: null,
    metadata: null,
    // The repository boundary would classify this stored-but-unreadable JSON
    // as "malformed"; the fake states it explicitly so the service sees exactly
    // what production hands it.
    templateSnapshot: null,
    templateSnapshotState: "malformed",
    values: {},
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    updatedAt: new Date("2026-01-01T12:00:00.000Z"),
    ...overrides,
  };
}

function buildRepository(detail: MeasurementSessionDetail) {
  const createdDrafts: string[] = [];
  const replacedFor: string[] = [];
  const contextUpdates: string[] = [];

  const repository: MeasurementsRepository = {
    async getActiveTemplateSnapshot() {
      return null;
    },
    async patientExists() {
      return true;
    },
    async createDraft() {
      const id = `ses_copy_${createdDrafts.length + 1}`;
      createdDrafts.push(id);
      return { id };
    },
    async createDraftWithValues(input) {
      // Records the draft only on success, mirroring the real transaction.
      const id = `ses_copy_${createdDrafts.length + 1}`;
      if (input.values.some((value) => value.fieldId === "FAIL")) {
        throw new Error("createDraftWithValues rolled back");
      }
      createdDrafts.push(id);
      replacedFor.push(id);
      return { ok: true as const, id };
    },
    async getDetail() {
      return detail;
    },
    async listByPatient() {
      return [];
    },
    async replaceValues(input) {
      replacedFor.push(input.sessionId);
      return { ok: true, status: "DRAFT" };
    },
    async saveDraft(input) {
      // Records BOTH halves so a test can assert that a refused request wrote
      // nothing at all.
      if (input.context) contextUpdates.push(input.sessionId);
      replacedFor.push(input.sessionId);
      return { ok: true, status: "DRAFT" };
    },
    async updateContext(input) {
      contextUpdates.push(input.sessionId);
      return { ok: true, status: "DRAFT" };
    },
    async markCompleted() {
      return { status: "COMPLETED", completedAt: new Date() };
    },
    async reopenToDraft() {
      return { ok: true, status: "DRAFT" };
    },
  };

  return { repository, createdDrafts, replacedFor, contextUpdates };
}

describe("malformed persisted snapshots are refused, not crashed on", () => {
  it("updateMeasurementValues returns MALFORMED_TEMPLATE_SNAPSHOT instead of throwing", async () => {
    const { repository } = buildRepository(buildDetail());

    const result = await updateMeasurementValues(
      "ses_1",
      { valuesByKey: { legRight1: 30 } },
      repository,
    );

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "MALFORMED_TEMPLATE_SNAPSHOT");
  });

  it("a refused malformed update writes no context and no values", async () => {
    const { repository, replacedFor, contextUpdates } = buildRepository(buildDetail());

    await updateMeasurementValues(
      "ses_1",
      { valuesByKey: { legRight1: 30 }, notes: "changed" },
      repository,
    );

    assert.deepEqual(contextUpdates, []);
    assert.deepEqual(replacedFor, []);
  });

  it("duplication refuses a malformed snapshot and leaves NO orphan draft", async () => {
    const { repository, createdDrafts } = buildRepository(
      buildDetail({ status: "COMPLETED" }),
    );

    const result = await duplicateCompletedMeasurement("ses_1", repository);

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "MALFORMED_TEMPLATE_SNAPSHOT");
    // The regression: the draft used to be created BEFORE the snapshot was
    // indexed, so the TypeError left a stranded DRAFT session behind.
    assert.deepEqual(createdDrafts, []);
  });

  it("still distinguishes a genuinely absent snapshot from a malformed one", async () => {
    const { repository } = buildRepository(buildDetail({ templateSnapshot: null, templateSnapshotState: "absent" }));

    const result = await updateMeasurementValues(
      "ses_1",
      { valuesByKey: { legRight1: 30 } },
      repository,
    );

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "TEMPLATE_NOT_FOUND");
  });

  it("a valid snapshot is unaffected by the new guard", async () => {
    const valid: TemplateSnapshot = {
      templateId: "tpl_1",
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
              id: "fld_1",
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
    const { repository, replacedFor } = buildRepository(
      buildDetail({ templateSnapshot: valid, templateSnapshotState: "valid" }),
    );

    const result = await updateMeasurementValues(
      "ses_1",
      { valuesByKey: { legRight1: 30 } },
      repository,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(replacedFor, ["ses_1"]);
  });
});

/**
 * H — logical atomicity of duplication, and what is logged when it is not.
 */
const VALID_SNAPSHOT: TemplateSnapshot = {
  templateId: "tpl_1",
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
          id: "fld_1",
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

describe("duplication write boundary under injected failure", () => {
  it("leaves NO draft when the copy fails: duplication is atomic, not fail-safe-with-leftover", async () => {
    const valid: TemplateSnapshot = {
      templateId: "tpl_1",
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
              id: "fld_1",
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
    const source = buildDetail({
      status: "COMPLETED",
      templateSnapshot: valid,
      templateSnapshotState: "valid",
      values: { legRight1: 30 },
    });
    const { repository, createdDrafts } = buildRepository(source);
    // Inject a failure inside the atomic duplication.
    repository.createDraftWithValues = async () => {
      throw new Error("value write failed inside the transaction");
    };

    const result = await duplicateCompletedMeasurement("ses_1", repository);

    assert.equal(result.ok, false);
    // The source record must be exactly as it was.
    assert.equal(source.status, "COMPLETED");
    assert.deepEqual(source.values, { legRight1: 30 });
    // No orphan: the destination draft rolls back with the values.
    assert.deepEqual(createdDrafts, []);
  });

  it("repeated failed duplications accumulate no drafts at all", async () => {
    const { repository, createdDrafts } = buildRepository(
      buildDetail({
        status: "COMPLETED",
        templateSnapshot: VALID_SNAPSHOT,
        templateSnapshotState: "valid",
      }),
    );
    repository.createDraftWithValues = async () => {
      throw new Error("value write failed inside the transaction");
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await duplicateCompletedMeasurement("ses_1", repository);
    }

    assert.deepEqual(createdDrafts, []);
  });

  it("logs only safe identifiers, never clinical values", async () => {
    const logged: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(...args);
    };
    try {
      const { repository } = buildRepository(buildDetail({ status: "COMPLETED" }));
      await duplicateCompletedMeasurement("ses_1", repository);
    } finally {
      console.error = original;
    }

    const serialized = JSON.stringify(logged);
    for (const forbidden of ["dx original", "nota original", "56.5", "Probe Convergence"]) {
      assert.equal(
        serialized.includes(forbidden),
        false,
        `clinical/personal data leaked into logs: ${forbidden}`,
      );
    }
  });
});
