import { NextResponse } from "next/server";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import {
  parseCreateMeasurementInput,
  parseListMeasurementsQuery,
} from "@/lib/measurements-input";
import {
  createDraftMeasurement,
  getDefaultMeasurementsRepository,
  listPatientMeasurements,
  type MeasurementsRepository,
} from "@/lib/measurements";

const DEFAULT_TEMPLATE_CODE = "compression-v1";

type Params = {
  params: Promise<{ id: string }>;
};

export type MeasurementsCollectionDeps = {
  repository: MeasurementsRepository;
  templateCode: string;
};

const defaultDeps: MeasurementsCollectionDeps = {
  repository: getDefaultMeasurementsRepository(),
  templateCode: DEFAULT_TEMPLATE_CODE,
};

export async function handlePostMeasurementRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: MeasurementsCollectionDeps = defaultDeps,
) {
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

  const parsed = parseCreateMeasurementInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const metadataEntries: Record<string, unknown> = {};
  if (parsed.value.patientSex) metadataEntries.patientSex = parsed.value.patientSex;
  if (parsed.value.garmentSnapshot) metadataEntries.garmentSnapshot = parsed.value.garmentSnapshot;
  const metadata = Object.keys(metadataEntries).length > 0 ? metadataEntries : null;

  const result = await createDraftMeasurement(
    {
      patientId: id,
      templateCode: deps.templateCode,
      measuredAt: parsed.value.measuredAt,
      notes: parsed.value.notes,
      diagnosis: parsed.value.diagnosis,
      garmentType: parsed.value.garmentType,
      compressionClass: parsed.value.compressionClass,
      productFlags: parsed.value.productFlags,
      metadata,
    },
    deps.repository,
  );

  if (!result.ok) {
    if (result.error === "PATIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    if (result.error === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Active measurement template not found" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(
    { id: result.value.id, templateSnapshot: result.value.templateSnapshot },
    { status: 201 },
  );
}

export async function handleListMeasurementsRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: MeasurementsCollectionDeps = defaultDeps,
) {
  const { id } = await params;
  if (!id.trim()) {
    return NextResponse.json({ error: "Patient id is required" }, { status: 400 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedQuery = parseListMeasurementsQuery(searchParams);
  if (!parsedQuery.ok) {
    return NextResponse.json({ errors: parsedQuery.errors }, { status: 400 });
  }

  const result = await listPatientMeasurements(id, parsedQuery.value, deps.repository);
  if (!result.ok) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ items: result.value }, { status: 200 });
}

export const POST = withAuth<Params>(async (request, ctx, { user }) =>
  handlePostMeasurementRequest(request, ctx, user),
);

export const GET = withAuth<Params>(async (request, ctx, { user }) =>
  handleListMeasurementsRequest(request, ctx, user),
);
