import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionCookieName, type AuthUser } from "../lib/auth";
import {
  handlePatchMeasurementRequest,
  type MeasurementSessionDeps,
} from "../app/api/patients/[id]/measurements/[sessionId]/route";
import {
  handlePostMeasurementRequest,
  type MeasurementsCollectionDeps,
} from "../app/api/patients/[id]/measurements/route";
import {
  type MeasurementSessionDetail,
  type MeasurementSessionStatus,
  type MeasurementsRepository,
  type TemplateSnapshot,
} from "../lib/measurements";
import { classifyPersistedSnapshot } from "../lib/template-snapshot";
import { buildCompressionTemplate } from "../lib/compression-template";
import { buildMentoneraTemplate } from "../lib/mentonera-template";
import { buildMascaraTemplate } from "../lib/mascara-template";

/**
 * F4 — clinical garment identity and measurement schema must never disagree.
 *
 * garmentType and metadata.garmentSnapshot were free client input, so a caller
 * could relabel a mascara-v1 session (2 measurements) as "Mentonera"
 * (3 measurements) while keeping the Máscara schema. The server now resolves
 * garment identity canonically and refuses any change that crosses a template
 * boundary.
 */

const staffUser: AuthUser = {
  id: "staff-1",
  email: "staff@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Staff",
  role: "STAFF",
};

function snapshotFrom(
  tpl: { code: string; name: string; version: number; description: string; sections: ReadonlyArray<{ title: string; sortOrder: number; fields: ReadonlyArray<Record<string, unknown>> }> },
  templateId: string,
): TemplateSnapshot {
  let counter = 0;
  return {
    templateId,
    code: tpl.code,
    name: tpl.name,
    version: tpl.version,
    description: tpl.description,
    sections: tpl.sections.map((section) => ({
      title: section.title,
      sortOrder: section.sortOrder,
      fields: section.fields.map((field) => {
        counter += 1;
        return {
          id: `${templateId}-fld-${counter}`,
          key: field["key"] as string,
          label: field["label"] as string,
          fieldType: "NUMBER" as const,
          unit: field["unit"] as string,
          isRequired: field["isRequired"] as boolean,
          sortOrder: field["sortOrder"] as number,
          minValue: field["minValue"] as number,
          maxValue: field["maxValue"] as number,
          metadata: (field["metadata"] ?? {}) as Record<string, unknown>,
        };
      }),
    })),
  };
}

const mascaraSnapshot = () => snapshotFrom(buildMascaraTemplate(), "tpl-mascara");
const mentoneraSnapshot = () => snapshotFrom(buildMentoneraTemplate(), "tpl-mentonera");
const compressionSnapshot = () => snapshotFrom(buildCompressionTemplate(), "tpl-compression");

