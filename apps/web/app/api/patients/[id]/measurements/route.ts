import { NextResponse } from "next/server";

import { resolveCanonicalGarmentIdentity } from "@/lib/garment-template-identity";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import { resolveTemplateCode } from "@/lib/garment-template-resolver";
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

type Params = {
  params: Promise<{ id: string }>;
};

export type MeasurementsCollectionDeps = {
  repository: MeasurementsRepository;
  // Resolves the garment reference (parsed.value.garmentType) into a
  // templateCode instead of a hardcoded constant, so each garment can carry
  // its own dedicated measurement template — unmapped/unknown/empty garments
  // safely fall back to compression-v1 (see garment-template-resolver.ts).
  resolveTemplateCode: (reference: string | null | undefined) => string;
};

const defaultDeps: MeasurementsCollectionDeps = {
  repository: getDefaultMeasurementsRepository(),
  resolveTemplateCode,
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

  // The template used to be derived from `garmentType` while an INDEPENDENTLY
  // supplied `metadata.garmentSnapshot` was persisted verbatim, so a draft could
  // be created with a Máscara schema and a Mentonera label. Identity is resolved
  // once, from the server catalog, and both fields must agree.
  const identity = resolveCanonicalGarmentIdentity({
    garmentType: parsed.value.garmentType,
    garmentSnapshot: { reference: parsed.value.garmentSnapshotReference },
  });
  // An unknown reference with no garmentSnapshot is legacy free text, which the
  // repository still supports for historical records; anything else must agree.
  const legacyFreeTextGarment =
    identity.ok === false &&
    identity.reason === "UNKNOWN_REFERENCE" &&
    parsed.value.garmentSnapshotReference == null;

  if (!identity.ok && !legacyFreeTextGarment) {
    console.error("[measurements:createDraft] refused inconsistent garment identity", {
      patientId: id,
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

  const canonicalIdentity = identity.ok ? identity.identity : null;

  const metadataEntries: Record<string, unknown> = {};
  if (parsed.value.patientSex) metadataEntries.patientSex = parsed.value.patientSex;
  // Persist the CANONICAL snapshot, never the client's display fields.
  if (canonicalIdentity) {
    metadataEntries.garmentSnapshot = {
      reference: canonicalIdentity.reference,
      label: canonicalIdentity.label,
      family: canonicalIdentity.family,
      figureKey: canonicalIdentity.figureKey,
    };
  }
  const metadata = Object.keys(metadataEntries).length > 0 ? metadataEntries : null;

  // One canonical source for the template too.
  const templateCode = canonicalIdentity
    ? canonicalIdentity.templateCode
    : deps.resolveTemplateCode(parsed.value.garmentType);

  const result = await createDraftMeasurement(
    {
      patientId: id,
      templateCode,
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
      // Surface template-resolution failures: a garment resolved to a
      // templateCode that has no active seeded template (e.g. mentonera-v1
      // not seeded). Without this the 503 is silent in production.
      console.error("[measurements:createDraft] active template not found", {
        patientId: id,
        garmentType: parsed.value.garmentType,
        templateCode,
      });
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
