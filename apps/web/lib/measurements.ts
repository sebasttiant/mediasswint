import { Prisma } from "@prisma/client";

import { getPrisma } from "./prisma";
import { getHeadSnapshotCompletionBlock } from "./head-measurement-layout";
import { classifyPersistedSnapshot } from "./template-snapshot";
import { recordAudit, toAuditPayload } from "@/lib/audit-log";

export type MeasurementSessionStatus = "DRAFT" | "COMPLETED" | "VOID";

/**
 * What the persisted `templateSnapshot` Json column actually holds.
 *
 * "absent"    -> the column is null; the session never carried a snapshot.
 * "malformed" -> the column holds JSON that is NOT a usable snapshot.
 * "valid"     -> the column parsed into a TemplateSnapshot.
 *
 * These are deliberately three states, not two. Collapsing "malformed" into
 * "absent" — which is what returning a bare null did — made the malformed
 * branch unreachable through the real repository, so a stored-but-unreadable
 * snapshot surfaced as a misleading 500 instead of its intended response.
 */
export type TemplateSnapshotState = "absent" | "malformed" | "valid";

export type TemplateSnapshotField = {
  id: string;
  key: string;
  label: string;
  fieldType: "NUMBER";
  unit: string;
  isRequired: boolean;
  sortOrder: number;
  minValue: number;
  maxValue: number;
  metadata: Record<string, unknown>;
};

export type TemplateSnapshotSection = {
  title: string;
  sortOrder: number;
  fields: ReadonlyArray<TemplateSnapshotField>;
};

export type TemplateSnapshot = {
  templateId: string;
  code: string;
  name: string;
  version: number;
  description: string | null;
  sections: ReadonlyArray<TemplateSnapshotSection>;
};

export type CreateMeasurementInput = {
  patientId: string;
  templateCode: string;
  measuredAt: Date;
  notes: string | null;
  diagnosis: string | null;
  garmentType: string | null;
  compressionClass: string | null;
  productFlags: Record<string, boolean> | null;
  metadata: Record<string, unknown> | null;
};

export type UpdateMeasurementValuesInput = {
  valuesByKey: Record<string, number | null>;
  measuredAt?: Date;
  notes?: string | null;
  diagnosis?: string | null;
  garmentType?: string | null;
  compressionClass?: string | null;
  productFlags?: Record<string, boolean> | null;
  metadata?: Record<string, unknown> | null;
};

export type MeasurementSessionDetail = {
  id: string;
  patientId: string;
  templateId: string | null;
  status: MeasurementSessionStatus;
  measuredAt: Date;
  notes: string | null;
  diagnosis: string | null;
  garmentType: string | null;
  compressionClass: string | null;
  productFlags: Record<string, boolean> | null;
  metadata: Record<string, unknown> | null;
  templateSnapshot: TemplateSnapshot | null;
  /**
   * Distinguishes "no snapshot" from "unreadable snapshot". Required, so no
   * repository implementation can silently reintroduce the collapse.
   */
  templateSnapshotState: TemplateSnapshotState;
  values: Record<string, number | null>;
  createdAt: Date;
  updatedAt: Date;
};

export type MeasurementSessionSummary = {
  id: string;
  patientId: string;
  status: MeasurementSessionStatus;
  measuredAt: Date;
  garmentType: string | null;
  compressionClass: string | null;
  diagnosis: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListMeasurementsQuery = {
  limit: number;
};

type ServiceErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "TEMPLATE_NOT_FOUND"
  // The session HAS a persisted template snapshot, but the stored JSON does
  // not match the snapshot contract (e.g. rows written without a `sections`
  // key). Distinct from TEMPLATE_NOT_FOUND so the caller can tell "never had
  // one" apart from "has one we cannot trust".
  | "MALFORMED_TEMPLATE_SNAPSHOT"
  | "PATIENT_NOT_FOUND"
  | "UNKNOWN_KEYS"
  // The session's persisted template snapshot claims a head garment
  // (mentonera-v1 / mascara-v1) but does not carry that garment's full
  // measurement set, so finalizing it would freeze an incomplete clinical
  // record. Draft saving stays allowed; only completion is refused.
  | "INCOMPLETE_TEMPLATE_SNAPSHOT"
  | "UNKNOWN";

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: ServiceErrorCode };

