import { Prisma } from "@prisma/client";

import { syncCompressionTemplate } from "@/lib/measurement-templates";
import { getPrisma } from "@/lib/prisma";

import { DEMO_MARKER, resetDemoData } from "./reset-demo-data";

const PAYMENT_METHOD = {
  EFECTIVO: "EFECTIVO",
  TRANSFERENCIA: "TRANSFERENCIA",
  BOLD: "BOLD",
  TARJETA_DEBITO: "TARJETA_DEBITO",
  TARJETA_CREDITO: "TARJETA_CREDITO",
  OTRO: "OTRO",
} as const;

const PAYMENT_BANK = {
  BANCOLOMBIA: "BANCOLOMBIA",
  NEQUI: "NEQUI",
  DAVIPLATA: "DAVIPLATA",
  OTRO_BANCO: "OTRO_BANCO",
  OTRO: "OTRO",
} as const;

const PAYMENT_INCOME_TYPE = {
  PRIMERA_VEZ: "PRIMERA_VEZ",
  R: "R",
  MEFE: "MEFE",
  RECLAMADO_PRIMERA_VEZ: "RECLAMADO_PRIMERA_VEZ",
  RECLAMADO_R: "RECLAMADO_R",
} as const;

const OPERATION_STATUS = {
  PRESUPUESTO: "PRESUPUESTO",
  CONFIRMADO: "CONFIRMADO",
  EN_PRODUCCION: "EN_PRODUCCION",
  ENTREGADO: "ENTREGADO",
} as const;

const PATIENT_SEX = {
  FEMALE: "FEMALE",
  MALE: "MALE",
} as const;

type PaymentMethodValue = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
type PaymentBankValue = (typeof PAYMENT_BANK)[keyof typeof PAYMENT_BANK];
type PaymentIncomeTypeValue = (typeof PAYMENT_INCOME_TYPE)[keyof typeof PAYMENT_INCOME_TYPE];
type OperationStatusValue = (typeof OPERATION_STATUS)[keyof typeof OPERATION_STATUS];
type PatientSexValue = (typeof PATIENT_SEX)[keyof typeof PATIENT_SEX];

interface PatientSeed {
  documentType: string;
  documentNumber: string;
  fullName: string;
  sex: PatientSexValue;
  birthDate: string;
  phone: string;
  email: string;
  city: string;
}

interface OperationSeed {
  totalAmount: number;
  depositPaid: number;
  garmentType: string;
  status: OperationStatusValue;
  productCode: string;
  productType: string;
  orderNumber: string;
  invoiceNumber: string | null;
  orderedAt: string;
  exitDate: string | null;
  discount: number;
  paymentMethod: PaymentMethodValue;
  paymentBank: PaymentBankValue | null;
  incomeType: PaymentIncomeTypeValue;
}

interface GarmentSeed {
  garmentType: string;
  diagnosis: string;
  compressionClass: string;
  note: string;
}

