export type PatientDetail = {
  id: string;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | Date | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type PatientFormState = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
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

export function executePatientSaveNavigation(router: NavigationRouter): void {
  router.refresh();
  router.push("/patients");
}

export function patientToFormState(patient: PatientDetail): PatientFormState {
  const birthDate = patient.birthDate ? new Date(patient.birthDate).toISOString().slice(0, 10) : "";

  return {
    fullName: patient.fullName,
    documentType: patient.documentType ?? "",
    documentNumber: patient.documentNumber ?? "",
    birthDate,
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    notes: patient.notes ?? "",
  };
}
