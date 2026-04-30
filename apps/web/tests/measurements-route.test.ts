import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionCookieName, type AuthUser } from "../lib/auth";
import {
  handleListMeasurementsRequest,
  handlePostMeasurementRequest,
  type MeasurementsCollectionDeps,
} from "../app/api/patients/[id]/measurements/route";
import {
  handleGetMeasurementRequest,
  handlePatchMeasurementRequest,
  type MeasurementSessionDeps,
} from "../app/api/patients/[id]/measurements/[sessionId]/route";
import {
  type MeasurementSessionDetail,
  type MeasurementSessionStatus,
  type MeasurementsRepository,
  type TemplateSnapshot,
} from "../lib/measurements";
import { buildCompressionTemplate } from "../lib/compression-template";

const staffUser: AuthUser = {
  id: "staff-1",
  email: "staff@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Staff",
  role: "STAFF",
};

function buildSnapshot(): TemplateSnapshot {
  const tpl = buildCompressionTemplate();
  let counter = 0;
  return {
    templateId: "tpl-1",
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
          id: `fld-${counter}`,
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

function buildInMemoryRepository(options: {
  knownPatientIds?: ReadonlyArray<string>;
  snapshot?: TemplateSnapshot | null;
} = {}) {
  const snapshot = "snapshot" in options ? options.snapshot : buildSnapshot();
  const patients = new Set(options.knownPatientIds ?? ["pat-1"]);
  const sessions = new Map<string, MeasurementSessionDetail>();
  let counter = 0;

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
    async listByPatient(patientId, limit) {
      return [...sessions.values()]
        .filter((session) => session.patientId === patientId)
        .sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())
        .slice(0, limit)
        .map((session) => ({
          id: session.id,
          patientId: session.patientId,
          status: session.status,
          measuredAt: session.measuredAt,
          garmentType: session.garmentType,
          compressionClass: session.compressionClass,
          diagnosis: session.diagnosis,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        }));
    },
    async replaceValues(input) {
      const session = sessions.get(input.sessionId);
      if (!session) return { ok: false, status: null };
      if (session.status !== "DRAFT") return { ok: false, status: session.status };
      const fieldIdToKey = new Map<string, string>();
      for (const section of session.templateSnapshot?.sections ?? []) {
        for (const field of section.fields) fieldIdToKey.set(field.id, field.key);
      }
      const next = { ...session.values };
      for (const value of input.values) {
        const key = fieldIdToKey.get(value.fieldId);
        if (!key) continue;
        if (value.valueNumber === null) delete next[key];
        else next[key] = value.valueNumber;
      }
      sessions.set(input.sessionId, { ...session, values: next });
      return { ok: true, status: "DRAFT" };
    },
    async markCompleted(id) {
      const session = sessions.get(id);
      if (!session) return { status: "NOT_FOUND" };
      if (session.status !== "DRAFT") return { status: "INVALID_STATE" };
      sessions.set(id, { ...session, status: "COMPLETED" as MeasurementSessionStatus });
      return { status: "COMPLETED" };
    },
  };

  return { repository, sessions };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/patients/pat-1/measurements", {
    method: "POST",
    headers: {
      cookie: `${getSessionCookieName()}=token`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function getRequest(path = "/api/patients/pat-1/measurements") {
  return new Request(`http://localhost${path}`, {
    headers: { cookie: `${getSessionCookieName()}=token` },
  });
}

function patchRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: {
      cookie: `${getSessionCookieName()}=token`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function collectionDeps(
  overrides: Partial<MeasurementsCollectionDeps> = {},
): MeasurementsCollectionDeps {
  return {
    requireActiveUser: async () => staffUser,
    repository: buildInMemoryRepository().repository,
    templateCode: "compression-v1",
    ...overrides,
  };
}

function sessionDeps(overrides: Partial<MeasurementSessionDeps> = {}): MeasurementSessionDeps {
  return {
    requireActiveUser: async () => staffUser,
    repository: buildInMemoryRepository().repository,
    ...overrides,
  };
}

describe("POST /api/patients/[id]/measurements", () => {
  it("returns 401 when no active user", async () => {
    const deps = collectionDeps({ requireActiveUser: async () => null });
    const response = await handlePostMeasurementRequest(
      postRequest({ measuredAt: "2026-04-28T10:00:00Z" }),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );
    assert.equal(response.status, 401);
  });

  it("returns 400 on invalid JSON", async () => {
    const repo = buildInMemoryRepository();
    const deps = collectionDeps({ repository: repo.repository });
    const response = await handlePostMeasurementRequest(
      new Request("http://localhost/api/patients/pat-1/measurements", {
        method: "POST",
        headers: {
          cookie: `${getSessionCookieName()}=token`,
          "Content-Type": "application/json",
        },
        body: "{not-json",
      }),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );
    assert.equal(response.status, 400);
  });

  it("returns 404 when patient does not exist", async () => {
    const repo = buildInMemoryRepository({ knownPatientIds: [] });
    const deps = collectionDeps({ repository: repo.repository });
    const response = await handlePostMeasurementRequest(
      postRequest({ measuredAt: "2026-04-28T10:00:00Z" }),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );
    assert.equal(response.status, 404);
  });

  it("returns 503 when active template missing", async () => {
    const repo = buildInMemoryRepository({ snapshot: null });
    const deps = collectionDeps({ repository: repo.repository });
    const response = await handlePostMeasurementRequest(
      postRequest({ measuredAt: "2026-04-28T10:00:00Z" }),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );
    assert.equal(response.status, 503);
  });

  it("creates a DRAFT session and returns 201 with snapshot", async () => {
    const repo = buildInMemoryRepository();
    const deps = collectionDeps({ repository: repo.repository });
    const response = await handlePostMeasurementRequest(
      postRequest({
        measuredAt: "2026-04-28T10:00:00Z",
        garmentType: "Media corta",
        compressionClass: "II",
        productFlags: { mediaCorta: true },
        diagnosis: "Insuficiencia venosa",
      }),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );
    assert.equal(response.status, 201);
    const json = (await response.json()) as { id: string; templateSnapshot: TemplateSnapshot };
    assert.ok(json.id);
    assert.equal(json.templateSnapshot.code, "compression-v1");
    const stored = repo.sessions.get(json.id);
    assert.equal(stored?.status, "DRAFT");
    assert.equal(stored?.diagnosis, "Insuficiencia venosa");
  });
});

describe("GET /api/patients/[id]/measurements", () => {
  it("returns 401 when no active user", async () => {
    const deps = collectionDeps({ requireActiveUser: async () => null });
    const response = await handleListMeasurementsRequest(
      getRequest(),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );
    assert.equal(response.status, 401);
  });

  it("lists patient sessions with default limit", async () => {
    const repo = buildInMemoryRepository();
    await repo.repository.createDraft({
      patientId: "pat-1",
      templateId: "tpl-1",
      measuredAt: new Date("2026-04-29T10:00:00Z"),
      notes: null,
      diagnosis: null,
      garmentType: null,
      compressionClass: null,
      productFlags: null,
      metadata: null,
      templateSnapshot: buildSnapshot(),
    });
    const deps = collectionDeps({ repository: repo.repository });
    const response = await handleListMeasurementsRequest(
      getRequest(),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { items: { id: string }[] };
    assert.equal(json.items.length, 1);
  });
});

describe("GET /api/patients/[id]/measurements/[sessionId]", () => {
  it("returns 404 when patientId does not match the session", async () => {
    const repo = buildInMemoryRepository();
    const created = await repo.repository.createDraft({
      patientId: "pat-1",
      templateId: "tpl-1",
      measuredAt: new Date("2026-04-29T10:00:00Z"),
      notes: null,
      diagnosis: null,
      garmentType: null,
      compressionClass: null,
      productFlags: null,
      metadata: null,
      templateSnapshot: buildSnapshot(),
    });
    const deps = sessionDeps({ repository: repo.repository });
    const response = await handleGetMeasurementRequest(
      getRequest(`/api/patients/pat-2/measurements/${created.id}`),
      { params: Promise.resolve({ id: "pat-2", sessionId: created.id }) },
      deps,
    );
    assert.equal(response.status, 404);
  });

  it("returns 200 and the detail for a matching patient/session", async () => {
    const repo = buildInMemoryRepository();
    const created = await repo.repository.createDraft({
      patientId: "pat-1",
      templateId: "tpl-1",
      measuredAt: new Date("2026-04-29T10:00:00Z"),
      notes: null,
      diagnosis: null,
      garmentType: "Media corta",
      compressionClass: "II",
      productFlags: { mediaCorta: true },
      metadata: null,
      templateSnapshot: buildSnapshot(),
    });
    const deps = sessionDeps({ repository: repo.repository });
    const response = await handleGetMeasurementRequest(
      getRequest(`/api/patients/pat-1/measurements/${created.id}`),
      { params: Promise.resolve({ id: "pat-1", sessionId: created.id }) },
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { id: string; status: string };
    assert.equal(json.id, created.id);
    assert.equal(json.status, "DRAFT");
  });
});

describe("PATCH /api/patients/[id]/measurements/[sessionId]", () => {
  it("returns 404 and does not update when patientId does not match the session", async () => {
    const repo = buildInMemoryRepository();
    const created = await repo.repository.createDraft({
      patientId: "pat-1",
      templateId: "tpl-1",
      measuredAt: new Date("2026-04-29T10:00:00Z"),
      notes: null,
      diagnosis: null,
      garmentType: null,
      compressionClass: null,
      productFlags: null,
      metadata: null,
      templateSnapshot: buildSnapshot(),
    });
    const deps = sessionDeps({ repository: repo.repository });

    const response = await handlePatchMeasurementRequest(
      patchRequest(`/api/patients/pat-2/measurements/${created.id}`, {
        valuesByKey: { legRight1: 24.5 },
      }),
      { params: Promise.resolve({ id: "pat-2", sessionId: created.id }) },
      deps,
    );

    assert.equal(response.status, 404);
    assert.deepEqual(repo.sessions.get(created.id)?.values, {});
  });

  it("upserts values and stays in DRAFT", async () => {
    const repo = buildInMemoryRepository();
    const created = await repo.repository.createDraft({
      patientId: "pat-1",
      templateId: "tpl-1",
      measuredAt: new Date("2026-04-29T10:00:00Z"),
      notes: null,
      diagnosis: null,
      garmentType: null,
      compressionClass: null,
      productFlags: null,
      metadata: null,
      templateSnapshot: buildSnapshot(),
    });
    const deps = sessionDeps({ repository: repo.repository });
    const response = await handlePatchMeasurementRequest(
      patchRequest(`/api/patients/pat-1/measurements/${created.id}`, {
        valuesByKey: { legRight1: 24.5, legLeft1: 25 },
      }),
      { params: Promise.resolve({ id: "pat-1", sessionId: created.id }) },
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { status: string; values: Record<string, number> };
    assert.equal(json.status, "DRAFT");
    assert.equal(json.values.legRight1, 24.5);
  });

  it("upserts and completes when complete=true", async () => {
    const repo = buildInMemoryRepository();
    const created = await repo.repository.createDraft({
      patientId: "pat-1",
      templateId: "tpl-1",
      measuredAt: new Date("2026-04-29T10:00:00Z"),
      notes: null,
      diagnosis: null,
      garmentType: null,
      compressionClass: null,
      productFlags: null,
      metadata: null,
      templateSnapshot: buildSnapshot(),
    });
    const deps = sessionDeps({ repository: repo.repository });
    const response = await handlePatchMeasurementRequest(
      patchRequest(`/api/patients/pat-1/measurements/${created.id}`, {
        valuesByKey: { legRight1: 24.5 },
        complete: true,
      }),
      { params: Promise.resolve({ id: "pat-1", sessionId: created.id }) },
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { status: string };
    assert.equal(json.status, "COMPLETED");
  });

  it("returns 409 when session is no longer DRAFT", async () => {
    const repo = buildInMemoryRepository();
    const created = await repo.repository.createDraft({
      patientId: "pat-1",
      templateId: "tpl-1",
      measuredAt: new Date("2026-04-29T10:00:00Z"),
      notes: null,
      diagnosis: null,
      garmentType: null,
      compressionClass: null,
      productFlags: null,
      metadata: null,
      templateSnapshot: buildSnapshot(),
    });
    await repo.repository.markCompleted(created.id);

    const deps = sessionDeps({ repository: repo.repository });
    const response = await handlePatchMeasurementRequest(
      patchRequest(`/api/patients/pat-1/measurements/${created.id}`, {
        valuesByKey: { legRight1: 24.5 },
      }),
      { params: Promise.resolve({ id: "pat-1", sessionId: created.id }) },
      deps,
    );
    assert.equal(response.status, 409);
  });

  it("returns 400 when payload contains an unknown key or out-of-range value", async () => {
    const repo = buildInMemoryRepository();
    const created = await repo.repository.createDraft({
      patientId: "pat-1",
      templateId: "tpl-1",
      measuredAt: new Date("2026-04-29T10:00:00Z"),
      notes: null,
      diagnosis: null,
      garmentType: null,
      compressionClass: null,
      productFlags: null,
      metadata: null,
      templateSnapshot: buildSnapshot(),
    });
    const deps = sessionDeps({ repository: repo.repository });
    const response = await handlePatchMeasurementRequest(
      patchRequest(`/api/patients/pat-1/measurements/${created.id}`, {
        valuesByKey: { legRight1: 0 },
      }),
      { params: Promise.resolve({ id: "pat-1", sessionId: created.id }) },
      deps,
    );
    assert.equal(response.status, 400);
  });
});