function buildRepository(snapshot: TemplateSnapshot, garmentType: string) {
  const sessions = new Map<string, MeasurementSessionDetail>();
  const writes: string[] = [];
  const now = new Date("2026-05-01T10:00:00Z");

  sessions.set("ses-1", {
    id: "ses-1",
    patientId: "pat-1",
    templateId: snapshot.templateId,
    status: "DRAFT",
    measuredAt: now,
    notes: "nota original",
    diagnosis: "dx original",
    garmentType,
    compressionClass: null,
    productFlags: null,
    metadata: { patientSex: "FEMALE", garmentSnapshot: { reference: garmentType } },
    ...classifyPersistedSnapshot(snapshot),
    values: {},
    createdAt: now,
    updatedAt: now,
  });

  const repository: MeasurementsRepository = {
    async getActiveTemplateSnapshot() {
      return snapshot;
    },
    async patientExists() {
      return true;
    },
    async createDraft() {
      writes.push("createDraft");
      return { id: "ses-new" };
    },
    // Atomic in the fake too: if any value fails, no draft is recorded.
    async createDraftWithValues(input) {
      const created = await repository.createDraft(input.draft);
      const copied = await repository.replaceValues({
        sessionId: created.id,
        values: input.values,
      });
      if (!copied.ok) throw new Error("createDraftWithValues rolled back");
      return { ok: true as const, id: created.id };
    },

    async getDetail(id) {
      return sessions.get(id) ?? null;
    },
    async listByPatient() {
      return [];
    },
    async replaceValues(input) {
      writes.push("replaceValues");
      const session = sessions.get(input.sessionId);
      if (!session) return { ok: false, status: null };
      return { ok: true, status: "DRAFT" };
    },
    // Mirrors the transactional contract: status is checked first, then both
    // halves are applied; a failure in either leaves the session untouched.
    async saveDraft(input) {
      const session = sessions.get(input.sessionId);
      if (!session) return { ok: false, status: null };
      if (session.status !== "DRAFT") return { ok: false, status: session.status };
      if (input.context) {
        const context = await repository.updateContext({
          sessionId: input.sessionId,
          ...input.context,
        });
        if (!context.ok) return context;
      }
      return repository.replaceValues({ sessionId: input.sessionId, values: input.values });
    },

    async updateContext(input) {
      writes.push("updateContext");
      const session = sessions.get(input.sessionId);
      if (!session) return { ok: false, status: null };
      sessions.set(input.sessionId, {
        ...session,
        garmentType: input.garmentType !== undefined ? input.garmentType : session.garmentType,
        notes: input.notes !== undefined ? input.notes : session.notes,
        metadata: input.metadata !== undefined ? input.metadata : session.metadata,
      });
      return { ok: true, status: "DRAFT" };
    },
    async markCompleted(id) {
      writes.push("markCompleted");
      const session = sessions.get(id);
      if (!session) return { status: "NOT_FOUND" };
      sessions.set(id, { ...session, status: "COMPLETED" as MeasurementSessionStatus });
      return { status: "COMPLETED" };
    },
    async reopenToDraft() {
      writes.push("reopenToDraft");
      return { ok: true, status: "DRAFT" };
    },
  };

  return { repository, sessions, writes };
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/patients/pat-1/measurements/ses-1", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `${getSessionCookieName()}=token`,
    },
    body: JSON.stringify(body),
  });
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/patients/pat-1/measurements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `${getSessionCookieName()}=token`,
    },
    body: JSON.stringify(body),
  });
}

function deps(repository: MeasurementsRepository): MeasurementSessionDeps {
  return { repository };
}

function collectionDeps(repository: MeasurementsRepository): MeasurementsCollectionDeps {
  return {
    repository,
    resolveTemplateCode: () => "compression-v1",
  };
}

async function patch(repository: MeasurementsRepository, body: unknown, patientId = "pat-1") {
  return handlePatchMeasurementRequest(
    patchRequest(body),
    { params: Promise.resolve({ id: patientId, sessionId: "ses-1" }) },
    staffUser,
    deps(repository),
  );
}

