import { NextResponse } from "next/server";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import { parseCreatePatientInput, parseListPatientsQuery } from "@/lib/patients-input";
import { createPatient, listPatients } from "@/lib/patients";

export type PatientsRouteDeps = {
  create: typeof createPatient;
  list: typeof listPatients;
};

const defaultDeps: PatientsRouteDeps = {
  create: createPatient,
  list: listPatients,
};

export async function handlePostPatientRequest(
  request: Request,
  _user: AuthUser,
  deps: PatientsRouteDeps = defaultDeps,
) {
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

export async function handleGetPatientsRequest(
  request: Request,
  _user: AuthUser,
  deps: PatientsRouteDeps = defaultDeps,
) {
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

export const POST = withAuth(async (request, _ctx, { user }) =>
  handlePostPatientRequest(request, user),
);

export const GET = withAuth(async (request, _ctx, { user }) =>
  handleGetPatientsRequest(request, user),
);
