import assert from "node:assert/strict";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { describe, it } from "node:test";
import type { Patient } from "@prisma/client";

import { AppShell } from "../app/_components/app-shell/app-shell";
import type {
  OperationSummary,
  PatientDetail,
  PatientMeasurementSummary,
  PatientTimelineItem,
} from "../app/patients/[id]/patient-detail-helpers";
import { resolvePatientDetailLoad } from "../app/patients/[id]/patient-detail-loading";
import {
  buildMeasurementsSectionViewModel,
  PATIENT_DETAIL_SECTIONS,
  renderPatientDetailView,
} from "../app/patients/[id]/patient-detail-view";
import { PatientDetailPage } from "../app/patients/[id]/page";

type PatientDetailClientProps = {
  initialPatient: PatientDetail;
  recentMeasurements: PatientMeasurementSummary[];
  timeline: PatientTimelineItem[];
  operations: OperationSummary[];
};

type PatientDetailViewProps = {
  actions?: ReactNode;
  currentPath: string;
  title: string;
  kicker: string;
  description: string;
  userLabel: string;
  children: ReactElement<PatientDetailClientProps>;
};

const PatientDetailClientStub: ComponentType<PatientDetailClientProps> = () => null;

function readPatientDetailViewProps(view: ReactElement): PatientDetailViewProps {
  return view.props as PatientDetailViewProps;
}

