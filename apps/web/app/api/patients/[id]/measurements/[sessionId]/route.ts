import { NextResponse } from "next/server";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import { parseUpdateMeasurementValuesInput } from "@/lib/measurements-input";
import {
  completeMeasurement,
  duplicateCompletedMeasurement,
  getDefaultMeasurementsRepository,
  getMeasurement,
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

function notFound(entity: string) {
  return NextResponse.json({ error: `${entity} not found` }, { status: 404 });
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

  const parsed = parseUpdateMeasurementValuesInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const detail = await getMeasurement(sessionId, deps.repository);
  if (!detail.ok) {
    if (detail.error === "NOT_FOUND") return notFound("Measurement");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (detail.value.patientId !== id) {
    return notFound("Measurement");
  }

  const updated = await updateMeasurementValues(
    sessionId,
    {
      valuesByKey: parsed.value.valuesByKey,
      measuredAt: parsed.value.measuredAt,
      notes: parsed.value.notes,
      diagnosis: parsed.value.diagnosis,
      garmentType: parsed.value.garmentType,
      compressionClass: parsed.value.compressionClass,
      productFlags: parsed.value.productFlags,
    },
    deps.repository,
  );
  if (!updated.ok) {
    if (updated.error === "NOT_FOUND") return notFound("Measurement");
    if (updated.error === "INVALID_STATE") {
      return NextResponse.json({ error: "Measurement is not editable" }, { status: 409 });
    }
    if (updated.error === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Measurement template snapshot missing" },
        { status: 500 },
      );
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
      return NextResponse.json({ error: "Measurement template snapshot missing" }, { status: 500 });
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
