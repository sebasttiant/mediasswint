import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionCookieName, type AuthUser } from "../lib/auth";
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
import { classifyPersistedSnapshot } from "../lib/template-snapshot";
import { buildMascaraTemplate } from "../lib/mascara-template";
import { buildMpBermudaTemplate } from "../lib/mp-bermuda-template";

/**
 * The persisted snapshot column has THREE states — absent, malformed, valid —
 * and `complete` has two values. This file pins the whole 3x2 matrix at the
 * route boundary, together with the exact committed state each cell leaves
 * behind.
 *
 * The defect it locks out: a malformed snapshot parses to a null projection,
 * and the head-completion classifier reads a null snapshot as "not a head
 * garment". So `complete: true` fell into the atomic save+complete branch,
 * which surfaced the service's MALFORMED_TEMPLATE_SNAPSHOT as a generic 500 —
 * silently dropping the machine-readable 422 the `complete: false` path had.
 */

const staffUser: AuthUser = {
  id: "staff-1",
  email: "staff@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Staff",
  role: "STAFF",
};

/**
 * The demo seeder persisted template identity WITHOUT a `sections` key. This is
 * the real shape that made the column unreadable.
 */
const SEEDER_SHAPED_SNAPSHOT = {
  templateCode: "mascara-v1",
  templateName: "Máscara v1",
  version: 1,
} as unknown as TemplateSnapshot;

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

function buildMpSnapshot(): TemplateSnapshot {
  const template = buildMpBermudaTemplate();
  let counter = 0;
  return {
    templateId: "tpl-mp-1", code: template.code, name: template.name, version: template.version, description: template.description,
    sections: template.sections.map((section) => ({
      title: section.title, sortOrder: section.sortOrder,
      fields: section.fields.map((field) => ({ ...field, id: `fld-mp-${++counter}`, metadata: field.metadata as unknown as Record<string, unknown> })),
    })),
  };
}

function degrade(snapshot: TemplateSnapshot, fieldCount: number): TemplateSnapshot {
  const section = snapshot.sections[0]!;
  return {
    ...snapshot,
    sections: [{ ...section, fields: section.fields.slice(0, fieldCount) }],
  };
}

/**
 * Repository fake that classifies the persisted column EXACTLY the way the
 * Prisma repository does: through `classifyPersistedSnapshot`, keeping the
 * parsed projection (null when malformed) rather than echoing the raw input
 * back. Without that, a fake hands the route a snapshot production never
 * produces.
 */