const PATIENTS: ReadonlyArray<PatientSeed> = [
  { documentType: "CC", documentNumber: "1001001001", fullName: "María Fernanda Rojas Gómez", sex: PATIENT_SEX.FEMALE, birthDate: "1978-03-14", phone: "+57 300 111 2233", email: "maria.rojas.demo@example.com", city: "Bogotá" },
  { documentType: "CC", documentNumber: "1001001002", fullName: "Carlos Andrés Restrepo Vélez", sex: PATIENT_SEX.MALE, birthDate: "1969-08-02", phone: "+57 310 222 3344", email: "carlos.restrepo.demo@example.com", city: "Medellín" },
  { documentType: "CC", documentNumber: "1001001003", fullName: "Lina Marcela Torres Prieto", sex: PATIENT_SEX.FEMALE, birthDate: "1985-11-21", phone: "+57 315 333 4455", email: "lina.torres.demo@example.com", city: "Cali" },
  { documentType: "CC", documentNumber: "1001001004", fullName: "Jorge Iván Cárdenas Ruiz", sex: PATIENT_SEX.MALE, birthDate: "1958-05-30", phone: "+57 320 444 5566", email: "jorge.cardenas.demo@example.com", city: "Bucaramanga" },
  { documentType: "CC", documentNumber: "1001001005", fullName: "Paula Andrea Mendoza Salazar", sex: PATIENT_SEX.FEMALE, birthDate: "1991-01-09", phone: "+57 301 555 6677", email: "paula.mendoza.demo@example.com", city: "Barranquilla" },
  { documentType: "CC", documentNumber: "1001001006", fullName: "Santiago Herrera Castillo", sex: PATIENT_SEX.MALE, birthDate: "1974-09-18", phone: "+57 302 666 7788", email: "santiago.herrera.demo@example.com", city: "Pereira" },
  { documentType: "CC", documentNumber: "1001001007", fullName: "Claudia Patricia Morales Díaz", sex: PATIENT_SEX.FEMALE, birthDate: "1963-12-07", phone: "+57 304 777 8899", email: "claudia.morales.demo@example.com", city: "Manizales" },
  { documentType: "CC", documentNumber: "1001001008", fullName: "Diego Alejandro Suárez Peña", sex: PATIENT_SEX.MALE, birthDate: "1982-06-25", phone: "+57 305 888 9900", email: "diego.suarez.demo@example.com", city: "Cartagena" },
  { documentType: "CC", documentNumber: "1001001009", fullName: "Adriana Lucía Ospina Mejía", sex: PATIENT_SEX.FEMALE, birthDate: "1971-04-11", phone: "+57 311 999 0011", email: "adriana.ospina.demo@example.com", city: "Ibagué" },
  { documentType: "CC", documentNumber: "1001001010", fullName: "Felipe Enrique Navarro Acosta", sex: PATIENT_SEX.MALE, birthDate: "1994-10-28", phone: "+57 312 000 1122", email: "felipe.navarro.demo@example.com", city: "Cúcuta" },
] as const;

const GARMENTS: ReadonlyArray<GarmentSeed> = [
  { garmentType: "Media panty cintura alta", diagnosis: "Insuficiencia venosa crónica", compressionClass: "Clase II", note: "Toma completa bilateral de pierna." },
  { garmentType: "Media muslo con silicona", diagnosis: "Várices sintomáticas", compressionClass: "Clase II", note: "Priorizar ajuste proximal." },
  { garmentType: "Media rodilla", diagnosis: "Edema vespertino", compressionClass: "Clase I", note: "Uso diario laboral." },
  { garmentType: "Manga brazo derecho", diagnosis: "Linfedema miembro superior", compressionClass: "Clase II", note: "Control de perímetro en antebrazo." },
  { garmentType: "Manga brazo izquierdo con guante", diagnosis: "Postoperatorio oncológico", compressionClass: "Clase II", note: "Incluye mano y muñeca." },
  { garmentType: "Media maternidad", diagnosis: "Edema gestacional", compressionClass: "Clase I", note: "Medición conservadora para abdomen." },
  { garmentType: "Bota compresiva corta", diagnosis: "Úlcera venosa en manejo", compressionClass: "Clase III", note: "Revisión de tolerancia semanal." },
  { garmentType: "Pantorrillera deportiva", diagnosis: "Soporte muscular", compressionClass: "Clase I", note: "Paciente activo, medida unilateral comparativa." },
  { garmentType: "Media panty abierta", diagnosis: "Retorno venoso disminuido", compressionClass: "Clase II", note: "Punta abierta solicitada." },
  { garmentType: "Manga bilateral", diagnosis: "Linfedema bilateral leve", compressionClass: "Clase I", note: "Seguimiento trimestral." },
] as const;

