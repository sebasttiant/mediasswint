import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPendingWork, fetchDashboardData, type DashboardData } from "../lib/dashboard";

function createMockRepository(overrides?: Partial<DashboardData>) {
  const defaults: DashboardData = {
    totalPatients: 42,
    patientsCreatedTodayCount: 3,
    activeOperationsCount: 7,
    openMeasurementDraftsCount: 2,
    completedMeasurementsTodayCount: 4,
    totalDeposits: "150000",
    totalPendingBalance: "350000",
    latestPatients: [
      {
        id: "pat_1",
        fullName: "Ada Lovelace",
        documentType: "DNI",
        documentNumber: "123",
        createdAt: new Date("2026-05-20T10:00:00Z"),
      },
    ],
    latestOperations: [
      {
        id: "op_1",
        status: "PRESUPUESTO",
        garmentType: "Media compresión",
        totalAmount: "200000",
        depositPaid: "50000",
        patientName: "Ada Lovelace",
        patientId: "pat_1",
        createdAt: new Date("2026-05-20T09:00:00Z"),
      },
    ],
    latestMeasurements: [
      {
        id: "measurement_1",
        status: "DRAFT",
        measuredAt: new Date("2026-05-20T11:00:00Z"),
        garmentType: "Media compresión",
        compressionClass: "Clase II",
        patientName: "Ada Lovelace",
        patientId: "pat_1",
      },
    ],
    pendingWork: {
      paymentFollowUpsCount: 1,
      productionFollowUpsCount: 0,
      draftMeasurementsCount: 1,
      items: [
        {
          id: "payment-op_1",
          kind: "PAYMENT",
          title: "Cobrar saldo: Ada Lovelace",
          description: "Pendiente 150000 · Media compresión. Abrir ficha del paciente para registrar seña o pago.",
          href: "/patients/pat_1",
          actionLabel: "Abrir paciente",
          createdAt: new Date("2026-05-20T09:00:00Z"),
        },
      ],
    },
  };

  const merged = { ...defaults, ...overrides };

  return {
    getTotalPatients: async () => merged.totalPatients,
    getPatientsCreatedToday: async () => merged.patientsCreatedTodayCount,
    getActiveOperationsCount: async () => merged.activeOperationsCount,
    getOpenMeasurementDraftsCount: async () => merged.openMeasurementDraftsCount,
    getCompletedMeasurementsTodayCount: async () => merged.completedMeasurementsTodayCount,
    getTotalDeposits: async () => merged.totalDeposits,
    getTotalPendingBalance: async () => merged.totalPendingBalance,
    getLatestPatients: async () => merged.latestPatients,
    getLatestOperations: async () => merged.latestOperations,
    getLatestMeasurements: async () => merged.latestMeasurements,
    getPendingWork: async () => merged.pendingWork,
  };
}

