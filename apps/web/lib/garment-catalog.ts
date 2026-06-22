export const GARMENT_FIGURE_KEY = {
  FULL_BODY: "full-body",
  LOWER_LIMB: "lower-limb",
  UPPER_LIMB: "upper-limb",
  HEAD_OR_HAND: "head-or-hand",
  GENERIC: "generic",
} as const;

export type GarmentFigureKey = (typeof GARMENT_FIGURE_KEY)[keyof typeof GARMENT_FIGURE_KEY];

export interface GarmentOption {
  reference: string;
  label: string;
  family: string;
  figureKey: GarmentFigureKey;
}

export interface GarmentSnapshot {
  reference: string;
  label: string;
  family: string;
  figureKey: GarmentFigureKey;
}

const FAMILY = {
  LOWER_LIMB: "Lower limb",
  STUMP: "Stump garment",
  HEAD_OR_HAND: "Head or hand",
  FULL_BODY: "Full body",
  UPPER_LIMB: "Upper limb",
} as const;

function createOption(
  reference: string,
  label: string,
  family: string,
  figureKey: GarmentFigureKey,
): GarmentOption {
  return { reference, label, family, figureKey };
}

export const GARMENT_CATALOG: readonly GarmentOption[] = [
  createOption("MR", "Media a la Rodilla Par Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MRD", "Media a la Rodilla Derecha Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MRC", "Media Rodilla Cierre Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MRI", "Media a la Rodilla Izquierda Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MPD", "Media Pantalón Derecha Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MPI", "Media Pantalón Izquierda Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MP", "Media Pantalón Par Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MPE", "Media Pantalón Par Embarazo Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MPF", "Media Pantalón Estilo Faja", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MM", "Media al Muslo Par Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MMD", "Media al Muslo Derecha Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("MMI", "Media al Muslo Izquierda Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("BP", "Bermuda Ambas Piernas Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("BD", "Bermuda Pierna Derecha Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("BI", "Bermuda Pierna Izquierda Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("TP", "Tobillera Par Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("TD", "Tobillera Derecha Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("TI", "Tobillera Izquierda Adulto", FAMILY.LOWER_LIMB, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("ÑMD", "Funda Muñón Muslo Derecho Adulto", FAMILY.STUMP, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("ÑMI", "Funda Muñón Muslo Izquierdo Adulto", FAMILY.STUMP, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("ÑCD", "Funda Muñón Cintura Derecha Adulto", FAMILY.STUMP, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("ÑCI", "Funda Muñón Cintura Izquierda Adulto", FAMILY.STUMP, GARMENT_FIGURE_KEY.LOWER_LIMB),
  createOption("BA", "Balaca Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("MA", "Mascara Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("MMA", "Media Mascara Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("ME", "Mentonera Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("BO", "Body Adulto", FAMILY.FULL_BODY, GARMENT_FIGURE_KEY.FULL_BODY),
  createOption("CH", "Chaqueta Adulto", FAMILY.FULL_BODY, GARMENT_FIGURE_KEY.FULL_BODY),
  createOption("MLD", "Manopla Larga Derecha Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("MLI", "Manopla Larga Izquierda Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("MCD", "Manopla Corta Derecha Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("MCI", "Manopla Corta Izquierda Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("BLD", "Brazalete Largo Derecho Adulto", FAMILY.UPPER_LIMB, GARMENT_FIGURE_KEY.UPPER_LIMB),
  createOption("BLI", "Brazalete Largo Izquierdo Adulto", FAMILY.UPPER_LIMB, GARMENT_FIGURE_KEY.UPPER_LIMB),
  createOption("BCD", "Brazalete Corto Derecho Adulto", FAMILY.UPPER_LIMB, GARMENT_FIGURE_KEY.UPPER_LIMB),
  createOption("BCI", "Brazalete Corto Izquierdo Adulto", FAMILY.UPPER_LIMB, GARMENT_FIGURE_KEY.UPPER_LIMB),
  createOption("GLD", "Guante Largo Derecho Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("GLI", "Guante Largo Izquierdo Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("GCD", "Guante Corto Derecho Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("GCI", "Guante Corto Izquierdo Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
  createOption("ÑBD", "Funda Muñón Brazo Derecho Adulto", FAMILY.STUMP, GARMENT_FIGURE_KEY.UPPER_LIMB),
  createOption("ÑBI", "Funda Muñón Brazo Izquierdo Adulto", FAMILY.STUMP, GARMENT_FIGURE_KEY.UPPER_LIMB),
  createOption("DE", "Dedal Elástico Adulto", FAMILY.HEAD_OR_HAND, GARMENT_FIGURE_KEY.HEAD_OR_HAND),
];

const CATALOG_BY_REFERENCE = new Map(
  GARMENT_CATALOG.map((option) => [normalizeReference(option.reference), option]),
);

function normalizeReference(reference: string): string {
  return reference.trim().toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGarmentFigureKey(value: unknown): value is GarmentFigureKey {
  return Object.values(GARMENT_FIGURE_KEY).some((figureKey) => figureKey === value);
}

function parseGarmentSnapshot(value: unknown): GarmentSnapshot | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.reference !== "string" ||
    typeof value.label !== "string" ||
    typeof value.family !== "string" ||
    !isGarmentFigureKey(value.figureKey)
  ) {
    return null;
  }

  return {
    reference: value.reference,
    label: value.label,
    family: value.family,
    figureKey: value.figureKey,
  };
}

export function findGarmentOption(reference: string): GarmentOption | null {
  return CATALOG_BY_REFERENCE.get(normalizeReference(reference)) ?? null;
}

export function getGarmentSnapshot(reference: string): GarmentSnapshot | null {
  const option = findGarmentOption(reference);
  if (!option) return null;

  return {
    reference: option.reference,
    label: option.label,
    family: option.family,
    figureKey: option.figureKey,
  };
}

export function resolveGarmentDisplay(
  garmentType: string | null | undefined,
  metadata?: unknown,
): string {
  const snapshot = isRecord(metadata) ? parseGarmentSnapshot(metadata.garmentSnapshot) : null;
  if (snapshot) return `${snapshot.label} (${snapshot.reference})`;

  const normalizedGarmentType = garmentType?.trim();
  if (!normalizedGarmentType) return "";

  const option = findGarmentOption(normalizedGarmentType);
  if (option) return `${option.label} (${option.reference})`;

  return normalizedGarmentType;
}

export function resolveFigureHint(
  snapshot: GarmentSnapshot | null | undefined,
): GarmentFigureKey {
  return isRecord(snapshot) && isGarmentFigureKey(snapshot.figureKey)
    ? snapshot.figureKey
    : GARMENT_FIGURE_KEY.GENERIC;
}

/**
 * Resolves the value to pre-select in the garment selector when reloading a
 * saved draft or editing an existing measurement.
 *
 * Priority:
 *  1. snapshot reference from metadata.garmentSnapshot (most reliable)
 *  2. garmentType if it is a known catalog reference
 *  3. garmentType as-is (legacy free-text — rendered but not selectable)
 *  4. "" when no garment context exists
 */
export function resolveGarmentSelectValue(
  garmentType: string | null | undefined,
  metadata: unknown,
): string {
  if (isRecord(metadata)) {
    const snapshot = parseGarmentSnapshot(metadata.garmentSnapshot);
    if (snapshot) return snapshot.reference;
  }

  const trimmed = garmentType?.trim();
  if (!trimmed) return "";

  return trimmed;
}

/**
 * Builds a selectable fallback `<option>` descriptor for a legacy free-text
 * garment value that is not a known catalog reference, so editing an existing
 * measurement still shows and preserves the original garment text.
 *
 * Returns `null` when the value is empty or already a known catalog reference
 * (the catalog options already cover it).
 */
export function resolveLegacyGarmentSelectOption(
  garmentType: string | null | undefined,
): { value: string; label: string } | null {
  const trimmed = garmentType?.trim();
  if (!trimmed || findGarmentOption(trimmed)) return null;

  return { value: trimmed, label: `${trimmed} (texto libre anterior)` };
}

/**
 * Spec requires a garment type to be selected before a measurement can be
 * created. A valid selection is any non-empty value: a catalog reference from
 * the selector, or preserved legacy free-text when editing an old measurement.
 */
export function isGarmentSelectionValid(
  garmentType: string | null | undefined,
): boolean {
  return (garmentType?.trim().length ?? 0) > 0;
}
