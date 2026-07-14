import assert from "node:assert/strict";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { describe, it } from "node:test";

import { AppShell } from "../app/_components/app-shell/app-shell";
import {
  buildMeasurementDetailHref,
  buildMeasurementEditHref,
  buildNewMeasurementHref,
  buildPatientDetailHref,
  executePatientSaveNavigation,
  patientToFormState,
} from "../app/patients/[id]/patient-detail-helpers";
import {
  buildCreatePatientPayload,
  INITIAL_FORM_STATE,
  type PatientCreateFormState,
  type PatientCreatePayload,
} from "../app/patients/patient-create-helpers";
import {
  renderPatientsView,
  resolveInitialPatientQuery,
} from "../app/patients/patient-search-params";
import { PatientsPage } from "../app/patients/page";
import { HEALTH_INSURANCE_OTHER } from "../lib/health-insurance-catalog";

type PatientsViewProps = {
  actions?: ReactNode;
  currentPath: string;
  title: string;
  kicker: string;
  description: string;
  userLabel: string;
  children: ReactElement<{ initialQuery?: string }>;
};

const PatientsClientStub: ComponentType<{ initialQuery?: string }> = () => null;

function createFormState(overrides: Partial<PatientCreateFormState> = {}): PatientCreateFormState {
  return {
    ...INITIAL_FORM_STATE,
    fullName: "Ada Lovelace",
    ...overrides,
  };
}

function assertNoUiOnlyFields(payload: PatientCreatePayload): void {
  assert.equal("healthInsuranceCustom" in payload, false);
  assert.equal("ageInput" in payload, false);
  assert.equal("ageTouched" in payload, false);
}

function readPatientsViewProps(view: ReactElement): PatientsViewProps {
  return view.props as PatientsViewProps;
}

describe("patient detail client helpers", () => {
  it("seeds editable form state from initialPatient without requiring a client detail fetch", () => {
    const formState = patientToFormState({
      id: "pat-1",
      fullName: "Ada Lovelace",
      sex: "FEMALE",
      documentType: "DNI",
      documentNumber: "123",
      birthDate: "1815-12-10T00:00:00.000Z",
      address: null,
      healthInsurance: null,
      phone: null,
      email: "ada@example.com",
      notes: null,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    });

    assert.deepEqual(formState, {
      fullName: "Ada Lovelace",
      sex: "FEMALE",
      documentType: "DNI",
      documentNumber: "123",
      birthDate: "1815-12-10",
      ageInput: formState.ageInput, // computed from birthDate, value depends on current date
      ageTouched: false,
      address: "",
      healthInsurance: "",
      healthInsuranceCustom: "",
      phone: "",
      email: "ada@example.com",
      notes: "",
    });
  });

  it("builds list row/name navigation hrefs to patient detail", () => {
    assert.equal(buildPatientDetailHref("pat-123"), "/patients/pat-123");
    assert.equal(buildPatientDetailHref("pat with space"), "/patients/pat%20with%20space");
  });

  it("builds measurement navigation hrefs under the patient detail", () => {
    assert.equal(buildNewMeasurementHref("pat-123"), "/patients/pat-123/measurements/new");
    assert.equal(
      buildMeasurementDetailHref("pat with space", "sess/1"),
      "/patients/pat%20with%20space/measurements/sess%2F1",
    );
    assert.equal(
      buildMeasurementEditHref("pat with space", "sess/1"),
      "/patients/pat%20with%20space/measurements/sess%2F1/edit",
    );
  });

  it("refreshes the route cache before pushing back to patients after save", () => {
    const calls: string[] = [];

    executePatientSaveNavigation({
      refresh: () => calls.push("refresh"),
      push: (href) => calls.push(`push:${href}`),
    });

    assert.deepEqual(calls, ["refresh", "push:/patients"]);
  });
});

describe("patients search params helpers", () => {
  it("returns an empty string when the search param is missing or blank", () => {
    assert.equal(resolveInitialPatientQuery(undefined), "");
    assert.equal(resolveInitialPatientQuery(null), "");
    assert.equal(resolveInitialPatientQuery(""), "");
    assert.equal(resolveInitialPatientQuery("   "), "");
  });

  it("trims whitespace from a single search param value", () => {
    assert.equal(resolveInitialPatientQuery("ana"), "ana");
    assert.equal(resolveInitialPatientQuery("  ana  "), "ana");
  });

  it("uses the first non-empty entry when the param is repeated", () => {
    assert.equal(resolveInitialPatientQuery(["ana", "lovelace"]), "ana");
    assert.equal(resolveInitialPatientQuery(["", "  ana  "]), "ana");
    assert.equal(resolveInitialPatientQuery([]), "");
  });
});