describe("fetchDashboardData", () => {
  it("returns all KPI metrics from repository", async () => {
    const repo = createMockRepository();
    const data = await fetchDashboardData(repo);

    assert.equal(data.totalPatients, 42);
    assert.equal(data.patientsCreatedTodayCount, 3);
    assert.equal(data.activeOperationsCount, 7);
    assert.equal(data.openMeasurementDraftsCount, 2);
    assert.equal(data.completedMeasurementsTodayCount, 4);
    assert.equal(data.totalDeposits, "150000");
    assert.equal(data.totalPendingBalance, "350000");
  });

  it("returns empty lists when no data exists", async () => {
    const repo = createMockRepository({
      totalPatients: 0,
      patientsCreatedTodayCount: 0,
      activeOperationsCount: 0,
      openMeasurementDraftsCount: 0,
      completedMeasurementsTodayCount: 0,
      totalDeposits: "0",
      totalPendingBalance: "0",
      latestPatients: [],
      latestOperations: [],
      latestMeasurements: [],
      pendingWork: {
        paymentFollowUpsCount: 0,
        productionFollowUpsCount: 0,
        draftMeasurementsCount: 0,
        items: [],
      },
    });

    const data = await fetchDashboardData(repo);

    assert.equal(data.totalPatients, 0);
    assert.equal(data.patientsCreatedTodayCount, 0);
    assert.equal(data.activeOperationsCount, 0);
    assert.equal(data.openMeasurementDraftsCount, 0);
    assert.equal(data.completedMeasurementsTodayCount, 0);
    assert.equal(data.totalDeposits, "0");
    assert.equal(data.totalPendingBalance, "0");
    assert.deepEqual(data.latestPatients, []);
    assert.deepEqual(data.latestOperations, []);
    assert.deepEqual(data.latestMeasurements, []);
    assert.deepEqual(data.pendingWork.items, []);
  });

  it("returns latest patients in descending order", async () => {
    const patients = [
      { id: "pat_2", fullName: "Grace Hopper", documentType: "CC", documentNumber: "456", createdAt: new Date("2026-05-20T12:00:00Z") },
      { id: "pat_1", fullName: "Ada Lovelace", documentType: "DNI", documentNumber: "123", createdAt: new Date("2026-05-20T10:00:00Z") },
    ];

    const repo = createMockRepository({ latestPatients: patients });
    const data = await fetchDashboardData(repo);

    assert.equal(data.latestPatients.length, 2);
    assert.equal(data.latestPatients[0]!.fullName, "Grace Hopper");
    assert.equal(data.latestPatients[1]!.fullName, "Ada Lovelace");
  });

  it("returns latest operations with patient info", async () => {
    const data = await fetchDashboardData(createMockRepository());

    assert.equal(data.latestOperations.length, 1);
    assert.equal(data.latestOperations[0]!.patientName, "Ada Lovelace");
    assert.equal(data.latestOperations[0]!.status, "PRESUPUESTO");
    assert.equal(data.latestOperations[0]!.totalAmount, "200000");
  });

  it("returns measurement KPI counts and latest measurements with patient info", async () => {
    const measurements = [
      {
        id: "measurement_2",
        status: "COMPLETED",
        measuredAt: new Date("2026-05-20T13:00:00Z"),
        garmentType: "Manga",
        compressionClass: "Clase I",
        patientName: "Grace Hopper",
        patientId: "pat_2",
      },
      {
        id: "measurement_1",
        status: "DRAFT",
        measuredAt: new Date("2026-05-20T11:00:00Z"),
        garmentType: "Media compresión",
        compressionClass: "Clase II",
        patientName: "Ada Lovelace",
        patientId: "pat_1",
      },
    ];

    const repo = createMockRepository({
      openMeasurementDraftsCount: 1,
      completedMeasurementsTodayCount: 1,
      latestMeasurements: measurements,
    });
    const data = await fetchDashboardData(repo);

    assert.equal(data.openMeasurementDraftsCount, 1);
    assert.equal(data.completedMeasurementsTodayCount, 1);
    assert.equal(data.latestMeasurements.length, 2);
    assert.equal(data.latestMeasurements[0]!.patientName, "Grace Hopper");
    assert.equal(data.latestMeasurements[0]!.status, "COMPLETED");
    assert.equal(data.latestMeasurements[1]!.status, "DRAFT");
  });

  it("returns pending work from repository", async () => {
    const data = await fetchDashboardData(createMockRepository());

    assert.equal(data.pendingWork.paymentFollowUpsCount, 1);
    assert.equal(data.pendingWork.productionFollowUpsCount, 0);
    assert.equal(data.pendingWork.draftMeasurementsCount, 1);
    assert.equal(data.pendingWork.items[0]!.href, "/patients/pat_1");
  });

  it("returns zero counts when repository returns edge values", async () => {
    const repo = createMockRepository({
      totalPatients: 0,
      patientsCreatedTodayCount: 0,
      activeOperationsCount: 0,
      openMeasurementDraftsCount: 0,
      completedMeasurementsTodayCount: 0,
      totalDeposits: "0",
      totalPendingBalance: "0",
    });

    const data = await fetchDashboardData(repo);

    assert.equal(data.totalPatients, 0);
    assert.equal(data.patientsCreatedTodayCount, 0);
    assert.equal(data.activeOperationsCount, 0);
    assert.equal(data.totalDeposits, "0");
    assert.equal(data.totalPendingBalance, "0");
  });

  it("handles large currency values correctly", async () => {
    const repo = createMockRepository({
      totalDeposits: "9999999.99",
      totalPendingBalance: "15000000.50",
    });

    const data = await fetchDashboardData(repo);

    assert.equal(data.totalDeposits, "9999999.99");
    assert.equal(data.totalPendingBalance, "15000000.50");
  });
});