export type CreateDraftRepositoryInput = {
  patientId: string;
  templateId: string;
  measuredAt: Date;
  notes: string | null;
  diagnosis: string | null;
  garmentType: string | null;
  compressionClass: string | null;
  productFlags: Record<string, boolean> | null;
  metadata: Record<string, unknown> | null;
  templateSnapshot: TemplateSnapshot;
};

export type ReplaceValuesRepositoryInput = {
  sessionId: string;
  values: ReadonlyArray<{ fieldId: string; valueNumber: number | null }>;
};

export type UpdateContextRepositoryInput = {
  sessionId: string;
  measuredAt?: Date;
  notes?: string | null;
  diagnosis?: string | null;
  garmentType?: string | null;
  compressionClass?: string | null;
  productFlags?: Record<string, boolean> | null;
  metadata?: Record<string, unknown> | null;
};

export type MarkCompletedResult =
  | { status: "COMPLETED" }
  | { status: "NOT_FOUND" }
  | { status: "INVALID_STATE" };

export type MeasurementsRepository = {
  getActiveTemplateSnapshot(code: string): Promise<TemplateSnapshot | null>;
  patientExists(patientId: string): Promise<boolean>;
  createDraft(input: CreateDraftRepositoryInput): Promise<{ id: string }>;
  getDetail(id: string): Promise<MeasurementSessionDetail | null>;
  listByPatient(patientId: string, limit: number): Promise<MeasurementSessionSummary[]>;
  replaceValues(input: ReplaceValuesRepositoryInput): Promise<{ ok: boolean; status: MeasurementSessionStatus | null }>;
  updateContext(input: UpdateContextRepositoryInput): Promise<{ ok: boolean; status: MeasurementSessionStatus | null }>;
  markCompleted(id: string): Promise<MarkCompletedResult>;
  reopenToDraft(id: string): Promise<{ ok: boolean; status: MeasurementSessionStatus | null }>;
};

function hasContextChanges(input: UpdateMeasurementValuesInput): boolean {
  return (
    input.measuredAt !== undefined ||
    input.notes !== undefined ||
    input.diagnosis !== undefined ||
    input.garmentType !== undefined ||
    input.compressionClass !== undefined ||
    input.productFlags !== undefined ||
    input.metadata !== undefined
  );
}

function indexFieldsByKey(snapshot: TemplateSnapshot): Map<string, TemplateSnapshotField> {
  const map = new Map<string, TemplateSnapshotField>();
  for (const section of snapshot.sections) {
    for (const field of section.fields) {
      map.set(field.key, field);
    }
  }
  return map;
}