describe("new patient create payload", () => {
  it("sends selected catalog EPS as healthInsurance and strips UI-only fields", () => {
    const payload = buildCreatePatientPayload(
      createFormState({
        healthInsurance: "Nueva EPS",
        healthInsuranceCustom: "Should not be sent",
        ageInput: "42",
        ageTouched: true,
        birthDate: "1984-01-24",
      }),
    );

    assert.equal(payload.healthInsurance, "Nueva EPS");
    assert.equal(payload.birthDate, "1984-01-24");
    assertNoUiOnlyFields(payload);
  });

  it("sends trimmed custom EPS text when Otra is selected", () => {
    const payload = buildCreatePatientPayload(
      createFormState({
        healthInsurance: HEALTH_INSURANCE_OTHER,
        healthInsuranceCustom: "  Custom EPS  ",
      }),
    );

    assert.equal(payload.healthInsurance, "Custom EPS");
    assertNoUiOnlyFields(payload);
  });

  it("sends null healthInsurance when EPS selection is empty", () => {
    const payload = buildCreatePatientPayload(createFormState({ healthInsurance: "" }));

    assert.equal(payload.healthInsurance, null);
    assertNoUiOnlyFields(payload);
  });

  it("successful create reset state clears both EPS fields", () => {
    assert.equal(INITIAL_FORM_STATE.healthInsurance, "");
    assert.equal(INITIAL_FORM_STATE.healthInsuranceCustom, "");
  });

  it("keeps exact birthDate precedence while stripping age UI fields", () => {
    const payload = buildCreatePatientPayload(
      createFormState({
        birthDate: "1990-03-15",
        ageInput: "20",
        ageTouched: true,
      }),
    );

    assert.equal(payload.birthDate, "1990-03-15");
    assertNoUiOnlyFields(payload);
  });

  it("still normalizes touched age to an approximate birthDate when exact birthDate is empty", () => {
    const age = 35;
    const now = new Date(Date.UTC(2026, 0, 1));
    const payload = buildCreatePatientPayload(
      createFormState({
        birthDate: "",
        ageInput: String(age),
        ageTouched: true,
      }),
      now,
    );

    assert.equal(payload.birthDate, "1991-07-01");
    assertNoUiOnlyFields(payload);
  });
});

describe("renderPatientsView composition", () => {
  it("wraps PatientsClient inside AppShell with patients context", () => {
    const view = renderPatientsView({
      user: { fullName: "Ada Lovelace" },
      initialQuery: "",
      PatientsClientComponent: PatientsClientStub,
    });

    assert.equal(view.type, AppShell);
    const props = readPatientsViewProps(view);
    assert.equal(props.currentPath, "/patients");
    assert.equal(props.title, "Pacientes");
    assert.equal(props.kicker, "MEDIASSWINT · Pacientes");
    assert.equal(props.description, "Alta, búsqueda y ficha clínica.");
    assert.equal(props.userLabel, "Bienvenido, Ada Lovelace");

    assert.equal(props.children.type, PatientsClientStub);
    assert.equal(props.children.props.initialQuery, "");
  });

  it("propagates initialQuery through to the inner client element", () => {
    const view = renderPatientsView({
      user: { fullName: null },
      initialQuery: "ana",
      PatientsClientComponent: PatientsClientStub,
    });

    const props = readPatientsViewProps(view);
    assert.equal(props.userLabel, "Bienvenido");
    assert.equal(props.children.props.initialQuery, "ana");
  });
});

describe("PatientsPage route", () => {
  it("renders PatientsClient inside AppShell after authenticating the user", async () => {
    const view = await PatientsPage(
      { searchParams: Promise.resolve({}) },
      {
        readUser: async () => ({ fullName: "Ada Lovelace" }),
        loadClient: async () => ({ default: PatientsClientStub }),
      },
    );

    assert.equal(view.type, AppShell);
    const props = readPatientsViewProps(view);
    assert.equal(props.currentPath, "/patients");
    assert.equal(props.title, "Pacientes");
    assert.equal(props.children.type, PatientsClientStub);
    assert.equal(props.children.props.initialQuery, "");
  });

  it("propagates ?q=... from searchParams to the PatientsClient initialQuery", async () => {
    const view = await PatientsPage(
      { searchParams: Promise.resolve({ q: "  ana  " }) },
      {
        readUser: async () => ({ fullName: "Ada Lovelace" }),
        loadClient: async () => ({ default: PatientsClientStub }),
      },
    );

    const props = readPatientsViewProps(view);
    assert.equal(props.children.type, PatientsClientStub);
    assert.equal(props.children.props.initialQuery, "ana");
  });

  it("uses the first non-empty entry when q is repeated in searchParams", async () => {
    const view = await PatientsPage(
      { searchParams: Promise.resolve({ q: ["", "ana"] }) },
      {
        readUser: async () => ({ fullName: "Ada Lovelace" }),
        loadClient: async () => ({ default: PatientsClientStub }),
      },
    );

    const props = readPatientsViewProps(view);
    assert.equal(props.children.props.initialQuery, "ana");
  });
});