const OPERATIONS: ReadonlyArray<OperationSeed> = [
  { totalAmount: 420000, depositPaid: 180000, garmentType: "Media panty cintura alta", status: OPERATION_STATUS.CONFIRMADO, productCode: "MSW-PANTY-ALTA", productType: "Custom compression", orderNumber: "DEMO-0001", invoiceNumber: "FV-DEMO-0001", orderedAt: "2026-06-10", exitDate: null, discount: 0, paymentMethod: PAYMENT_METHOD.EFECTIVO, paymentBank: null, incomeType: PAYMENT_INCOME_TYPE.PRIMERA_VEZ },
  { totalAmount: 360000, depositPaid: 160000, garmentType: "Media muslo con silicona", status: OPERATION_STATUS.EN_PRODUCCION, productCode: "MSW-MUSLO-SIL", productType: "Custom compression", orderNumber: "DEMO-0002", invoiceNumber: "FV-DEMO-0002", orderedAt: "2026-06-10", exitDate: null, discount: 10000, paymentMethod: PAYMENT_METHOD.TRANSFERENCIA, paymentBank: PAYMENT_BANK.BANCOLOMBIA, incomeType: PAYMENT_INCOME_TYPE.R },
  { totalAmount: 240000, depositPaid: 240000, garmentType: "Media rodilla", status: OPERATION_STATUS.ENTREGADO, productCode: "MSW-RODILLA", productType: "Standard compression", orderNumber: "DEMO-0003", invoiceNumber: "FV-DEMO-0003", orderedAt: "2026-06-10", exitDate: "2026-06-12", discount: 0, paymentMethod: PAYMENT_METHOD.BOLD, paymentBank: null, incomeType: PAYMENT_INCOME_TYPE.PRIMERA_VEZ },
  { totalAmount: 310000, depositPaid: 120000, garmentType: "Manga brazo derecho", status: OPERATION_STATUS.CONFIRMADO, productCode: "MSW-MANGA-DER", productType: "Upper limb compression", orderNumber: "DEMO-0004", invoiceNumber: null, orderedAt: "2026-06-11", exitDate: null, discount: 0, paymentMethod: PAYMENT_METHOD.EFECTIVO, paymentBank: null, incomeType: PAYMENT_INCOME_TYPE.MEFE },
  { totalAmount: 390000, depositPaid: 200000, garmentType: "Manga brazo izquierdo con guante", status: OPERATION_STATUS.EN_PRODUCCION, productCode: "MSW-MANGA-GUANTE", productType: "Upper limb compression", orderNumber: "DEMO-0005", invoiceNumber: "FV-DEMO-0005", orderedAt: "2026-06-11", exitDate: null, discount: 15000, paymentMethod: PAYMENT_METHOD.TARJETA_DEBITO, paymentBank: null, incomeType: PAYMENT_INCOME_TYPE.RECLAMADO_PRIMERA_VEZ },
  { totalAmount: 450000, depositPaid: 150000, garmentType: "Media maternidad", status: OPERATION_STATUS.PRESUPUESTO, productCode: "MSW-MATERNIDAD", productType: "Maternity compression", orderNumber: "DEMO-0006", invoiceNumber: null, orderedAt: "2026-06-11", exitDate: null, discount: 0, paymentMethod: PAYMENT_METHOD.TRANSFERENCIA, paymentBank: PAYMENT_BANK.NEQUI, incomeType: PAYMENT_INCOME_TYPE.PRIMERA_VEZ },
  { totalAmount: 520000, depositPaid: 260000, garmentType: "Bota compresiva corta", status: OPERATION_STATUS.CONFIRMADO, productCode: "MSW-BOTA-CORTA", productType: "Therapeutic compression", orderNumber: "DEMO-0007", invoiceNumber: "FV-DEMO-0007", orderedAt: "2026-06-12", exitDate: null, discount: 20000, paymentMethod: PAYMENT_METHOD.EFECTIVO, paymentBank: null, incomeType: PAYMENT_INCOME_TYPE.R },
  { totalAmount: 180000, depositPaid: 90000, garmentType: "Pantorrillera deportiva", status: OPERATION_STATUS.CONFIRMADO, productCode: "MSW-PANTORRILLERA", productType: "Sports compression", orderNumber: "DEMO-0008", invoiceNumber: "FV-DEMO-0008", orderedAt: "2026-06-12", exitDate: null, discount: 0, paymentMethod: PAYMENT_METHOD.TARJETA_CREDITO, paymentBank: null, incomeType: PAYMENT_INCOME_TYPE.PRIMERA_VEZ },
  { totalAmount: 430000, depositPaid: 430000, garmentType: "Media panty abierta", status: OPERATION_STATUS.ENTREGADO, productCode: "MSW-PANTY-ABIERTA", productType: "Custom compression", orderNumber: "DEMO-0009", invoiceNumber: "FV-DEMO-0009", orderedAt: "2026-06-12", exitDate: "2026-06-13", discount: 0, paymentMethod: PAYMENT_METHOD.TRANSFERENCIA, paymentBank: PAYMENT_BANK.DAVIPLATA, incomeType: PAYMENT_INCOME_TYPE.RECLAMADO_R },
  { totalAmount: 610000, depositPaid: 300000, garmentType: "Manga bilateral", status: OPERATION_STATUS.EN_PRODUCCION, productCode: "MSW-MANGA-BIL", productType: "Upper limb compression", orderNumber: "DEMO-0010", invoiceNumber: null, orderedAt: "2026-06-12", exitDate: null, discount: 25000, paymentMethod: PAYMENT_METHOD.EFECTIVO, paymentBank: null, incomeType: PAYMENT_INCOME_TYPE.MEFE },
] as const;

