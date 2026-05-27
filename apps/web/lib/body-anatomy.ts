// Whole-body anatomy taxonomy derived from the clinical PDF
// "FORMATO TOMA DE MEDIDAS — SOPORTES ELASTICOS COMPRESIVOS".
//
// Four-layer model:
//  1. AnatomicalRegion       — visual regions on the body map
//  2. measurementCapable     — regions the PDF prescribes measurements for
//  3. implementedFieldKeys   — fields currently wired to persisted data
//  4. PDF_MEASUREMENT_FIELDS — every measurement-capable field on the PDF,
//                              with status flag so the UI can mark pending
//
// The existing `compression-measurements.ts` catalog (arm 1-19 × 2,
// leg 1-28 × 2) is the source of truth for persisted measurements and is
// referenced here without mutation. Anything not in that catalog is `pending`
// and rendered as visual reference until backed by storage.

import {
  COMPRESSION_MEASUREMENTS,
  type CompressionMeasurementKey,
} from "./compression-measurements";

export const ANATOMICAL_REGIONS = [
  "head",
  "neck",
  "torso",
  "arms",
  "hands",
  "legs",
  "feet",
] as const;

export type AnatomicalRegion = (typeof ANATOMICAL_REGIONS)[number];

export type MeasurementFieldStatus = "implemented" | "pending";

export type MeasurementFieldKind =
  | "perimeter"
  | "length"
  | "circumference"
  | "product"
  | "flag";

export type PdfMeasurementField = {
  readonly key: string;
  readonly label: string;
  readonly region: AnatomicalRegion;
  readonly side?: "right" | "left" | "bilateral";
  readonly kind: MeasurementFieldKind;
  readonly unit?: "cm" | "n/a";
  readonly status: MeasurementFieldStatus;
  readonly pdfSection: string;
};

// Build the set of currently-implemented keys from the existing catalog
// without inventing new ids. This keeps the source of truth in one place.
const IMPLEMENTED_KEYS: ReadonlySet<CompressionMeasurementKey> = new Set(
  COMPRESSION_MEASUREMENTS.map((m) => m.key),
);

function pendingField(field: Omit<PdfMeasurementField, "status">): PdfMeasurementField {
  return { ...field, status: "pending" };
}