function patientFixture(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "pat-1",
    fullName: "Ada Lovelace",
    sex: null,
    documentType: "DNI",
    documentNumber: "123",
    birthDate: null,
    address: null,
    healthInsurance: null,
    phone: null,
    email: null,
    notes: null,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

function measurementFixture(
  overrides: Partial<PatientMeasurementSummary> = {},
): PatientMeasurementSummary {
  return {
    id: "m-1",
    status: "COMPLETED",
    measuredAt: "2026-02-01T12:00:00.000Z",
    garmentType: "Media compresión",
    compressionClass: "II",
    diagnosis: "Lipedema",
    ...overrides,
  };
}

describe("resolvePatientDetailLoad", () => {
  it("requires login when no active user exists", () => {
    assert.deepEqual(resolvePatientDetailLoad(null, { ok: true, value: patientFixture() }), {
      action: "redirect",
      location: "/login",
    });
  });

  it("returns initial patient for active STAFF users", () => {
    const patient = patientFixture({ id: "pat-2", fullName: "Grace Hopper" });

    assert.deepEqual(resolvePatientDetailLoad({ id: "staff-1", role: "STAFF" }, { ok: true, value: patient }), {
      action: "render",
      patient,
    });
  });

  it("maps missing patient result to notFound", () => {
    assert.deepEqual(resolvePatientDetailLoad({ id: "staff-1", role: "STAFF" }, { ok: false, error: "NOT_FOUND" }), {
      action: "notFound",
    });
  });

  it("maps unknown lookup failures to throw", () => {
    assert.deepEqual(resolvePatientDetailLoad({ id: "staff-1", role: "STAFF" }, { ok: false, error: "UNKNOWN" }), {
      action: "throw",
    });
  });
});

describe("PATIENT_DETAIL_SECTIONS", () => {
  it("declares clinical, commercial and measurements groupings in stable order", () => {
    assert.deepEqual(
      PATIENT_DETAIL_SECTIONS.map((section) => section.key),
      ["demographics", "clinical", "commercial", "measurements"],
    );
  });

  it("exposes a Spanish label for every section", () => {
    const labels = PATIENT_DETAIL_SECTIONS.map((section) => section.label);
    assert.ok(labels.includes("Datos demográficos"));
    assert.ok(labels.includes("Historia clínica"));
    assert.ok(labels.includes("Operaciones comerciales"));
    assert.ok(labels.includes("Mediciones"));
  });

  it("uses 'Mediciones' (not 'Medidas') as the measurements section label", () => {
    const measurements = PATIENT_DETAIL_SECTIONS.find((section) => section.key === "measurements");
    assert.ok(measurements, "measurements section must be declared");
    assert.equal(measurements!.label, "Mediciones");
  });
});

describe("buildMeasurementsSectionViewModel", () => {
  it("returns the empty kind with a Spanish message when no measurements exist", () => {
    const viewModel = buildMeasurementsSectionViewModel({
      recentMeasurements: [],
      patientId: "pat-1",
    });

    assert.equal(viewModel.kind, "empty");
    if (viewModel.kind === "empty") {
      assert.equal(viewModel.message, "Todavía no hay mediciones cargadas.");
    }
  });

  it("routes draft rows to edit and completed rows to detail", () => {
    const viewModel = buildMeasurementsSectionViewModel({
      recentMeasurements: [
        measurementFixture({ id: "m-1", status: "DRAFT" }),
        measurementFixture({ id: "m-2", status: "COMPLETED" }),
      ],
      patientId: "pat-1",
    });

    assert.equal(viewModel.kind, "list");
    if (viewModel.kind === "list") {
      assert.equal(viewModel.rows.length, 2);
      assert.equal(viewModel.rows[0]!.href, "/patients/pat-1/measurements/m-1/edit");
      assert.equal(viewModel.rows[1]!.href, "/patients/pat-1/measurements/m-2");
    }
  });

  it("encodes both ids when building the detail href", () => {
    const viewModel = buildMeasurementsSectionViewModel({
      recentMeasurements: [measurementFixture({ id: "m/1" })],
      patientId: "pat/1",
    });

    assert.equal(viewModel.kind, "list");
    if (viewModel.kind === "list") {
      assert.equal(viewModel.rows[0]!.href, "/patients/pat%2F1/measurements/m%2F1");
    }
  });
});

describe("renderPatientDetailView composition", () => {
  it("wraps PatientDetailClient inside AppShell with patient context", () => {
    const patient = patientFixture();
    const view = renderPatientDetailView({
      user: { fullName: "Ada Lovelace" },
      patient,
      recentMeasurements: [],
      timeline: [],
      operations: [],
      PatientDetailClientComponent: PatientDetailClientStub,
    });

    assert.equal(view.type, AppShell);
    const props = readPatientDetailViewProps(view);
    assert.equal(props.currentPath, "/patients/pat-1");
    assert.equal(props.title, "Ada Lovelace");
    assert.equal(props.kicker, "MEDIASSWINT · Ficha de paciente");
    assert.equal(props.userLabel, "Bienvenido, Ada Lovelace");
    assert.ok(props.description.includes("Datos demográficos"));
    assert.ok(props.description.includes("Historia clínica"));
    assert.ok(props.description.includes("Operaciones comerciales"));
    assert.ok(props.description.includes("Mediciones"));

    assert.equal(props.children.type, PatientDetailClientStub);
    assert.equal(props.children.props.initialPatient, patient);
    assert.equal(props.children.props.recentMeasurements.length, 0);
  });

  it("propagates timeline, operations and recent measurements to the client", () => {
    const patient = patientFixture({ id: "pat-9", fullName: "Grace Hopper" });
    const measurements = [measurementFixture()];
    const timeline: PatientTimelineItem[] = [
      {
        id: "t-1",
        type: "MEASUREMENT_CREATED",
        occurredAt: "2026-02-01T12:00:00.000Z",
        title: "Medición creada",
        description: null,
        measurementId: "m-1",
      },
    ];
    const operations: OperationSummary[] = [
      {
        id: "op-1",
        status: "PRESUPUESTO",
        totalAmount: "100000",
        depositPaid: "0",
        garmentType: "Media",
        notes: null,
        orderNumber: null,
        orderedAt: null,
        productCode: null,
        productType: null,
        quantity: null,
        invoiceNumber: null,
        invoiceDate: null,
        discount: null,
        exitDate: null,
        createdAt: "2026-02-01T12:00:00.000Z",
        updatedAt: "2026-02-01T12:00:00.000Z",
      },
    ];

    const view = renderPatientDetailView({
      user: { fullName: null },
      patient,
      recentMeasurements: measurements,
      timeline,
      operations,
      PatientDetailClientComponent: PatientDetailClientStub,
    });

    const props = readPatientDetailViewProps(view);
    assert.equal(props.currentPath, "/patients/pat-9");
    assert.equal(props.title, "Grace Hopper");
    assert.equal(props.userLabel, "Bienvenido");
    assert.equal(props.children.props.recentMeasurements, measurements);
    assert.equal(props.children.props.timeline, timeline);
    assert.equal(props.children.props.operations, operations);
  });
});

describe("PatientDetailPage route", () => {
  function defaultDeps(overrides: Record<string, unknown> = {}) {
    return {
      readUser: async () => ({ id: "user-1", role: "STAFF", fullName: "Ada Lovelace" }),
      loadClient: async () => ({ default: PatientDetailClientStub }),
      resolveData: async (id: string) => ({
        action: "render" as const,
        data: {
          patient: { ...patientFixture({ id }) } as PatientDetail,
          recentMeasurements: [] as PatientMeasurementSummary[],
          timeline: [] as PatientTimelineItem[],
          operations: [] as OperationSummary[],
        },
      }),
      ...overrides,
    };
  }

  it("renders PatientDetailClient inside AppShell after authenticating the user", async () => {
    const view = await PatientDetailPage(
      { params: Promise.resolve({ id: "pat-1" }) },
      defaultDeps(),
    );

    assert.equal(view.type, AppShell);
    const props = readPatientDetailViewProps(view);
    assert.equal(props.currentPath, "/patients/pat-1");
    assert.equal(props.children.type, PatientDetailClientStub);
  });

  it("propagates an empty measurement list through to the PatientDetailClient", async () => {
    const view = await PatientDetailPage(
      { params: Promise.resolve({ id: "pat-1" }) },
      defaultDeps(),
    );

    const props = readPatientDetailViewProps(view);
    assert.equal(props.children.props.recentMeasurements.length, 0);
  });

  it("propagates timeline and operations resolved by the data loader", async () => {
    const measurements = [measurementFixture()];
    const timeline: PatientTimelineItem[] = [
      {
        id: "t-1",
        type: "PATIENT_CREATED",
        occurredAt: "2026-01-01T10:00:00.000Z",
        title: "Paciente creado",
        description: null,
        measurementId: null,
      },
    ];
    const operations: OperationSummary[] = [
      {
        id: "op-1",
        status: "PRESUPUESTO",
        totalAmount: null,
        depositPaid: "0",
        garmentType: null,
        notes: null,
        orderNumber: null,
        orderedAt: null,
        productCode: null,
        productType: null,
        quantity: null,
        invoiceNumber: null,
        invoiceDate: null,
        discount: null,
        exitDate: null,
        createdAt: "2026-02-01T12:00:00.000Z",
        updatedAt: "2026-02-01T12:00:00.000Z",
      },
    ];

    const view = await PatientDetailPage(
      { params: Promise.resolve({ id: "pat-1" }) },
      defaultDeps({
        resolveData: async (id: string) => ({
          action: "render" as const,
          data: {
            patient: { ...patientFixture({ id }) } as PatientDetail,
            recentMeasurements: measurements,
            timeline,
            operations,
          },
        }),
      }),
    );

    const props = readPatientDetailViewProps(view);
    assert.equal(props.children.props.timeline, timeline);
    assert.equal(props.children.props.operations, operations);
    assert.equal(props.children.props.recentMeasurements, measurements);
  });
});
