import { NextResponse } from "next/server";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import { resolveCanonicalGarmentIdentity } from "@/lib/garment-template-identity";
import { getHeadSnapshotCompletionBlock } from "@/lib/head-measurement-layout";
import {
  buildMeasurementKeyRanges,
  parseUpdateMeasurementValuesInput,
} from "@/lib/measurements-input";
import {
  completeMeasurement,
  duplicateCompletedMeasurement,
  getDefaultMeasurementsRepository,
  getMeasurement,
  saveAndCompleteMeasurement,
  reopenMeasurementForCorrection,
  updateMeasurementValues,
  type MeasurementsRepository,
} from "@/lib/measurements";

type Params = {
  params: Promise<{ id: string; sessionId: string }>;
};

export type MeasurementSessionDeps = {
  repository: MeasurementsRepository;
};

const defaultDeps: MeasurementSessionDeps = {
  repository: getDefaultMeasurementsRepository(),
};

function metadataGarmentReference(metadata: Record<string, unknown> | null): unknown {
  if (!metadata || typeof metadata.garmentSnapshot !== "object" || metadata.garmentSnapshot === null) {
    return undefined;
  }
  return (metadata.garmentSnapshot as { reference?: unknown }).reference;
}

function notFound(entity: string) {
  return NextResponse.json({ error: `${entity} not found` }, { status: 404 });
}

/**
 * 422, not 500: the request is well formed, the STORED snapshot is not. The
 * machine-readable code lets the client state something true and offer real
 * remediation instead of blaming the clinician's input.
 *
 * Every caller shares this one response so the two snapshot states can never
 * drift apart across the PATCH and duplicate paths. It deliberately carries NO
 * `committed` or `status` field: a request answered with it wrote nothing.
 */
function malformedTemplateSnapshotResponse() {
  return NextResponse.json(
    {
      error: "Measurement template snapshot is unreadable",
      code: "MALFORMED_TEMPLATE_SNAPSHOT",
    },
    { status: 422 },
  );
}

/**
 * Distinct from the malformed response on purpose: a session that never had a
 * snapshot is an infrastructure fault the client cannot act on, so it stays a
 * 500 with no remediation code.
 */
function missingTemplateSnapshotResponse() {
  return NextResponse.json({ error: "Measurement template snapshot missing" }, { status: 500 });
}