// Whole-body field catalog from the PDF.
// `implemented` entries for arms/legs are NOT enumerated here — they live in
// COMPRESSION_MEASUREMENTS. This list captures everything the PDF asks for
// that is NOT yet wired to storage.
export const PDF_PENDING_FIELDS: ReadonlyArray<PdfMeasurementField> = [
  // HEAD ----------------------------------------------------------------
  pendingField({
    key: "perimetroCefalico",
    label: "Perímetro cefálico",
    region: "head",
    kind: "perimeter",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "perimetroMentonera",
    label: "Perímetro mentonera",
    region: "head",
    kind: "perimeter",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "frente",
    label: "Frente",
    region: "head",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "frenteMenton",
    label: "Frente mentón",
    region: "head",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),

  // NECK ----------------------------------------------------------------
  pendingField({
    key: "cuelloMenton",
    label: "Cuello mentón",
    region: "neck",
    kind: "circumference",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "cuelloToracico",
    label: "Cuello torácico",
    region: "neck",
    kind: "circumference",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),

  // TORSO ---------------------------------------------------------------
  pendingField({
    key: "medioGrueso",
    label: "Medio grueso",
    region: "torso",
    kind: "circumference",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "cintura",
    label: "Cintura",
    region: "torso",
    kind: "circumference",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "cadera",
    label: "Cadera",
    region: "torso",
    kind: "circumference",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "copa",
    label: "Copa",
    region: "torso",
    kind: "circumference",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "largoChaqueta",
    label: "Largo chaqueta",
    region: "torso",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "largoPantalon",
    label: "Largo pantalón",
    region: "torso",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "largoBody",
    label: "Largo body",
    region: "torso",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "usaPanal",
    label: "Usa pañal",
    region: "torso",
    kind: "flag",
    unit: "n/a",
    pdfSection: "Medidas mayores",
  }),

  // ARMS (extra) — point-by-point arm catalog already implemented in
  // COMPRESSION_MEASUREMENTS (arms 1..19 per side). Manga length is extra.
  pendingField({
    key: "largoMangaDer",
    label: "Largo manga (D)",
    region: "arms",
    side: "right",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "largoMangaIzq",
    label: "Largo manga (I)",
    region: "arms",
    side: "left",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),

  // HANDS ---------------------------------------------------------------
  pendingField({
    key: "guanteCortoDer",
    label: "Guante corto (D)",
    region: "hands",
    side: "right",
    kind: "product",
    pdfSection: "Producto",
  }),
  pendingField({
    key: "guanteCortoIzq",
    label: "Guante corto (I)",
    region: "hands",
    side: "left",
    kind: "product",
    pdfSection: "Producto",
  }),
  pendingField({
    key: "guanteLargoDer",
    label: "Guante largo (D)",
    region: "hands",
    side: "right",
    kind: "product",
    pdfSection: "Producto",
  }),
  pendingField({
    key: "guanteLargoIzq",
    label: "Guante largo (I)",
    region: "hands",
    side: "left",
    kind: "product",
    pdfSection: "Producto",
  }),
  pendingField({
    key: "dedal",
    label: "Dedal",
    region: "hands",
    side: "bilateral",
    kind: "product",
    pdfSection: "Producto",
  }),
  pendingField({
    key: "munonMano",
    label: "Muñón",
    region: "hands",
    side: "bilateral",
    kind: "product",
    pdfSection: "Producto",
  }),

  // LEGS (extra) — point-by-point catalog already implemented; length extra.
  pendingField({
    key: "largoPiernaDer",
    label: "Largo de pierna (D)",
    region: "legs",
    side: "right",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "largoPiernaIzq",
    label: "Largo de pierna (I)",
    region: "legs",
    side: "left",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),

  // FEET ----------------------------------------------------------------
  pendingField({
    key: "calzado",
    label: "Calzado",
    region: "feet",
    side: "bilateral",
    kind: "length",
    unit: "cm",
    pdfSection: "Medidas mayores",
  }),
  pendingField({
    key: "tobilleraCortaDer",
    label: "Tobillera corta (D)",
    region: "feet",
    side: "right",
    kind: "product",
    pdfSection: "Producto",
  }),
  pendingField({
    key: "tobilleraCortaIzq",
    label: "Tobillera corta (I)",
    region: "feet",
    side: "left",
    kind: "product",
    pdfSection: "Producto",
  }),
  pendingField({
    key: "tobilleraLargaDer",
    label: "Tobillera larga (D)",
    region: "feet",
    side: "right",
    kind: "product",
    pdfSection: "Producto",
  }),
  pendingField({
    key: "tobilleraLargaIzq",
    label: "Tobillera larga (I)",
    region: "feet",
    side: "left",
    kind: "product",
    pdfSection: "Producto",
  }),
];

export type RegionStatus = "implemented" | "partial" | "pending";

export type RegionSummary = {
  readonly region: AnatomicalRegion;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly status: RegionStatus;
  readonly implementedCount: number;
  readonly pendingCount: number;
  readonly hasDetailView: boolean;
};

const REGION_LABELS: Record<AnatomicalRegion, { label: string; short: string; description: string }> = {
  head: {
    label: "Cabeza",
    short: "Cabeza",
    description: "Perímetro cefálico, frente y mentonera",
  },
  neck: {
    label: "Cuello",
    short: "Cuello",
    description: "Cuello mentón y cuello torácico",
  },
  torso: {
    label: "Tronco",
    short: "Tronco",
    description: "Cintura, cadera, copa y largos",
  },
  arms: {
    label: "Brazos",
    short: "Brazos",
    description: "19 puntos por lado y largo de manga",
  },
  hands: {
    label: "Manos",
    short: "Manos",
    description: "Guantes, dedal y muñón",
  },
  legs: {
    label: "Piernas",
    short: "Piernas",
    description: "28 puntos por lado y largo de pierna",
  },
  feet: {
    label: "Pies",
    short: "Pies",
    description: "Calzado y tobilleras",
  },
};

// Regions that have a dedicated detail asset in this iteration.
// Others will fall through to the full-body view and a side panel.
const DETAIL_VIEW_REGIONS: ReadonlySet<AnatomicalRegion> = new Set([
  "head",
  "hands",
] satisfies AnatomicalRegion[]);

function countImplementedForRegion(region: AnatomicalRegion): number {
  if (region === "arms") {
    return COMPRESSION_MEASUREMENTS.filter((m) => m.group === "arms").length;
  }
  if (region === "legs") {
    return COMPRESSION_MEASUREMENTS.filter((m) => m.group === "legs").length;
  }
  return 0;
}

function countPendingForRegion(region: AnatomicalRegion): number {
  return PDF_PENDING_FIELDS.filter((field) => field.region === region).length;
}

function resolveStatus(implementedCount: number, pendingCount: number): RegionStatus {
  if (pendingCount === 0 && implementedCount > 0) return "implemented";
  if (implementedCount > 0 && pendingCount > 0) return "partial";
  return "pending";
}

export const ANATOMICAL_REGION_SUMMARY: ReadonlyArray<RegionSummary> = ANATOMICAL_REGIONS.map(
  (region) => {
    const implementedCount = countImplementedForRegion(region);
    const pendingCount = countPendingForRegion(region);
    return {
      region,
      label: REGION_LABELS[region].label,
      shortLabel: REGION_LABELS[region].short,
      description: REGION_LABELS[region].description,
      status: resolveStatus(implementedCount, pendingCount),
      implementedCount,
      pendingCount,
      hasDetailView: DETAIL_VIEW_REGIONS.has(region),
    };
  },
);

export function findRegionSummary(region: AnatomicalRegion): RegionSummary {
  // Safe: ANATOMICAL_REGION_SUMMARY is built from ANATOMICAL_REGIONS in order.
  return ANATOMICAL_REGION_SUMMARY.find((r) => r.region === region) ?? {
    region,
    label: REGION_LABELS[region].label,
    shortLabel: REGION_LABELS[region].short,
    description: REGION_LABELS[region].description,
    status: "pending",
    implementedCount: 0,
    pendingCount: 0,
    hasDetailView: DETAIL_VIEW_REGIONS.has(region),
  };
}

export function getPendingFieldsForRegion(region: AnatomicalRegion): ReadonlyArray<PdfMeasurementField> {
  return PDF_PENDING_FIELDS.filter((field) => field.region === region);
}

export function isFieldImplemented(key: string): boolean {
  return IMPLEMENTED_KEYS.has(key as CompressionMeasurementKey);
}

export function hasDetailView(region: AnatomicalRegion): boolean {
  return DETAIL_VIEW_REGIONS.has(region);
}
