import { NextResponse } from "next/server";

import { requireActiveUserFromRequest, type AuthUser } from "@/lib/auth";
import { parseUpdateMeasurementValuesInput } from "@/lib/measurements-input";
import {
  completeMeasurement,
  getDefaultMeasurementsRepository,
  getMeasurement,
  updateMeasurementValues,
  type MeasurementsRepository,
} from "@/lib/measurements";

type Params = {
  params: Promise<{ id: string; sessionId: string }>;
};

export type MeasurementSessionDeps = {
  requireActiveUser: (request: Request) => Promise<AuthUser | null>;
  repository: MeasurementsRepository;
};

const defaultDeps: MeasurementSessionDeps = {
  requireActiveUser: requireActiveUserFromRequest,
  repository: getDefaultMeasurementsRepository(),
};

function notFound(entity: string) {
  return NextResponse.json({ error: `${entity} not found` }, { status: 404 });
}

export async function handleGetMeasurementRequest(
  request: Request,
  { params }: Params,
  deps: MeasurementSessionDeps = defaultDeps,
) {
  const user = await deps.requireActiveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  deps: MeasurementSessionDeps = defaultDeps,
) {
  const user = await deps.requireActiveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    { valuesByKey: parsed.value.valuesByKey },
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

export async function GET(request: Request, context: Params) {
  return handleGetMeasurementRequest(request, context);
}

export async function PATCH(request: Request, context: Params) {
  return handlePatchMeasurementRequest(request, context);
}
