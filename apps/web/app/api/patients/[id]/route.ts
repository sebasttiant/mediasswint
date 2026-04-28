import { NextResponse } from "next/server";

import { requireActiveUserFromRequest, type AuthUser } from "@/lib/auth";
import { parseUpdatePatientInput } from "@/lib/patients-input";
import { getPatient, updatePatient } from "@/lib/patients";

type Params = {
  params: Promise<{ id: string }>;
};

export type PatientRouteDeps = {
  requireActiveUser: (request: Request) => Promise<AuthUser | null>;
  get: typeof getPatient;
  update: typeof updatePatient;
};

const defaultDeps: PatientRouteDeps = {
  requireActiveUser: requireActiveUserFromRequest,
  get: getPatient,
  update: updatePatient,
};

export async function handleGetPatientRequest(request: Request, { params }: Params, deps: PatientRouteDeps = defaultDeps) {
  const user = await deps.requireActiveUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!id.trim()) {
    return NextResponse.json({ error: "Patient id is required" }, { status: 400 });
  }

  const result = await deps.get(id);
  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value, { status: 200 });
}

export async function GET(request: Request, context: Params) {
  return handleGetPatientRequest(request, context);
}

export async function handlePatchPatientRequest(request: Request, { params }: Params, deps: PatientRouteDeps = defaultDeps) {
  const user = await deps.requireActiveUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!id.trim()) {
    return NextResponse.json({ error: "Patient id is required" }, { status: 400 });
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

  const parsedInput = parseUpdatePatientInput(body);
  if (!parsedInput.ok) {
    return NextResponse.json({ errors: parsedInput.errors }, { status: 400 });
  }

  const result = await deps.update(id, parsedInput.value);
  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (result.error === "CONFLICT") {
      return NextResponse.json({ error: "Patient document already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value, { status: 200 });
}

export async function PATCH(request: Request, context: Params) {
  return handlePatchPatientRequest(request, context);
}