export async function createDraftMeasurement(
  input: CreateMeasurementInput,
  repository: MeasurementsRepository,
): Promise<ServiceResult<{ id: string; templateSnapshot: TemplateSnapshot }>> {
  try {
    const exists = await repository.patientExists(input.patientId);
    if (!exists) return { ok: false, error: "PATIENT_NOT_FOUND" };

    const snapshot = await repository.getActiveTemplateSnapshot(input.templateCode);
    if (!snapshot) return { ok: false, error: "TEMPLATE_NOT_FOUND" };

    const created = await repository.createDraft({
      patientId: input.patientId,
      templateId: snapshot.templateId,
      measuredAt: input.measuredAt,
      notes: input.notes,
      diagnosis: input.diagnosis,
      garmentType: input.garmentType,
      compressionClass: input.compressionClass,
      productFlags: input.productFlags,
      metadata: input.metadata,
      templateSnapshot: snapshot,
    });

    await recordAudit({
      action: "CREATE",
      entityType: "MeasurementSession",
      entityId: created.id,
      diff: { after: toAuditPayload({
        id: created.id,
        patientId: input.patientId,
        templateId: snapshot.templateId,
        status: "DRAFT",
        measuredAt: input.measuredAt,
        notes: input.notes,
        diagnosis: input.diagnosis,
        garmentType: input.garmentType,
        compressionClass: input.compressionClass,
        productFlags: input.productFlags,
        metadata: input.metadata,
      }) },
    });

    return { ok: true, value: { id: created.id, templateSnapshot: snapshot } };
  } catch (error) {
    console.error("[measurements:createDraft]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function updateMeasurementValues(
  sessionId: string,
  input: UpdateMeasurementValuesInput,
  repository: MeasurementsRepository,
): Promise<ServiceResult<{ updated: number }>> {
  try {
    const detail = await repository.getDetail(sessionId);
    if (!detail) return { ok: false, error: "NOT_FOUND" };
    if (detail.status !== "DRAFT") return { ok: false, error: "INVALID_STATE" };
    // Malformed is checked BEFORE absent: both leave templateSnapshot null, and
    // reporting an unreadable snapshot as a missing one hid the only branch that
    // can answer with an intentional, machine-readable response.
    if (detail.templateSnapshotState === "malformed") {
      console.error("[measurements:updateValues] malformed template snapshot", {
        sessionId,
        templateId: detail.templateId,
      });
      return { ok: false, error: "MALFORMED_TEMPLATE_SNAPSHOT" };
    }
    if (!detail.templateSnapshot) return { ok: false, error: "TEMPLATE_NOT_FOUND" };

    const fieldsByKey = indexFieldsByKey(detail.templateSnapshot);
    const resolved: Array<{ fieldId: string; valueNumber: number | null }> = [];

    for (const [key, value] of Object.entries(input.valuesByKey)) {
      const field = fieldsByKey.get(key);
      if (!field) {
        return { ok: false, error: "UNKNOWN_KEYS" };
      }
      resolved.push({ fieldId: field.id, valueNumber: value });
    }

    // Capture before state for audit
    const beforeValues: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(detail.values)) {
      beforeValues[key] = value;
    }

    if (hasContextChanges(input)) {
      const contextResult = await repository.updateContext({
        sessionId,
        measuredAt: input.measuredAt,
        notes: input.notes,
        diagnosis: input.diagnosis,
        garmentType: input.garmentType,
        compressionClass: input.compressionClass,
        productFlags: input.productFlags,
        metadata: input.metadata,
      });
      if (!contextResult.ok) {
        if (contextResult.status === null) return { ok: false, error: "NOT_FOUND" };
        if (contextResult.status !== "DRAFT") return { ok: false, error: "INVALID_STATE" };
        return { ok: false, error: "UNKNOWN" };
      }
    }

    const result = await repository.replaceValues({ sessionId, values: resolved });
    if (!result.ok) {
      if (result.status === null) return { ok: false, error: "NOT_FOUND" };
      if (result.status !== "DRAFT") return { ok: false, error: "INVALID_STATE" };
      return { ok: false, error: "UNKNOWN" };
    }

    // Capture after state for audit
    const afterValues: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(input.valuesByKey)) {
      afterValues[key] = value;
    }

    await recordAudit({
      action: "UPDATE",
      entityType: "MeasurementSession",
      entityId: sessionId,
      diff: { 
        before: toAuditPayload({
          id: sessionId,
          valuesByKey: beforeValues,
          status: detail.status,
          measuredAt: detail.measuredAt,
          notes: detail.notes,
          diagnosis: detail.diagnosis,
          garmentType: detail.garmentType,
          compressionClass: detail.compressionClass,
          productFlags: detail.productFlags,
          metadata: detail.metadata,
        }),
        after: toAuditPayload({
          id: sessionId,
          valuesByKey: afterValues,
          status: detail.status, // status doesn't change in this operation
          measuredAt: input.measuredAt ?? detail.measuredAt,
          notes: input.notes !== undefined ? input.notes : detail.notes,
          diagnosis: input.diagnosis !== undefined ? input.diagnosis : detail.diagnosis,
          garmentType: input.garmentType !== undefined ? input.garmentType : detail.garmentType,
          compressionClass: input.compressionClass !== undefined ? input.compressionClass : detail.compressionClass,
          productFlags: input.productFlags !== undefined ? input.productFlags : detail.productFlags,
          metadata: input.metadata !== undefined ? input.metadata : detail.metadata,
        })
      },
    });

    return { ok: true, value: { updated: resolved.length } };
  } catch (error) {
    console.error("[measurements:updateValues]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function duplicateCompletedMeasurement(
  sessionId: string,
  repository: MeasurementsRepository,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const detail = await repository.getDetail(sessionId);
    if (!detail) return { ok: false, error: "NOT_FOUND" };
    if (detail.status !== "COMPLETED") return { ok: false, error: "INVALID_STATE" };
    if (detail.templateSnapshotState === "malformed") {
      console.error("[measurements:duplicate] malformed template snapshot", {
        sessionId,
        templateId: detail.templateId,
      });
      return { ok: false, error: "MALFORMED_TEMPLATE_SNAPSHOT" };
    }
    if (!detail.templateId || !detail.templateSnapshot) return { ok: false, error: "TEMPLATE_NOT_FOUND" };

    // ORDER MATTERS: index the snapshot BEFORE opening any write, so a bad
    // snapshot can never strand a destination draft.
    const fieldsByKey = indexFieldsByKey(detail.templateSnapshot);
    const values: Array<{ fieldId: string; valueNumber: number | null }> = [];
    for (const [key, valueNumber] of Object.entries(detail.values)) {
      const field = fieldsByKey.get(key);
      if (field) values.push({ fieldId: field.id, valueNumber });
    }

    const created = await repository.createDraft({
      patientId: detail.patientId,
      templateId: detail.templateId,
      measuredAt: detail.measuredAt,
      notes: detail.notes,
      diagnosis: detail.diagnosis,
      garmentType: detail.garmentType,
      compressionClass: detail.compressionClass,
      productFlags: detail.productFlags,
      metadata: detail.metadata,
      // The ORIGINAL snapshot is copied, not the parsed projection: parsing
      // normalizes and drops unknown extra keys, and a duplicated clinical
      // record should carry the source snapshot verbatim.
      templateSnapshot: detail.templateSnapshot,
    });

    // RESIDUAL RISK, deliberately bounded and reported.
    //
    // Every fallible READ (status, template, snapshot validation, field
    // indexing) happens before the first write, so the common failure modes
    // cannot strand a draft. The two writes below still live in separate
    // repository calls, and the repository contract exposes no way to span
    // them in one transaction and no way to delete a session, so a failure
    // HERE leaves an empty DRAFT copy behind.
    //
    // It fails safe: the caller gets an error, the SOURCE measurement is
    // untouched, and the leftover is an empty draft the clinician can discard —
    // never a partially-copied clinical record presented as complete. Closing
    // it properly needs a transactional createDraftWithValues on the repository,
    // which is tracked as follow-up rather than widened into this change.
    const copied = await repository.replaceValues({ sessionId: created.id, values });
    if (!copied.ok) {
      console.error("[measurements:duplicate] values copy failed after draft creation", {
        sessionId,
        createdSessionId: created.id,
        templateId: detail.templateId,
        valueCount: values.length,
      });
      return { ok: false, error: "UNKNOWN" };
    }

    await recordAudit({
      action: "CREATE",
      entityType: "MeasurementSession",
      entityId: created.id,
      diff: { after: toAuditPayload({ id: created.id, copiedFrom: sessionId, status: "DRAFT" }) },
    });

    return { ok: true, value: { id: created.id } };
  } catch (error) {
    console.error("[measurements:duplicate]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * Admin-only correction path: reopen a COMPLETED session back to DRAFT so the
 * existing edit/finalize pipeline can fix a data-entry mistake. The completed
 * state is immutable by design, so this transition is explicit and audited
 * rather than mutating a COMPLETED record in place. VOID stays protected; a
 * session already in DRAFT is returned as-is (idempotent).
 */
export async function reopenMeasurementForCorrection(
  sessionId: string,
  repository: MeasurementsRepository,
): Promise<ServiceResult<{ id: string; status: "DRAFT" }>> {
  try {
    const detail = await repository.getDetail(sessionId);
    if (!detail) return { ok: false, error: "NOT_FOUND" };
    if (detail.status === "DRAFT") return { ok: true, value: { id: sessionId, status: "DRAFT" } };
    if (detail.status !== "COMPLETED") return { ok: false, error: "INVALID_STATE" };

    const result = await repository.reopenToDraft(sessionId);
    if (!result.ok) {
      if (result.status === null) return { ok: false, error: "NOT_FOUND" };
      return { ok: false, error: "INVALID_STATE" };
    }

    await recordAudit({
      action: "UPDATE",
      entityType: "MeasurementSession",
      entityId: sessionId,
      diff: {
        before: toAuditPayload({ id: sessionId, status: "COMPLETED" }),
        after: toAuditPayload({ id: sessionId, status: "DRAFT", reopenedForCorrection: true }),
      },
    });

    return { ok: true, value: { id: sessionId, status: "DRAFT" } };
  } catch (error) {
    console.error("[measurements:reopen]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function completeMeasurement(
  sessionId: string,
  repository: MeasurementsRepository,
): Promise<ServiceResult<{ id: string; status: "COMPLETED" }>> {
  try {
    // Get current state before completion
    const detailBefore = await repository.getDetail(sessionId);
    if (!detailBefore) return { ok: false, error: "NOT_FOUND" };
    if (detailBefore.status !== "DRAFT") return { ok: false, error: "INVALID_STATE" };

    // DOMAIN INVARIANT: a head-garment session whose snapshot is degraded or
    // empty must never be finalized. Enforced here, in the service, so it holds
    // for every caller — the UI's disabled button is a convenience, not the
    // guard. Uses the same pure classifier the UI derives its layout from, so
    // the two can never disagree. Non-head templates are untouched.
    const completionBlock = getHeadSnapshotCompletionBlock(detailBefore.templateSnapshot);
    if (completionBlock) {
      console.error("[measurements:completeMeasurement] refused incomplete head snapshot", {
        sessionId,
        templateCode: detailBefore.templateSnapshot?.code ?? null,
        reason: completionBlock,
      });
      return { ok: false, error: "INCOMPLETE_TEMPLATE_SNAPSHOT" };
    }

    const result = await repository.markCompleted(sessionId);
    if (result.status === "COMPLETED") {
      // Get state after completion
      const detailAfter = await repository.getDetail(sessionId);
      
      await recordAudit({
        action: "UPDATE", // Using UPDATE since we're changing status from DRAFT to COMPLETED
        entityType: "MeasurementSession",
        entityId: sessionId,
        diff: { 
          before: toAuditPayload({
            id: detailBefore.id,
            patientId: detailBefore.patientId,
            templateId: detailBefore.templateId,
            status: detailBefore.status,
            measuredAt: detailBefore.measuredAt,
            notes: detailBefore.notes,
            diagnosis: detailBefore.diagnosis,
            garmentType: detailBefore.garmentType,
            compressionClass: detailBefore.compressionClass,
            productFlags: detailBefore.productFlags,
            metadata: detailBefore.metadata,
          }),
          after: toAuditPayload({
            id: detailAfter?.id || sessionId,
            patientId: detailAfter?.patientId || "",
            templateId: detailAfter?.templateId || null,
            status: "COMPLETED",
            measuredAt: detailAfter?.measuredAt || new Date(),
            notes: detailAfter?.notes,
            diagnosis: detailAfter?.diagnosis,
            garmentType: detailAfter?.garmentType,
            compressionClass: detailAfter?.compressionClass,
            productFlags: detailAfter?.productFlags,
            metadata: detailAfter?.metadata,
          })
        },
      });

      return { ok: true, value: { id: sessionId, status: "COMPLETED" } };
    }
    if (result.status === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    return { ok: false, error: "INVALID_STATE" };
  } catch (error) {
    console.error("[measurements:complete]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function getMeasurement(
  sessionId: string,
  repository: MeasurementsRepository,
): Promise<ServiceResult<MeasurementSessionDetail>> {
  try {
    const detail = await repository.getDetail(sessionId);
    if (!detail) return { ok: false, error: "NOT_FOUND" };
    return { ok: true, value: detail };
  } catch (error) {
    console.error("[measurements:get]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function listPatientMeasurements(
  patientId: string,
  query: ListMeasurementsQuery,
  repository: MeasurementsRepository,
): Promise<ServiceResult<MeasurementSessionSummary[]>> {
  try {
    const list = await repository.listByPatient(patientId, query.limit);
    return { ok: true, value: list };
  } catch (error) {
    console.error("[measurements:list]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function nullableDecimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

function jsonToRecord<T extends Record<string, unknown>>(
  value: Prisma.JsonValue | null | undefined,
): T | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as T;
}

const defaultRepository: MeasurementsRepository = {
  async getActiveTemplateSnapshot(code) {
    const prisma = getPrisma();
    const template = await prisma.measurementTemplate.findUnique({
      where: { code },
      include: {
        // Only the CURRENT definition is projected into a new session's
        // snapshot. Retired rows stay in the database so history and existing
        // draft snapshots keep resolving, but a new session must never inherit
        // them — an obsolete field would make the head-garment classifier see a
        // snapshot that does not match the declared set, marking every new
        // session degraded and permanently unfinalizable.
        sections: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            fields: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (!template || !template.isActive) return null;

    return {
      templateId: template.id,
      code: template.code ?? code,
      name: template.name,
      version: template.version,
      description: template.description,
      sections: template.sections.map((section) => ({
        title: section.title,
        sortOrder: section.sortOrder,
        fields: section.fields.map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          fieldType: "NUMBER" as const,
          unit: field.unit ?? "cm",
          isRequired: field.isRequired,
          sortOrder: field.sortOrder,
          minValue: decimalToNumber(field.minValue),
          maxValue: decimalToNumber(field.maxValue),
          metadata: (field.metadata as Record<string, unknown> | null) ?? {},
        })),
      })),
    };
  },

  async patientExists(patientId) {
    const prisma = getPrisma();
    const found = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    return found !== null;
  },

  async createDraft(input) {
    const prisma = getPrisma();
    const created = await prisma.measurementSession.create({
      data: {
        patientId: input.patientId,
        templateId: input.templateId,
        status: "DRAFT",
        measuredAt: input.measuredAt,
        notes: input.notes,
        diagnosis: input.diagnosis,
        garmentType: input.garmentType,
        compressionClass: input.compressionClass,
        productFlags: input.productFlags as Prisma.InputJsonValue,
        metadata: input.metadata as Prisma.InputJsonValue,
        templateSnapshot: input.templateSnapshot as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return created;
  },

  async getDetail(id) {
    const prisma = getPrisma();
    const session = await prisma.measurementSession.findUnique({
      where: { id },
      include: {
        values: { include: { field: { select: { key: true } } } },
      },
    });
    if (!session) return null;

    const valuesByKey: Record<string, number | null> = {};
    for (const value of session.values) {
      valuesByKey[value.field.key] = nullableDecimalToNumber(value.valueNumber);
    }

    return {
      id: session.id,
      patientId: session.patientId,
      templateId: session.templateId,
      status: session.status,
      measuredAt: session.measuredAt,
      notes: session.notes,
      diagnosis: session.diagnosis,
      garmentType: session.garmentType,
      compressionClass: session.compressionClass,
      productFlags: jsonToRecord<Record<string, boolean>>(session.productFlags),
      metadata: jsonToRecord<Record<string, unknown>>(session.metadata),
      // Parsed exactly ONCE, here at the boundary, and classified so callers
      // can tell "never had a snapshot" from "has one we cannot read".
      ...classifyPersistedSnapshot(session.templateSnapshot),
      values: valuesByKey,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  },

  async listByPatient(patientId, limit) {
    const prisma = getPrisma();
    const sessions = await prisma.measurementSession.findMany({
      where: { patientId },
      orderBy: { measuredAt: "desc" },
      take: limit,
    });
    return sessions.map((session) => ({
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
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      const session = await tx.measurementSession.findUnique({
        where: { id: input.sessionId },
        select: { status: true },
      });
      if (!session) return { ok: false, status: null };
      if (session.status !== "DRAFT") return { ok: false, status: session.status };

      for (const value of input.values) {
        if (value.valueNumber === null) {
          await tx.measurementValue.deleteMany({
            where: { sessionId: input.sessionId, fieldId: value.fieldId },
          });
          continue;
        }
        await tx.measurementValue.upsert({
          where: { sessionId_fieldId: { sessionId: input.sessionId, fieldId: value.fieldId } },
          update: { valueNumber: new Prisma.Decimal(value.valueNumber) },
          create: {
            sessionId: input.sessionId,
            fieldId: value.fieldId,
            valueNumber: new Prisma.Decimal(value.valueNumber),
          },
        });
      }
      return { ok: true, status: "DRAFT" };
    });
  },

  async updateContext(input) {
    const prisma = getPrisma();
    const data: Prisma.MeasurementSessionUpdateInput = {};
    if (input.measuredAt !== undefined) data.measuredAt = input.measuredAt;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.diagnosis !== undefined) data.diagnosis = input.diagnosis;
    if (input.garmentType !== undefined) data.garmentType = input.garmentType;
    if (input.compressionClass !== undefined) data.compressionClass = input.compressionClass;
    if (input.productFlags !== undefined) data.productFlags = input.productFlags as Prisma.InputJsonValue;
    if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

    return prisma.$transaction(async (tx) => {
      const session = await tx.measurementSession.findUnique({
        where: { id: input.sessionId },
        select: { status: true },
      });
      if (!session) return { ok: false, status: null };
      if (session.status !== "DRAFT") return { ok: false, status: session.status };

      await tx.measurementSession.update({
        where: { id: input.sessionId },
        data,
      });
      return { ok: true, status: "DRAFT" };
    });
  },

  async markCompleted(id) {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      const session = await tx.measurementSession.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!session) return { status: "NOT_FOUND" } as const;
      if (session.status !== "DRAFT") return { status: "INVALID_STATE" } as const;

      await tx.measurementSession.update({
        where: { id },
        data: { status: "COMPLETED" },
      });
      return { status: "COMPLETED" } as const;
    });
  },

  async reopenToDraft(id) {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      const session = await tx.measurementSession.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!session) return { ok: false, status: null };
      // Only a COMPLETED session can be reopened; DRAFT needs no change and VOID
      // must never become editable.
      if (session.status !== "COMPLETED") return { ok: false, status: session.status };

      await tx.measurementSession.update({
        where: { id },
        data: { status: "DRAFT" },
      });
      return { ok: true, status: "DRAFT" };
    });
  },
};

export function getDefaultMeasurementsRepository(): MeasurementsRepository {
  return defaultRepository;
}
