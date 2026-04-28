import { NextResponse } from "next/server";

import { requireActiveUserFromRequest, type AuthUser } from "@/lib/auth";
import { parseCreatePatientInput, parseListPatientsQuery } from "@/lib/patients-input";
import { createPatient, listPatients } from "@/lib/patients";

export type PatientsRouteDeps = {
  requireActiveUser: (request: Request) => Promise<AuthUser | null>;
  create: typeof createPatient;
  list: typeof listPatients;
};

const defaultDeps: PatientsRouteDeps = {
  requireActiveUser: requireActiveUserFromRequest,
  create: createPatient,
  list: listPatients,
};

export async function handlePostPatientRequest(request: Request, deps: PatientsRouteDeps = defaultDeps) {
  const user = await deps.requireActiveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const parsedInput = parseCreatePatientInput(body);
  if (!parsedInput.ok) {
    return NextResponse.json({ errors: parsedInput.errors }, { status: 400 });
  }

  const result = await deps.create(parsedInput.value);
  if (!result.ok) {
    if (result.error === "CONFLICT") {
      return NextResponse.json(
        { error: "Patient document already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value, { status: 201 });
}

export async function handleGetPatientsRequest(request: Request, deps: PatientsRouteDeps = defaultDeps) {
  const user = await deps.requireActiveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedQuery = parseListPatientsQuery(searchParams);

  if (!parsedQuery.ok) {
    return NextResponse.json({ errors: parsedQuery.errors }, { status: 400 });
  }

  const result = await deps.list(parsedQuery.value);
  if (!result.ok) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value, { status: 200 });
}

export async function POST(request: Request) {
  return handlePostPatientRequest(request);
}

export async function GET(request: Request) {
  return handleGetPatientsRequest(request);
}
