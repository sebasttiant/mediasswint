import { COLOMBIA_HEALTH_INSURERS, HEALTH_INSURANCE_OTHER } from "@/lib/health-insurance-catalog";

export type HealthInsuranceFormValues = {
  healthInsurance: string;
  healthInsuranceCustom: string;
};

// Derive healthInsurance select value and custom text from the stored value.
// If the stored value is a known EPS, pre-select it. Otherwise select "Otra"
// and prefill the free-text with the stored custom value.
export function resolveHealthInsuranceFormValues(stored: string | null): HealthInsuranceFormValues {
  if (!stored) return { healthInsurance: "", healthInsuranceCustom: "" };
  if ((COLOMBIA_HEALTH_INSURERS as readonly string[]).includes(stored)) {
    return { healthInsurance: stored, healthInsuranceCustom: "" };
  }
  return { healthInsurance: HEALTH_INSURANCE_OTHER, healthInsuranceCustom: stored };
}

export function normalizeHealthInsuranceForPayload(
  healthInsurance: string,
  healthInsuranceCustom: string,
): string | null {
  return healthInsurance === HEALTH_INSURANCE_OTHER
    ? healthInsuranceCustom.trim() || null
    : healthInsurance || null;
}