describe("PATCH garment identity — cross-template changes are refused", () => {
  it("refuses to relabel a Máscara session as Mentonera", async () => {
    const store = buildRepository(mascaraSnapshot(), "MA");

    const response = await patch(store.repository, {
      valuesByKey: {},
      garmentType: "ME",
    });

    assert.equal(response.status, 409);
    const json = (await response.json()) as { code?: string };
    assert.equal(json.code, "GARMENT_TEMPLATE_MISMATCH");
  });

  it("refuses to relabel a Mentonera session as Máscara", async () => {
    const store = buildRepository(mentoneraSnapshot(), "ME");

    const response = await patch(store.repository, {
      valuesByKey: {},
      garmentType: "MA",
    });

    assert.equal(response.status, 409);
  });

  it("refuses to turn a compression session into a head session", async () => {
    const store = buildRepository(compressionSnapshot(), "MC");

    const response = await patch(store.repository, {
      valuesByKey: {},
      garmentType: "ME",
    });

    assert.equal(response.status, 409);
  });

  it("a refused request performs ZERO writes and mutates no state", async () => {
    const store = buildRepository(mascaraSnapshot(), "MA");
    const before = { ...store.sessions.get("ses-1")! };

    await patch(store.repository, {
      valuesByKey: { mascaraForehead: 56.5 },
      garmentType: "ME",
      notes: "intento de cambio",
      complete: true,
      metadata: { garmentSnapshot: { reference: "ME" } },
    });

    assert.deepEqual(store.writes, [], "no repository write may run");
    const after = store.sessions.get("ses-1")!;
    assert.equal(after.garmentType, before.garmentType);
    assert.equal(after.notes, before.notes);
    assert.deepEqual(after.metadata, before.metadata);
    assert.deepEqual(after.values, before.values);
    assert.equal(after.status, "DRAFT");
  });

  it("checks ownership BEFORE revealing anything about garment identity", async () => {
    const store = buildRepository(mascaraSnapshot(), "MA");

    // Same mismatching payload, but the session belongs to another patient.
    const response = await patch(
      store.repository,
      { valuesByKey: {}, garmentType: "ME" },
      "pat-OTHER",
    );

    assert.equal(response.status, 404, "must be indistinguishable from a missing session");
    const json = (await response.json()) as { code?: string; error?: string };
    assert.notEqual(json.code, "GARMENT_TEMPLATE_MISMATCH");
    assert.deepEqual(store.writes, []);
  });

  // NOTE: MA <-> MMA is the same-template case (both resolve to mascara-v1) and
  // is proven in tests/measurements-mascara-activation.test.ts, which ships with
  // the activation commit. It cannot be asserted here because MA and MMA do not
  // resolve to mascara-v1 until that commit lands — deliberately last, so
  // Máscara is never deployable before its values can be saved.

  it("leaves a PATCH that does not touch garmentType completely unaffected", async () => {
    const store = buildRepository(mentoneraSnapshot(), "ME");

    const response = await patch(store.repository, {
      valuesByKey: { mentoneraNeck: 36 },
      notes: "solo notas",
    });

    assert.equal(response.status, 200);
  });

  it("refuses an unknown garment reference on a head session explicitly", async () => {
    const store = buildRepository(mentoneraSnapshot(), "ME");

    // Unknown references resolve to compression-v1, which is a different
    // template than this session's — so this must be an explicit refusal, not
    // a silent relabel.
    const response = await patch(store.repository, {
      valuesByKey: {},
      garmentType: "TOTALLY-UNKNOWN",
    });

    assert.equal(response.status, 409);
  });

  it("keeps a legacy free-text garment editable when the value does not change", async () => {
    // Historical sessions carry free text the catalog never knew; refusing it
    // outright would make them uneditable.
    const store = buildRepository(compressionSnapshot(), "Media panty cintura alta");

    const response = await patch(store.repository, {
      valuesByKey: {},
      garmentType: "Media panty cintura alta",
      notes: "editando una sesión histórica",
    });

    assert.equal(response.status, 200);
  });

  it("refuses to CHANGE a session onto an unknown garment reference", async () => {
    const store = buildRepository(compressionSnapshot(), "MC");

    const response = await patch(store.repository, {
      valuesByKey: {},
      garmentType: "NO-EXISTE-EN-CATALOGO",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(store.writes, []);
  });

  it("refuses a metadata.garmentSnapshot whose reference crosses templates", async () => {
    const store = buildRepository(mascaraSnapshot(), "MA");

    const response = await patch(store.repository, {
      valuesByKey: {},
      metadata: {
        garmentSnapshot: {
          reference: "ME",
          label: "Mentonera Adulto",
          family: "head",
          figureKey: "head-or-hand",
        },
      },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(store.writes, []);
  });

  it("refuses MA-to-MMA relabelling even though the template is shared", async () => {
    const store = buildRepository(mascaraSnapshot(), "MA");

    const response = await patch(store.repository, {
      valuesByKey: {},
      garmentType: "MMA",
      metadata: { garmentSnapshot: { reference: "MMA" } },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(store.writes, []);
  });

  it("refuses a malformed reference-only snapshot before any write", async () => {
    const store = buildRepository(mascaraSnapshot(), "MA");

    const response = await patch(store.repository, {
      valuesByKey: {},
      garmentType: "MA",
      metadata: { garmentSnapshot: { reference: "MMA" } },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(store.writes, []);
  });
});

describe("POST garment identity — canonical server identity", () => {
  it("rejects MA/MMA disagreement before creating a draft", async () => {
    const store = buildRepository(mascaraSnapshot(), "MA");

    const response = await handlePostMeasurementRequest(
      postRequest({
        measuredAt: "2026-05-01T10:00:00Z",
        garmentType: "MA",
        metadata: { garmentSnapshot: { reference: "MMA" } },
      }),
      { params: Promise.resolve({ id: "pat-1" }) },
      staffUser,
      collectionDeps(store.repository),
    );

    assert.equal(response.status, 409);
    assert.deepEqual(store.writes, []);
  });
});
