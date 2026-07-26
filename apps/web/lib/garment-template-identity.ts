import { getGarmentSnapshot } from "./garment-catalog";
import { resolveTemplateCode } from "./garment-template-resolver";

/**
 * Canonical, server-side garment identity.
 *
 * A measurement session's template snapshot IS its measurement schema. The
 * garment label is client input. If the two are allowed to drift apart, a
 * session can claim to be a Mentonera (3 measurements) while carrying the
 * Máscara schema (2 measurements) — a clinical record whose label and contents
 * contradict each other.
 *
 * Identity is therefore immutable across template boundaries after the draft
 * exists. Changes WITHIN one template are still allowed, because they cannot
 * create a disagreement: MA and MMA both resolve to `mascara-v1`, so switching
 * between them leaves the schema untouched.
 *
 * There is deliberately no re-template operation here. Moving a session to a
 * different garment would have to discard the measurements that do not exist in
 * the destination template; that is a clinical decision, not a side effect of a
 * PATCH.
 */

export type GarmentTemplateMismatch = {
  sessionTemplateCode: string;
  requestedTemplateCode: string;
  /** Which field carried the offending reference, for logging. */
  source: "garmentType" | "garmentSnapshot";
};

export type GarmentIdentityCheckInput = {
  /** The code of the session's persisted template snapshot. */
  sessionTemplateCode: string | null;
  /** `garmentType` as it arrived in the request, if present. */
  requestedGarmentType?: string | null | undefined;
  /** `metadata.garmentSnapshot.reference` as it arrived, if present. */
  requestedGarmentReference?: string | null | undefined;
};

function resolvesTo(reference: string | null | undefined): string | null {
  if (typeof reference !== "string") return null;
  const trimmed = reference.trim();
  if (trimmed === "") return null;
  // Unknown references deliberately resolve to the compression fallback rather
  // than to "no opinion" — an unknown reference on a head session is a real
  // mismatch and must be refused, not silently accepted.
  return resolveTemplateCode(trimmed);
}

/**
 * Returns the mismatch that must be refused, or null when the request is safe.
 *
 * A request that does not mention garment identity at all is always safe. A
 * session with no readable template snapshot has no identity to contradict, so
 * it is left to the snapshot-validation guards rather than reported here.
 */
export function findGarmentTemplateMismatch(
  input: GarmentIdentityCheckInput,
): GarmentTemplateMismatch | null {
  const sessionTemplateCode = input.sessionTemplateCode;
  if (!sessionTemplateCode) return null;

  const candidates: ReadonlyArray<{
    source: GarmentTemplateMismatch["source"];
    reference: string | null | undefined;
  }> = [
    { source: "garmentType", reference: input.requestedGarmentType },
    { source: "garmentSnapshot", reference: input.requestedGarmentReference },
  ];

  for (const candidate of candidates) {
    const requestedTemplateCode = resolvesTo(candidate.reference);
    if (requestedTemplateCode === null) continue;
    if (requestedTemplateCode === sessionTemplateCode) continue;
    return {
      sessionTemplateCode,
      requestedTemplateCode,
      source: candidate.source,
    };
  }

  return null;
}

/**
 * ONE canonical garment identity for a request.
 *
 * Comparing only the resolved TEMPLATE was insufficient. MA, MMA and ME are
 * three distinct catalog references; MA and MMA merely share the mascara-v1
 * measurement set. A payload could say `garmentType: "MA"` while carrying
 * `garmentSnapshot.reference: "MMA"` and pass a template-only check, persisting
 * a clinical record whose own identity fields contradict each other.
 *
 * So: the request may name the garment in more than one place, but every place
 * must name the SAME garment, and the display metadata that gets persisted is
 * always derived from the server catalog — never taken from the client.
 */
export type CanonicalGarmentIdentity = {
  reference: string;
  label: string;
  family: string;
  figureKey: string;
  templateCode: string;
};

export type CanonicalGarmentIdentityResult =
  | { ok: true; identity: CanonicalGarmentIdentity | null }
  | { ok: false; reason: "INCONSISTENT_REFERENCES" | "UNKNOWN_REFERENCE"; detail: string };

export type CanonicalGarmentIdentityInput = {
  garmentType?: string | null | undefined;
  garmentSnapshot?: Record<string, unknown> | null | undefined;
};

function normalizeReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function resolveCanonicalGarmentIdentity(
  input: CanonicalGarmentIdentityInput,
): CanonicalGarmentIdentityResult {
  const fromType = normalizeReference(input.garmentType);
  const fromSnapshot = normalizeReference(input.garmentSnapshot?.reference);

  if (fromType === null && fromSnapshot === null) {
    // The request does not touch garment identity at all.
    return { ok: true, identity: null };
  }

  const typeSnapshot = fromType === null ? null : getGarmentSnapshot(fromType);
  const metadataSnapshot = fromSnapshot === null ? null : getGarmentSnapshot(fromSnapshot);

  if (fromType !== null && typeSnapshot === null) {
    return { ok: false, reason: "UNKNOWN_REFERENCE", detail: fromType };
  }
  if (fromSnapshot !== null && metadataSnapshot === null) {
    return { ok: false, reason: "UNKNOWN_REFERENCE", detail: fromSnapshot };
  }

  if (
    typeSnapshot !== null &&
    metadataSnapshot !== null &&
    typeSnapshot.reference !== metadataSnapshot.reference
  ) {
    return {
      ok: false,
      reason: "INCONSISTENT_REFERENCES",
      detail: `garmentType=${typeSnapshot.reference} vs garmentSnapshot.reference=${metadataSnapshot.reference}`,
    };
  }

  const snapshot = typeSnapshot ?? metadataSnapshot;
  if (snapshot === null) return { ok: true, identity: null };

  return {
    ok: true,
    identity: {
      reference: snapshot.reference,
      label: snapshot.label,
      family: snapshot.family,
      figureKey: snapshot.figureKey,
      templateCode: resolveTemplateCode(snapshot.reference),
    },
  };
}
