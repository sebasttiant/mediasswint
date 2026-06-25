import { computeAge } from "@/lib/patient-age";

export type PatientDetail = {
  id: string;
  fullName: string;
  sex: string | null;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | Date | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type PatientMeasurementSummary = {
  id: string;
  status: string;
  measuredAt: string;
  garmentType: string | null;
  compressionClass: string | null;
  diagnosis: string | null;
};

export type PatientTimelineItem = {
  id: string;
  type: string;
  occurredAt: string;
  title: string;
  description: string | null;
  measurementId: string | null;
};

export type OperationSummary = {
  id: string;
  status: string;
  totalAmount: string | null;
  depositPaid: string;
  garmentType: string | null;
  notes: string | null;
  // Etapa E: order metadata (serialized; dates as ISO strings)
  orderNumber: string | null;
  orderedAt: string | null;
  productCode: string | null;
  productType: string | null;
  quantity: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  discount: string | null;
  exitDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientFormState = {
  fullName: string;
  sex: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  ageInput: string;
  ageTouched: boolean;
  address: string;
  phone: string;
  email: string;
  notes: string;
};

type NavigationRouter = {
  refresh: () => void;
  push: (href: string) => void;
};

export function buildPatientDetailHref(id: string): string {
  return `/patients/${encodeURIComponent(id)}`;
}

export function buildNewMeasurementHref(patientId: string): string {
  return `/patients/${encodeURIComponent(patientId)}/measurements/new`;
}

export function buildMeasurementDetailHref(patientId: string, sessionId: string): string {
  return `/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(sessionId)}`;
}

export function buildMeasurementEditHref(patientId: string, sessionId: string): string {
  return `/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(sessionId)}/edit`;
}

export function executePatientSaveNavigation(router: NavigationRouter): void {
  router.refresh();
  router.push("/patients");
}

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "CC", label: "CC - Cédula de Ciudadanía" },
  { value: "CE", label: "CE - Cédula de Extranjería" },
  { value: "TI", label: "TI - Tarjeta de Identidad" },
  { value: "Pasaporte", label: "Pasaporte" },
  { value: "NIT", label: "NIT" },
  { value: "Otro", label: "Otro" },
] as const;

export const PATIENT_SEX_OPTIONS = [
  { value: "FEMALE", label: "Femenino" },
  { value: "MALE", label: "Masculino" },
  { value: "OTHER", label: "Otro" },
] as const;

export function patientToFormState(patient: PatientDetail): PatientFormState {
  const birthDate = patient.birthDate ? new Date(patient.birthDate).toISOString().slice(0, 10) : "";
  const ageInput = birthDate ? String(computeAge(new Date(birthDate))) : "";

  return {
    fullName: patient.fullName,
    sex: patient.sex ?? "",
    documentType: patient.documentType ?? "",
    documentNumber: patient.documentNumber ?? "",
    birthDate,
    ageInput,
    ageTouched: false,
    address: patient.address ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    notes: patient.notes ?? "",
  };
}