function buildRepository(persistedSnapshot: unknown) {
  const sessions = new Map<string, MeasurementSessionDetail>();
  const writes: string[] = [];
  const classified = classifyPersistedSnapshot(persistedSnapshot);
  const now = new Date("2026-04-30T12:00:00Z");

  sessions.set("sess-1", {
    id: "sess-1",
    patientId: "pat-1",
    templateId: "tpl-1",
    status: "DRAFT",
    measuredAt: now,
    notes: null,
    diagnosis: null,
    garmentType: classified.templateSnapshot?.code === "mp-bermuda-v1" ? "MP" : "MA",
    compressionClass: null,
    productFlags: null,
    metadata: null,
    templateSnapshot: classified.templateSnapshot,
    templateSnapshotState: classified.templateSnapshotState,
    values: {},
    createdAt: now,
    updatedAt: now,
  });

  function applyValues(sessionId: string, values: ReadonlyArray<{ fieldId: string; valueNumber: number | null }>) {
    const session = sessions.get(sessionId);
    if (!session) return { ok: false as const, status: null };
    if (session.status !== "DRAFT") return { ok: false as const, status: session.status };
    const fieldIdToKey = new Map<string, string>();
    for (const section of session.templateSnapshot?.sections ?? []) {
      for (const field of section.fields) fieldIdToKey.set(field.id, field.key);
    }
    const next = { ...session.values };
    for (const value of values) {
      const key = fieldIdToKey.get(value.fieldId);
      if (!key) continue;
      if (value.valueNumber === null) delete next[key];
      else next[key] = value.valueNumber;
    }
    sessions.set(sessionId, { ...session, values: next });
    return { ok: true as const, status: "DRAFT" as const };
  }

  const repository: MeasurementsRepository = {
    async getActiveTemplateSnapshot() {
      return null;
    },
    async patientExists() {
      return true;
    },
    async createDraft() {
      writes.push("createDraft");
      return { id: "sess-created" };
    },
    async createDraftWithValues() {
      writes.push("createDraftWithValues");
      return { ok: true as const, id: "sess-created" };
    },
    async getDetail(id) {
      return sessions.get(id) ?? null;
    },
    async listByPatient() {
      return [];
    },
    async replaceValues(input) {
      writes.push("replaceValues");
      return applyValues(input.sessionId, input.values);
    },
    async saveDraft(input) {
      writes.push("saveDraft");
      const session = sessions.get(input.sessionId);
      if (!session) return { ok: false, status: null };
      if (session.status !== "DRAFT") return { ok: false, status: session.status };
      if (input.context) {
        sessions.set(input.sessionId, {
          ...session,
          notes: input.context.notes !== undefined ? input.context.notes : session.notes,
        });
      }
      return applyValues(input.sessionId, input.values);
    },
    async saveDraftAndComplete(input) {
      writes.push("saveDraftAndComplete");
      const applied = await repository.saveDraft(input);
      if (!applied.ok) return { status: applied.status === null ? "NOT_FOUND" : "INVALID_STATE" };
      const session = sessions.get(input.sessionId)!;
      sessions.set(input.sessionId, { ...session, status: "COMPLETED" as MeasurementSessionStatus });
      return { status: "COMPLETED", completedAt: new Date() };
    },
    async updateContext(input) {
      writes.push("updateContext");
      const session = sessions.get(input.sessionId);
      if (!session) return { ok: false, status: null };
      if (session.status !== "DRAFT") return { ok: false, status: session.status };
      return { ok: true, status: "DRAFT" };
    },
    async markCompleted(id) {
      writes.push("markCompleted");
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

  return { repository, sessions, writes };
}

function patchSession(persistedSnapshot: unknown) {
  const { repository, sessions, writes } = buildRepository(persistedSnapshot);
  const deps: MeasurementSessionDeps = { repository };

  async function patch(body: unknown) {
    return handlePatchMeasurementRequest(
      new Request("http://localhost/api/patients/pat-1/measurements/sess-1", {
        method: "PATCH",
        headers: {
          cookie: `${getSessionCookieName()}=token`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "pat-1", sessionId: "sess-1" }) },
      staffUser,
      deps,
    );
  }

  return { patch, sessions, writes };
}

describe("PATCH snapshot-state x complete matrix", () => {
  for (const complete of [false, true]) {
    it(`malformed snapshot + complete:${complete} answers 422 MALFORMED_TEMPLATE_SNAPSHOT`, async () => {
      const { patch } = patchSession(SEEDER_SHAPED_SNAPSHOT);

      const response = await patch({ valuesByKey: { mascaraForehead: 56.5 }, complete });
      const body = (await response.json()) as Record<string, unknown>;

      assert.equal(response.status, 422);
      assert.equal(body["code"], "MALFORMED_TEMPLATE_SNAPSHOT");
      // The one contract that means "draft saved, completion refused" must not
      // be borrowed by a request that saved nothing, and the body must not
      // claim any committed state.
      assert.notEqual(body["code"], "INCOMPLETE_TEMPLATE_SNAPSHOT");
      assert.equal(body["committed"], undefined);
      assert.equal(body["status"], undefined);
    });

    it(`malformed snapshot + complete:${complete} writes nothing and stays DRAFT`, async () => {
      const { patch, sessions, writes } = patchSession(SEEDER_SHAPED_SNAPSHOT);

      await patch({ valuesByKey: { mascaraForehead: 56.5 }, notes: "changed", complete });

      assert.deepEqual(writes, []);
      assert.equal(sessions.get("sess-1")?.status, "DRAFT");
      assert.deepEqual(sessions.get("sess-1")?.values, {});
      assert.equal(sessions.get("sess-1")?.notes, null);
    });

    it(`absent snapshot + complete:${complete} stays DISTINCT from malformed and writes nothing`, async () => {
      const { patch, sessions, writes } = patchSession(null);

      const response = await patch({ valuesByKey: { mascaraForehead: 56.5 }, complete });
      const body = (await response.json()) as Record<string, unknown>;

      // Absent is an infrastructure fault (500), not the client-actionable 422
      // that an unreadable snapshot earns.
      assert.equal(response.status, 500);
      assert.equal(body["code"], undefined);
      assert.equal(body["error"], "Measurement template snapshot missing");
      assert.deepEqual(writes, []);
      assert.equal(sessions.get("sess-1")?.status, "DRAFT");
    });
  }

  it("an INCOMPLETE valid head snapshot + complete:true still saves the draft and refuses completion", async () => {
    const { patch, sessions } = patchSession(degrade(buildMascaraSnapshot(), 1));

    const response = await patch({ valuesByKey: { mascaraForehead: 56.5 }, complete: true });
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 422);
    assert.equal(body["code"], "INCOMPLETE_TEMPLATE_SNAPSHOT");
    // This is the ONLY code that means the values were persisted.
    assert.deepEqual(sessions.get("sess-1")?.values, { mascaraForehead: 56.5 });
    assert.equal(sessions.get("sess-1")?.status, "DRAFT");
  });

  it("a VALID complete head snapshot + complete:true completes atomically", async () => {
    const { patch, sessions, writes } = patchSession(buildMascaraSnapshot());

    const response = await patch({
      valuesByKey: { mascaraForehead: 56.5, mascaraNeck: 38 },
      complete: true,
    });

    assert.equal(response.status, 200);
    assert.equal(sessions.get("sess-1")?.status, "COMPLETED");
    assert.deepEqual(sessions.get("sess-1")?.values, { mascaraForehead: 56.5, mascaraNeck: 38 });
    // The atomic primitive is the one that ran — not saveDraft + markCompleted.
    assert.ok(writes.includes("saveDraftAndComplete"));
    assert.equal(writes.includes("markCompleted"), false);
  });

  it("a VALID complete head snapshot + complete:false saves without completing", async () => {
    const { patch, sessions } = patchSession(buildMascaraSnapshot());

    const response = await patch({ valuesByKey: { mascaraForehead: 56.5 }, complete: false });

    assert.equal(response.status, 200);
    assert.equal(sessions.get("sess-1")?.status, "DRAFT");
    assert.deepEqual(sessions.get("sess-1")?.values, { mascaraForehead: 56.5 });
  });

  it("an incomplete MP completion saves accepted values, returns key errors, and never invokes atomic completion", async () => {
    const { patch, sessions, writes } = patchSession(buildMpSnapshot());

    const response = await patch({ valuesByKey: { mpHeight: 180 }, complete: true });
    const body = (await response.json()) as { committed?: boolean; errors?: Array<{ field: string }> };

    assert.equal(response.status, 422);
    assert.equal(body.committed, true);
    assert.deepEqual(body.errors?.slice(0, 4).map((error) => error.field), ["valuesByKey.mpWeight", "valuesByKey.mpShoeSize", "valuesByKey.mpWaistToGlutealFoldLength", "valuesByKey.mpGlutealFoldToFloorLength"]);
    assert.deepEqual(sessions.get("sess-1")?.values, { mpHeight: 180 });
    assert.equal(writes.includes("saveDraftAndComplete"), false);
  });
});