function atNoonUtc(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function paymentDate(index: number): Date {
  const day = index < 3 ? "2026-06-10" : index < 6 ? "2026-06-11" : "2026-06-12";
  return new Date(`${day}T${String(9 + (index % 8)).padStart(2, "0")}:30:00.000Z`);
}

function measurementValue(fieldKey: string, index: number): Prisma.Decimal {
  const pointMatch = /(?:leg|arm)(?:Right|Left)(\d+)/.exec(fieldKey);
  const point = pointMatch ? Number(pointMatch[1]) : 1;
  const isArm = fieldKey.startsWith("arm");
  const isLeft = fieldKey.includes("Left");
  const base = isArm ? 17.5 : 29.5;
  const sideAdjustment = isLeft ? 0.4 : 0;
  const patientAdjustment = index * 0.55;
  const taperAdjustment = isArm ? point * 0.42 : point * 0.68;
  return new Prisma.Decimal((base + sideAdjustment + patientAdjustment + taperAdjustment).toFixed(2));
}

async function main(): Promise<void> {
  const prisma = getPrisma();
  const reset = await resetDemoData({ fullReset: false, deleteUsers: false });
  const templateResult = await syncCompressionTemplate();
  const template = await prisma.measurementTemplate.findUniqueOrThrow({
    where: { id: templateResult.templateId },
    include: { sections: { include: { fields: true }, orderBy: { sortOrder: "asc" } } },
  });
  const fields = template.sections.flatMap((section) => section.fields).filter((field) => field.fieldType === "NUMBER");
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });

  let patients = 0;
  let sessions = 0;
  let values = 0;
  let operations = 0;
  let payments = 0;

  for (const [index, patientSeed] of PATIENTS.entries()) {
    const garment = GARMENTS[index];
    const operation = OPERATIONS[index];
    const patient = await prisma.patient.create({
      data: {
        documentType: patientSeed.documentType,
        documentNumber: patientSeed.documentNumber,
        fullName: patientSeed.fullName,
        sex: patientSeed.sex,
        birthDate: atNoonUtc(patientSeed.birthDate),
        phone: patientSeed.phone,
        email: patientSeed.email,
        notes: `${DEMO_MARKER} Demo patient from ${patientSeed.city}.`,
      },
      select: { id: true, fullName: true },
    });
    patients += 1;

    const session = await prisma.measurementSession.create({
      data: {
        patientId: patient.id,
        templateId: template.id,
        status: "COMPLETED",
        measuredAt: new Date(`2026-06-${String(10 + (index % 3)).padStart(2, "0")}T10:00:00.000Z`),
        notes: `${DEMO_MARKER} ${garment.note}`,
        diagnosis: garment.diagnosis,
        garmentType: garment.garmentType,
        compressionClass: garment.compressionClass,
        templateSnapshot: { templateCode: template.code, templateName: template.name, version: template.version, marker: DEMO_MARKER },
        productFlags: { demo: true, marker: DEMO_MARKER },
        metadata: { source: "demo-seed", marker: DEMO_MARKER },
      },
      select: { id: true },
    });
    sessions += 1;

    await prisma.measurementValue.createMany({
      data: fields.map((field) => ({
        sessionId: session.id,
        fieldId: field.id,
        valueNumber: measurementValue(field.key, index),
      })),
    });
    values += fields.length;

    const createdOperation = await prisma.commercialOperation.create({
      data: {
        patientId: patient.id,
        status: operation.status,
        totalAmount: new Prisma.Decimal(operation.totalAmount),
        depositPaid: new Prisma.Decimal(operation.depositPaid),
        garmentType: operation.garmentType,
        notes: `${DEMO_MARKER} Demo commercial operation for ${patient.fullName}.`,
        orderNumber: operation.orderNumber,
        orderedAt: atNoonUtc(operation.orderedAt),
        productCode: operation.productCode,
        productType: operation.productType,
        quantity: 1,
        invoiceNumber: operation.invoiceNumber,
        invoiceDate: operation.invoiceNumber ? atNoonUtc(operation.orderedAt) : null,
        discount: new Prisma.Decimal(operation.discount),
        exitDate: operation.exitDate ? atNoonUtc(operation.exitDate) : null,
      },
      select: { id: true },
    });
    operations += 1;

    await prisma.paymentMovement.create({
      data: {
        operationId: createdOperation.id,
        patientId: patient.id,
        amount: new Prisma.Decimal(operation.depositPaid),
        method: operation.paymentMethod,
        bank: operation.paymentBank,
        incomeType: operation.incomeType,
        paidAt: paymentDate(index),
        note: `${DEMO_MARKER} Initial demo deposit for ${operation.orderNumber}.`,
      },
    });
    payments += 1;

    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        action: "CREATE",
        entityType: "DemoPatient",
        entityId: patient.id,
        diff: { marker: DEMO_MARKER, seeded: true, patientName: patient.fullName } as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.expense.createMany({
    data: [
      { date: atNoonUtc("2026-06-10"), amount: new Prisma.Decimal(45000), concept: "Demo - Mensajería local", note: `${DEMO_MARKER} Delivery service for demo orders.` },
      { date: atNoonUtc("2026-06-11"), amount: new Prisma.Decimal(78000), concept: "Demo - Insumos de empaque", note: `${DEMO_MARKER} Packaging supplies.` },
      { date: atNoonUtc("2026-06-12"), amount: new Prisma.Decimal(56000), concept: "Demo - Transporte proveedor", note: `${DEMO_MARKER} Supplier transport.` },
    ],
  });

  await prisma.dailyCashCount.createMany({
    data: [
      { date: new Date("2026-06-10T00:00:00.000Z"), countedAmount: new Prisma.Decimal(420000), note: `${DEMO_MARKER} Demo counted cash for 2026-06-10.` },
      { date: new Date("2026-06-11T00:00:00.000Z"), countedAmount: new Prisma.Decimal(250000), note: `${DEMO_MARKER} Demo counted cash for 2026-06-11.` },
      { date: new Date("2026-06-12T00:00:00.000Z"), countedAmount: new Prisma.Decimal(590000), note: `${DEMO_MARKER} Demo counted cash for 2026-06-12.` },
    ],
  });

  console.log("[demo:seed] completed", {
    reset,
    templateId: template.id,
    numericFieldsPerSession: fields.length,
    patients,
    sessions,
    values,
    operations,
    payments,
    expenses: 3,
    dailyCashCounts: 3,
  });
}

main()
  .catch((error: unknown) => {
    console.error("[demo:seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
