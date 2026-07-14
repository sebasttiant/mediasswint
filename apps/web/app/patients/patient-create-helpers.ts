import { normalizeHealthInsuranceForPayload } from "@/lib/patient-health-insurance";
import { ageToApproxBirthDate, formatISODate } from "@/lib/patient-age";

export type PatientCreateFormState = {
  fullName: string;
  sex: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  ageInput: string;
  ageTouched: boolean;
  address: string;
  healthInsurance: string;
  healthInsuranceCustom: string;
  phone: string;
  email: string;
  notes: string;
};

export type PatientCreatePayload = Omit<
  PatientCreateFormState,
  "ageInput" | "ageTouched" | "healthInsurance" | "healthInsuranceCustom"
> & {
  healthInsurance: string | null;
};

export const INITIAL_FORM_STATE: PatientCreateFormState = {
  fullName: "",
  sex: "",
  documentType: "",
  documentNumber: "",
  birthDate: "",
  ageInput: "",
  ageTouched: false,
  address: "",
  healthInsurance: "",
  healthInsuranceCustom: "",
  phone: "",
  email: "",
  notes: "",
};

export function buildCreatePatientPayload(form: PatientCreateFormState, now?: Date): PatientCreatePayload {
  const { ageInput, ageTouched, healthInsuranceCustom, ...rest } = form;
  let outgoingBirthDate = rest.birthDate;
  if (!outgoingBirthDate && ageTouched && ageInput.trim() !== "" && !Number.isNaN(Number(ageInput))) {
    outgoingBirthDate = formatISODate(ageToApproxBirthDate(Number(ageInput), now));
  }

  return {
    ...rest,
    birthDate: outgoingBirthDate,
    healthInsurance: normalizeHealthInsuranceForPayload(rest.healthInsurance, healthInsuranceCustom),
  };
}