describe("buildPendingWork", () => {
  it("derives payment, production, and measurement follow-ups from existing dashboard data", () => {
    const pendingWork = buildPendingWork(
      [
        {
          id: "op_1",
          status: "PRESUPUESTO",
          garmentType: "Media",
          totalAmount: "200000",
          depositPaid: "50000",
          patientName: "Ada Lovelace",
          patientId: "pat_1",
          createdAt: new Date("2026-05-20T10:00:00Z"),
        },
        {
          id: "op_2",
          status: "EN_PRODUCCION",
          garmentType: "Manga",
          totalAmount: "120000",
          depositPaid: "120000",
          patientName: "Grace Hopper",
          patientId: "pat_2",
          createdAt: new Date("2026-05-20T12:00:00Z"),
        },
        {
          id: "op_3",
          status: "ENTREGADO",
          garmentType: "Media",
          totalAmount: "90000",
          depositPaid: "90000",
          patientName: "Katherine Johnson",
          patientId: "pat_3",
          createdAt: new Date("2026-05-20T13:00:00Z"),
        },
      ],
      [
        {
          id: "measurement_1",
          status: "DRAFT",
          measuredAt: new Date("2026-05-20T11:00:00Z"),
          garmentType: "Media",
          compressionClass: "Clase II",
          patientName: "Ada Lovelace",
          patientId: "pat_1",
        },
      ],
      6,
    );

    assert.equal(pendingWork.paymentFollowUpsCount, 1);
    assert.equal(pendingWork.productionFollowUpsCount, 1);
    assert.equal(pendingWork.draftMeasurementsCount, 1);
    assert.deepEqual(
      pendingWork.items.map((item) => item.id),
      ["production-op_2", "measurement-measurement_1", "payment-op_1"],
    );
    const measurementItem = pendingWork.items.find((item) => item.id === "measurement-measurement_1");
    assert.equal(measurementItem?.href, "/patients/pat_1/measurements/measurement_1/edit");
  });

  it("does not flag cancelled, delivered, or fully paid operations as pending", () => {
    const pendingWork = buildPendingWork(
      [
        {
          id: "op_cancelled",
          status: "CANCELADO",
          garmentType: null,
          totalAmount: "100000",
          depositPaid: "0",
          patientName: "Ada Lovelace",
          patientId: "pat_1",
          createdAt: new Date("2026-05-20T10:00:00Z"),
        },
        {
          id: "op_delivered",
          status: "ENTREGADO",
          garmentType: null,
          totalAmount: "100000",
          depositPaid: "100000",
          patientName: "Grace Hopper",
          patientId: "pat_2",
          createdAt: new Date("2026-05-20T11:00:00Z"),
        },
      ],
      [],
      6,
    );

    assert.equal(pendingWork.paymentFollowUpsCount, 0);
    assert.equal(pendingWork.productionFollowUpsCount, 0);
    assert.equal(pendingWork.draftMeasurementsCount, 0);
    assert.deepEqual(pendingWork.items, []);
  });
});
