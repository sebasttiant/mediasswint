import { NextResponse } from "next/server";

import { requireActiveUserFromRequest, type AuthUser } from "@/lib/auth";
import { getPatient } from "@/lib/patients";

type Params = {
  params: Promise<{ id: string }>;
};

export type PatientRouteDeps = {
  requireActiveUser: (request: Request) => Promise<AuthUser | null>;
  get: typeof getPatient;
};

const defaultDeps: PatientRouteDeps = {
  requireActiveUser: requireActiveUserFromRequest,
  get: getPatient,
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
