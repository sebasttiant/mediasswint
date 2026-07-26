import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionCookieName, type AuthUser } from "../lib/auth";
import { resolveTemplateCode } from "../lib/garment-template-resolver";
import {
  handlePostMeasurementRequest,
  type MeasurementsCollectionDeps,
} from "../app/api/patients/[id]/measurements/route";
import {
  handlePatchMeasurementRequest,
  type MeasurementSessionDeps,
} from "../app/api/patients/[id]/measurements/[sessionId]/route";
import {
  type MeasurementSessionDetail,
  type MeasurementSessionStatus,
  type MeasurementsRepository,
  type TemplateSnapshot,
} from "../lib/measurements";
import { buildMascaraTemplate } from "../lib/mascara-template";

/**
 * MA/MMA ACTIVATION — the last commit in this chain.
 *
 * Everything Máscara needs to be usable already exists at this point: snapshot
 * validation, template convergence, snapshot-aware PATCH validation, the
 * server-side completion invariant and the cross-garment identity guard. Only
 * now do MA and MMA resolve to a template, so no earlier commit can be deployed
 * with Máscara visible but unsaveable.
 *
 * This file proves exactly that end-to-end coherence at the route level.
 */

const staffUser: AuthUser = {
  id: "staff-1",
  email: "staff@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Staff",
  role: "STAFF",
};

function buildMascaraSnapshot(): TemplateSnapshot {
  const tpl = buildMascaraTemplate();
  let counter = 0;
  return {
    templateId: "tpl-mascara-1",
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
          id: `fld-mascara-${counter}`,
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

function buildRepository(snapshot: TemplateSnapshot) {
  const sessions = new Map<string, MeasurementSessionDetail>();
  let counter = 0;

  const repository: MeasurementsRepository = {
    async getActiveTemplateSnapshot(code) {
      return snapshot.code === code ? snapshot : null;
    },
    async patientExists() {
      return true;
    },
    async createDraft(input) {
      counter += 1;
      const id = `sess-${counter}`;
      const now = new Date("2026-05-02T10:00:00Z");
      sessions.set(id, {
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
      });
      return { id };
    },
    async getDetail(id) {
      return sessions.get(id) ?? null;
    },
    async listByPatient() {
      return [];
    },
    async replaceValues(input) {
      const session = sessions.get(input.sessionId);
      if (!session) return { ok: false, status: null };
      if (session.status !== "DRAFT") return { ok: false, status: session.status };
      const byId = new Map<string, string>();
      for (const section of session.templateSnapshot?.sections ?? []) {
        for (const field of section.fields) byId.set(field.id, field.key);
      }
      const next = { ...session.values };
      for (const value of input.values) {
        const key = byId.get(value.fieldId);
        if (!key) continue;
        if (value.valueNumber === null) delete next[key];
        else next[key] = value.valueNumber;
      }
      sessions.set(input.sessionId, { ...session, values: next });
      return { ok: true, status: "DRAFT" };
    },
    async updateContext(input) {
      const session = sessions.get(input.sessionId);
      if (!session) return { ok: false, status: null };
      sessions.set(input.sessionId, {
        ...session,
        garmentType: input.garmentType !== undefined ? input.garmentType : session.garmentType,
      });
      return { ok: true, status: "DRAFT" };
    },
    async markCompleted(id) {
      const session = sessions.get(id);
      if (!session) return { status: "NOT_FOUND" };
      if (session.status !== "DRAFT") return { status: "INVALID_STATE" };
      sessions.set(id, { ...session, status: "COMPLETED" as MeasurementSessionStatus });
      return { status: "COMPLETED" };
    },
    async reopenToDraft() {
      return { ok: true, status: "DRAFT" };
    },
  };

  return { repository, sessions };
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: `${getSessionCookieName()}=token`,
    },
    body: JSON.stringify(body),
  });
}

async function createSession(repository: MeasurementsRepository, reference: string) {
  const response = await handlePostMeasurementRequest(
    jsonRequest("http://localhost/api/patients/pat-1/measurements", "POST", {
      measuredAt: "2026-05-02T10:00:00Z",
      garmentType: reference,
    }),
    { params: Promise.resolve({ id: "pat-1" }) },
    staffUser,
    { repository, resolveTemplateCode } as MeasurementsCollectionDeps,
  );
  return response;
}