export async function handleGetMeasurementRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: MeasurementSessionDeps = defaultDeps,
) {
  const { id, sessionId } = await params;
  if (!id.trim() || !sessionId.trim()) {
    return NextResponse.json({ error: "Path parameters are required" }, { status: 400 });
  }

  const result = await getMeasurement(sessionId, deps.repository);
  if (!result.ok) {
    if (result.error === "NOT_FOUND") return notFound("Measurement");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (result.value.patientId !== id) {
    return notFound("Measurement");
  }

  return NextResponse.json(result.value, { status: 200 });
}

export async function handlePatchMeasurementRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: MeasurementSessionDeps = defaultDeps,
) {
  const { id, sessionId } = await params;
  if (!id.trim() || !sessionId.trim()) {
    return NextResponse.json({ error: "Path parameters are required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { errors: [{ field: "body", message: "invalid JSON body" }] },
      { status: 400 },
    );
  }

  // The session is loaded BEFORE the body is validated because the set of
  // allowed measurement keys is a property of THIS session's template
  // snapshot, not a global constant. Validating against the compression
  // catalog rejected every Mentonera/Máscara key as unknown, so populated
  // MA/MMA/ME sessions could never be saved (400). Ownership is still checked
  // before anything is written.
  const detail = await getMeasurement(sessionId, deps.repository);
  if (!detail.ok) {
    if (detail.error === "NOT_FOUND") return notFound("Measurement");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (detail.value.patientId !== id) {
    return notFound("Measurement");
  }

  // The snapshot's STATE is resolved before the body is validated, because the
  // set of allowed keys is DERIVED from that snapshot. An unusable snapshot
  // yields an empty key set, so validating against it reported a stored-data
  // fault as "unknown measurement keys" — blaming the clinician's input — and,
  // for `complete: true`, let the request reach the atomic save+complete branch
  // where MALFORMED_TEMPLATE_SNAPSHOT collapsed into a generic 500.
  //
  // Deciding it here keeps the answer identical for both `complete` values and
  // guarantees a refused request writes nothing at all.
  if (detail.value.templateSnapshotState === "malformed") {
    return malformedTemplateSnapshotResponse();
  }
  if (detail.value.templateSnapshotState === "absent") {
    return missingTemplateSnapshotResponse();
  }

  const parsed = parseUpdateMeasurementValuesInput(
    body,
    buildMeasurementKeyRanges(detail.value.templateSnapshot),
  );
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  // GARMENT IDENTITY IS CANONICAL, SINGULAR AND IMMUTABLE ACROSS TEMPLATES.
  //
  // The request may name the garment in `garmentType` and again inside
  // `metadata.garmentSnapshot`. Both must name the SAME garment: MA and MMA
  // share the mascara-v1 measurement set but are different clinical products,
  // so a payload mixing them would persist a record contradicting itself.
  //
  // Whatever survives is then checked against the session's persisted template
  // snapshot, and the display metadata written to the record is derived from
  // the server catalog rather than trusted from the client.
  //
  // This runs AFTER the ownership check above, so a caller who does not own the
  // session learns nothing about its garment, and BEFORE any write, so a
  // refused request changes nothing.
  const identity = resolveCanonicalGarmentIdentity({
    garmentType: parsed.value.garmentType,
    garmentSnapshot: { reference: parsed.value.garmentSnapshotReference },
  });
  // A reference the catalog does not know is legacy free text. The repository
  // deliberately supports it (`resolveLegacyGarmentSelectOption`), so refusing
  // it outright would make every historical session uneditable. It is allowed
  // ONLY when it changes nothing: same value already on the session, and no
  // garmentSnapshot trying to attach a canonical identity to it.
  const unchangedLegacyGarment =
    identity.ok === false &&
    identity.reason === "UNKNOWN_REFERENCE" &&
    parsed.value.garmentSnapshotReference == null &&
    typeof parsed.value.garmentType === "string" &&
    parsed.value.garmentType === detail.value.garmentType;

  if (!identity.ok && !unchangedLegacyGarment) {
    console.error("[measurements:patch] refused inconsistent garment identity", {
      sessionId,
      templateCode: detail.value.templateSnapshot?.code ?? null,
      code: "GARMENT_TEMPLATE_MISMATCH",
      reason: identity.reason,
    });
    return NextResponse.json(
      {
        error: "Garment identity is inconsistent",
        code: "GARMENT_TEMPLATE_MISMATCH",
        reason:
          identity.reason === "UNKNOWN_REFERENCE"
            ? "La prenda indicada no existe en el catálogo."
            : "La prenda indicada no coincide entre los campos enviados.",
      },
      { status: 409 },
    );
  }

  const sessionTemplateCode = detail.value.templateSnapshot?.code ?? null;
  const canonicalIdentity = identity.ok ? identity.identity : null;
  const persistedIdentity = resolveCanonicalGarmentIdentity({
    garmentType: detail.value.garmentType,
    garmentSnapshot: { reference: metadataGarmentReference(detail.value.metadata) },
  });
  const persistedLegacyFreeText =
    persistedIdentity.ok === false &&
    persistedIdentity.reason === "UNKNOWN_REFERENCE" &&
    (metadataGarmentReference(detail.value.metadata) === undefined ||
      metadataGarmentReference(detail.value.metadata) === detail.value.garmentType);
  if (!persistedIdentity.ok && !persistedLegacyFreeText) {
    return NextResponse.json(
      {
        error: "Stored garment identity is inconsistent",
        code: "GARMENT_TEMPLATE_MISMATCH",
      },
      { status: 409 },
    );
  }
  if (
    canonicalIdentity !== null &&
    persistedIdentity.ok &&
    persistedIdentity.identity !== null &&
    canonicalIdentity.reference !== persistedIdentity.identity.reference
  ) {
    return NextResponse.json(
      {
        error: "Garment does not match this measurement's canonical identity",
        code: "GARMENT_TEMPLATE_MISMATCH",
      },
      { status: 409 },
    );
  }
  if (
    canonicalIdentity !== null &&
    sessionTemplateCode !== null &&
    canonicalIdentity.templateCode !== sessionTemplateCode
  ) {
    console.error("[measurements:patch] refused cross-garment identity change", {
      sessionId,
      templateCode: sessionTemplateCode,
      requestedTemplateCode: canonicalIdentity.templateCode,
      code: "GARMENT_TEMPLATE_MISMATCH",
    });
    return NextResponse.json(
      {
        error: "Garment does not match this measurement's template",
        code: "GARMENT_TEMPLATE_MISMATCH",
        reason:
          "La prenda solicitada usa una plantilla de medidas distinta a la de esta sesión. " +
          "Creá una sesión nueva para esa prenda.",
      },
      { status: 409 },
    );
  }

  // Only rewrite metadata when the PATCH carried a VALID garmentSnapshot.
  // A malformed snapshot (parsed to null) is ignored so an existing snapshot and
  // patientSex stay intact; an absent metadata field (undefined) is also no-touch.
  let mergedMetadata: Record<string, unknown> | undefined = undefined;
  if (parsed.value.garmentSnapshotReference != null && canonicalIdentity !== null) {
    const existing = detail.value.metadata ?? {};
    // The CANONICAL snapshot is persisted — label, family and figure come from
    // the server catalog, so a spoofed display payload cannot be stored.
    mergedMetadata = {
      ...existing,
      garmentSnapshot: {
        reference: canonicalIdentity.reference,
        label: canonicalIdentity.label,
        family: canonicalIdentity.family,
        figureKey: canonicalIdentity.figureKey,
      },
    };
  }

  const updateInput = {
      valuesByKey: parsed.value.valuesByKey,
      measuredAt: parsed.value.measuredAt,
      notes: parsed.value.notes,
      diagnosis: parsed.value.diagnosis,
      garmentType: parsed.value.garmentType,
      compressionClass: parsed.value.compressionClass,
      productFlags: parsed.value.productFlags,
      ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
    };

  // A complete, structurally valid snapshot must save and transition in the
  // SAME database transaction. The incomplete path intentionally remains the
  // existing save-then-422 flow so the clinician's draft values are retained.
  if (parsed.value.complete && !getHeadSnapshotCompletionBlock(detail.value.templateSnapshot)) {
    const completed = await saveAndCompleteMeasurement(sessionId, updateInput, deps.repository);
    if (!completed.ok) {
      if (completed.error === "NOT_FOUND") return notFound("Measurement");
      if (completed.error === "INVALID_STATE") return NextResponse.json({ error: "Measurement is not editable" }, { status: 409 });
      if (completed.error === "MP_COMPLETION_INVALID") {
        const savedDraft = await updateMeasurementValues(sessionId, updateInput, deps.repository);
        if (!savedDraft.ok) {
          if (savedDraft.error === "NOT_FOUND") return notFound("Measurement");
          if (savedDraft.error === "INVALID_STATE") return NextResponse.json({ error: "Measurement is not editable" }, { status: 409 });
          return NextResponse.json({ error: "Internal server error", committed: false }, { status: 500 });
        }
        return NextResponse.json(
          { error: "MP/Bermuda completion requirements are incomplete", errors: completed.errors, committed: true },
          { status: 422 },
        );
      }
      // Snapshot state stays machine-readable inside the atomic branch too, so
      // `complete: true` can never downgrade it to an opaque 500.
      if (completed.error === "MALFORMED_TEMPLATE_SNAPSHOT") {
        return malformedTemplateSnapshotResponse();
      }
      if (completed.error === "TEMPLATE_NOT_FOUND") {
        return missingTemplateSnapshotResponse();
      }
      return NextResponse.json({ error: "Internal server error", committed: false }, { status: 500 });
    }
    const refreshedAfterCommit = await getMeasurement(sessionId, deps.repository);
    if (!refreshedAfterCommit.ok) {
      return NextResponse.json({ id: sessionId, status: "COMPLETED", committed: true }, { status: 202 });
    }
    return NextResponse.json(refreshedAfterCommit.value, { status: 200 });
  }

  const updated = await updateMeasurementValues(sessionId, updateInput, deps.repository);
  if (!updated.ok) {
    if (updated.error === "NOT_FOUND") return notFound("Measurement");
    if (updated.error === "INVALID_STATE") {
      return NextResponse.json({ error: "Measurement is not editable" }, { status: 409 });
    }
    if (updated.error === "TEMPLATE_NOT_FOUND") {
      return missingTemplateSnapshotResponse();
    }
    // Defence in depth: the guard above already answered this state, but the
    // service re-reads the session, so a concurrent write could still surface
    // it here. Same response either way.
    if (updated.error === "MALFORMED_TEMPLATE_SNAPSHOT") {
      return malformedTemplateSnapshotResponse();
    }
    if (updated.error === "UNKNOWN_KEYS") {
      return NextResponse.json(
        { errors: [{ field: "valuesByKey", message: "unknown measurement keys" }] },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (parsed.value.complete) {
    const completed = await completeMeasurement(sessionId, deps.repository);
    if (!completed.ok) {
      if (completed.error === "NOT_FOUND") return notFound("Measurement");
      if (completed.error === "INVALID_STATE") {
        return NextResponse.json({ error: "Measurement is not editable" }, { status: 409 });
      }
      // The values written above are kept: the draft save succeeded, only the
      // transition to COMPLETED is refused. 422 — the request was well formed
      // but the session's persisted template snapshot cannot be finalized.
      if (completed.error === "INCOMPLETE_TEMPLATE_SNAPSHOT") {
        return NextResponse.json(
          {
            error: "Measurement template snapshot is incomplete",
            code: "INCOMPLETE_TEMPLATE_SNAPSHOT",
            reason: getHeadSnapshotCompletionBlock(detail.value.templateSnapshot),
          },
          { status: 422 },
        );
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  const refreshed = await getMeasurement(sessionId, deps.repository);
  if (!refreshed.ok) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(refreshed.value, { status: 200 });
}

export const GET = withAuth<Params>(async (request, ctx, { user }) =>
  handleGetMeasurementRequest(request, ctx, user),
);

export const PATCH = withAuth<Params>(async (request, ctx, { user }) =>
  handlePatchMeasurementRequest(request, ctx, user),
);

export async function handleDuplicateMeasurementRequest(
  _request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: MeasurementSessionDeps = defaultDeps,
) {
  const { id, sessionId } = await params;
  if (!id.trim() || !sessionId.trim()) {
    return NextResponse.json({ error: "Path parameters are required" }, { status: 400 });
  }

  const detail = await getMeasurement(sessionId, deps.repository);
  if (!detail.ok) {
    if (detail.error === "NOT_FOUND") return notFound("Measurement");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (detail.value.patientId !== id) return notFound("Measurement");

  const duplicated = await duplicateCompletedMeasurement(sessionId, deps.repository);
  if (!duplicated.ok) {
    if (duplicated.error === "NOT_FOUND") return notFound("Measurement");
    if (duplicated.error === "INVALID_STATE") {
      return NextResponse.json({ error: "Only completed measurements can be duplicated" }, { status: 409 });
    }
    if (duplicated.error === "TEMPLATE_NOT_FOUND") {
      return missingTemplateSnapshotResponse();
    }
    if (duplicated.error === "MALFORMED_TEMPLATE_SNAPSHOT") {
      return malformedTemplateSnapshotResponse();
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: duplicated.value.id,
      editHref: `/patients/${encodeURIComponent(id)}/measurements/${encodeURIComponent(duplicated.value.id)}/edit`,
    },
    { status: 201 },
  );
}

/**
 * Admin-only: reopen a COMPLETED measurement to DRAFT so it can be corrected via
 * the standard edit flow. Authorization (ADMIN) is enforced by withAdminAuth on
 * the route; this handler validates ownership and delegates the state change.
 */
export async function handleReopenMeasurementRequest(
  _request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: MeasurementSessionDeps = defaultDeps,
) {
  const { id, sessionId } = await params;
  if (!id.trim() || !sessionId.trim()) {
    return NextResponse.json({ error: "Path parameters are required" }, { status: 400 });
  }

  const detail = await getMeasurement(sessionId, deps.repository);
  if (!detail.ok) {
    if (detail.error === "NOT_FOUND") return notFound("Measurement");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (detail.value.patientId !== id) return notFound("Measurement");

  const reopened = await reopenMeasurementForCorrection(sessionId, deps.repository);
  if (!reopened.ok) {
    if (reopened.error === "NOT_FOUND") return notFound("Measurement");
    if (reopened.error === "INVALID_STATE") {
      return NextResponse.json(
        { error: "Only completed measurements can be reopened for correction" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: reopened.value.id,
      editHref: `/patients/${encodeURIComponent(id)}/measurements/${encodeURIComponent(reopened.value.id)}/edit`,
    },
    { status: 200 },
  );
}
