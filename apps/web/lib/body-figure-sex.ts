export const BODY_FIGURE_SEX = {
  FEMALE: "female",
  MALE: "male",
} as const;

export type BodyFigureSex = (typeof BODY_FIGURE_SEX)[keyof typeof BODY_FIGURE_SEX];

export const PATIENT_SEX = {
  FEMALE: "FEMALE",
  MALE: "MALE",
} as const;

export type PatientSex = (typeof PATIENT_SEX)[keyof typeof PATIENT_SEX];

const MALE_VALUES = new Set(["MALE", "M", "MASCULINO", "HOMBRE", "MAN"]);
const FEMALE_VALUES = new Set(["FEMALE", "F", "FEMENINO", "MUJER", "WOMAN"]);

function normalizeSexValue(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function normalizePatientSex(value: string | null | undefined): PatientSex | null {
  const normalized = normalizeSexValue(value);
  if (!normalized) return null;
  if (MALE_VALUES.has(normalized)) return PATIENT_SEX.MALE;
  if (FEMALE_VALUES.has(normalized)) return PATIENT_SEX.FEMALE;
  return null;
}

export function resolveBodyFigureSex(value: string | null | undefined): BodyFigureSex {
  return normalizePatientSex(value) === PATIENT_SEX.MALE
    ? BODY_FIGURE_SEX.MALE
    : BODY_FIGURE_SEX.FEMALE;
}

export function getMeasurementSnapshotPatientSex(
  metadata: Record<string, unknown> | null | undefined,
): PatientSex | null {
  if (!metadata || typeof metadata.patientSex !== "string") return null;
  return normalizePatientSex(metadata.patientSex);
}

export function resolveMeasurementBodyFigureSex(
  metadata: Record<string, unknown> | null | undefined,
  currentPatientSex: string | null | undefined,
): BodyFigureSex {
  return resolveBodyFigureSex(getMeasurementSnapshotPatientSex(metadata) ?? currentPatientSex);
}