async function patchSession(
  repository: MeasurementsRepository,
  sessionId: string,
  body: unknown,
) {
  return handlePatchMeasurementRequest(
    jsonRequest(
      `http://localhost/api/patients/pat-1/measurements/${sessionId}`,
      "PATCH",
      body,
    ),
    { params: Promise.resolve({ id: "pat-1", sessionId }) },
    staffUser,
    { repository } as MeasurementSessionDeps,
  );
}

describe("MA/MMA activation — Máscara resolves to its template", () => {
  it("maps both mask references onto the single shared measurement set", () => {
    assert.equal(resolveTemplateCode("MA"), "mascara-v1");
    assert.equal(resolveTemplateCode("MMA"), "mascara-v1");
    // Unrelated references must keep falling back to compression.
    assert.equal(resolveTemplateCode("MR"), "compression-v1");
  });

  for (const reference of ["MA", "MMA"] as const) {
    it(`creates a ${reference} draft carrying the mascara-v1 snapshot`, async () => {
      const store = buildRepository(buildMascaraSnapshot());

      const response = await createSession(store.repository, reference);

      assert.equal(response.status, 201);
      const json = (await response.json()) as { templateSnapshot: TemplateSnapshot };
      assert.equal(json.templateSnapshot.code, "mascara-v1");
    });

    it(`draft-saves and completes a ${reference} session end to end`, async () => {
      const store = buildRepository(buildMascaraSnapshot());
      const created = await createSession(store.repository, reference);
      const { id } = (await created.json()) as { id: string };

      const saved = await patchSession(store.repository, id, {
        valuesByKey: { mascaraForehead: 56.5, mascaraNeck: 38 },
      });
      assert.equal(saved.status, 200);
      assert.deepEqual(store.sessions.get(id)?.values, {
        mascaraForehead: 56.5,
        mascaraNeck: 38,
      });

      const completed = await patchSession(store.repository, id, {
        valuesByKey: { mascaraForehead: 56.5, mascaraNeck: 38 },
        complete: true,
      });
      assert.equal(completed.status, 200);
      assert.equal(store.sessions.get(id)?.status, "COMPLETED");
    });
  }

  it("still rejects an unknown key on a Máscara session", async () => {
    const store = buildRepository(buildMascaraSnapshot());
    const created = await createSession(store.repository, "MA");
    const { id } = (await created.json()) as { id: string };

    const response = await patchSession(store.repository, id, {
      valuesByKey: { legRight1: 24.5 },
    });

    assert.equal(response.status, 400);
  });

  it("allows MA -> MMA: both resolve to mascara-v1, so the schema cannot disagree", async () => {
    const store = buildRepository(buildMascaraSnapshot());
    const created = await createSession(store.repository, "MA");
    const { id } = (await created.json()) as { id: string };

    const response = await patchSession(store.repository, id, {
      valuesByKey: {},
      garmentType: "MMA",
    });

    assert.equal(response.status, 200);
    assert.equal(store.sessions.get(id)?.garmentType, "MMA");
  });

  it("refuses MA -> ME, because that would cross a template boundary", async () => {
    const store = buildRepository(buildMascaraSnapshot());
    const created = await createSession(store.repository, "MA");
    const { id } = (await created.json()) as { id: string };

    const response = await patchSession(store.repository, id, {
      valuesByKey: {},
      garmentType: "ME",
    });

    assert.equal(response.status, 409);
    const json = (await response.json()) as { code?: string };
    assert.equal(json.code, "GARMENT_TEMPLATE_MISMATCH");
    assert.equal(store.sessions.get(id)?.garmentType, "MA", "the label must be unchanged");
  });

  it("refuses to finalize a degraded Máscara snapshot even now that MA is live", async () => {
    const full = buildMascaraSnapshot();
    const degraded: TemplateSnapshot = {
      ...full,
      sections: [{ ...full.sections[0]!, fields: [full.sections[0]!.fields[0]!] }],
    };
    const store = buildRepository(degraded);
    const created = await createSession(store.repository, "MA");
    const { id } = (await created.json()) as { id: string };

    const response = await patchSession(store.repository, id, {
      valuesByKey: { mascaraForehead: 56.5 },
      complete: true,
    });

    assert.equal(response.status, 422);
    assert.equal(store.sessions.get(id)?.status, "DRAFT");
    // The draft values survive the refusal.
    assert.deepEqual(store.sessions.get(id)?.values, { mascaraForehead: 56.5 });
  });
});
