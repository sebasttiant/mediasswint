/**
 * B4 — absent vs malformed persisted snapshots, through the REAL repository.
 *
 * The service has a MALFORMED_TEMPLATE_SNAPSHOT branch, but the default
 * repository parsed the Json column and returned `null` for anything it could
 * not read. The service then saw a null snapshot, reported TEMPLATE_NOT_FOUND,
 * and the route answered 500 — so the malformed branch was unreachable in
 * production and the intentional recovery response never fired.
 *
 * Only a real database can prove this: an in-memory fake can hand the service a
 * malformed object directly and reach a branch production never reaches.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { isDisposableIntegrationDatabaseUrl } from "../scripts/assert-disposable-integration-db.mjs";

const integrationUrl = process.env["INTEGRATION_DATABASE_URL"];
const isDisposable = isDisposableIntegrationDatabaseUrl(integrationUrl);

if (integrationUrl) {
  process.env["DATABASE_URL"] = integrationUrl;
}

describe(
  "persisted snapshot state through the real repository",
  { skip: isDisposable ? false : "INTEGRATION_DATABASE_URL must point at a *_probe database" },
  () => {
    let prisma: import("@prisma/client").PrismaClient;
    let getDefaultMeasurementsRepository: typeof import("../lib/measurements").getDefaultMeasurementsRepository;
    let updateMeasurementValues: typeof import("../lib/measurements").updateMeasurementValues;
    let duplicateCompletedMeasurement: typeof import("../lib/measurements").duplicateCompletedMeasurement;

    let patientId = "";
    let templateId = "";

    before(async () => {
      const measurements = await import("../lib/measurements");
      const templates = await import("../lib/measurement-templates");
      const prismaModule = await import("../lib/prisma");
      getDefaultMeasurementsRepository = measurements.getDefaultMeasurementsRepository;
      updateMeasurementValues = measurements.updateMeasurementValues;
      duplicateCompletedMeasurement = measurements.duplicateCompletedMeasurement;
      prisma = prismaModule.getPrisma();

      // Order matters: MeasurementSession.patient is onDelete: Restrict, so the
      // sessions (and their values) from a previous run must go first.
      const stale = await prisma.patient.findFirst({
        where: { documentNumber: "PROBE-SNAP-1" },
        select: { id: true },
      });
      if (stale) {
        await prisma.measurementValue.deleteMany({
          where: { session: { patientId: stale.id } },
        });
        await prisma.measurementSession.deleteMany({ where: { patientId: stale.id } });
        await prisma.patient.delete({ where: { id: stale.id } });
      }
      const synced = await templates.syncCompressionTemplate(
        templates.getDefaultMeasurementTemplatesRepository(),
      );
      templateId = synced.templateId;

      const patient = await prisma.patient.create({
        data: {
          documentType: "CC",
          documentNumber: "PROBE-SNAP-1",
          fullName: "Probe Snapshot",
          sex: "FEMALE",
        },
        select: { id: true },
      });
      patientId = patient.id;
    });

    after(async () => {
      await prisma.$disconnect();
    });

    async function createSession(
      templateSnapshot: unknown,
      status: "DRAFT" | "COMPLETED" = "DRAFT",
    ): Promise<string> {
      const session = await prisma.measurementSession.create({
        data: {
          patientId,
          templateId,
          status,
          measuredAt: new Date("2026-05-03T10:00:00.000Z"),
          templateSnapshot: templateSnapshot as never,
        },
        select: { id: true },
      });
      return session.id;
    }

    it("distinguishes a MALFORMED persisted snapshot from an ABSENT one", async () => {
      const repository = getDefaultMeasurementsRepository();

      // Exactly the shape the demo seeder used to write: identity, no sections.
      const malformedId = await createSession({
        templateCode: "compression-v1",
        templateName: "Compresión v1",
        version: 1,
      });
      const absentId = await createSession(null);

      const malformed = await repository.getDetail(malformedId);
      const absent = await repository.getDetail(absentId);

      assert.ok(malformed);
      assert.ok(absent);
      assert.equal(
        malformed.templateSnapshotState,
        "malformed",
        "a stored-but-unreadable snapshot must not look absent",
      );
      assert.equal(absent.templateSnapshotState, "absent");
    });

    it("PATCH on a malformed snapshot reports MALFORMED, not TEMPLATE_NOT_FOUND", async () => {
      const repository = getDefaultMeasurementsRepository();
      const sessionId = await createSession({ templateCode: "compression-v1", version: 1 });

      const result = await updateMeasurementValues(
        sessionId,
        { valuesByKey: { legRight1: 30 }, notes: "intento" },
        repository,
      );

      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.error, "MALFORMED_TEMPLATE_SNAPSHOT");
    });

    it("a malformed-snapshot PATCH performs ZERO writes", async () => {
      const repository = getDefaultMeasurementsRepository();
      const sessionId = await createSession({ templateCode: "compression-v1", version: 1 });

      await updateMeasurementValues(
        sessionId,
        { valuesByKey: { legRight1: 30 }, notes: "no debe persistir" },
        repository,
      );

      const after = await prisma.measurementSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { values: true },
      });
      assert.equal(after.notes, null, "context must not have been written");
      assert.equal(after.values.length, 0, "no value may have been written");
    });

    it("an ABSENT snapshot still reports TEMPLATE_NOT_FOUND", async () => {
      const repository = getDefaultMeasurementsRepository();
      const sessionId = await createSession(null);

      const result = await updateMeasurementValues(
        sessionId,
        { valuesByKey: { legRight1: 30 } },
        repository,
      );

      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.error, "TEMPLATE_NOT_FOUND");
    });

    it("duplication of a malformed snapshot writes nothing at all", async () => {
      const repository = getDefaultMeasurementsRepository();
      const sessionId = await createSession(
        { templateCode: "compression-v1", version: 1 },
        "COMPLETED",
      );
      const before = await prisma.measurementSession.count({ where: { patientId } });

      const result = await duplicateCompletedMeasurement(sessionId, repository);

      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.error, "MALFORMED_TEMPLATE_SNAPSHOT");
      const afterCount = await prisma.measurementSession.count({ where: { patientId } });
      assert.equal(afterCount, before, "no destination draft may exist");
    });
  },
);

/**
 * B3 — the draft save must be ONE transaction against the real database.
 */
describe(
  "atomic draft save against real PostgreSQL",
  { skip: isDisposable ? false : "INTEGRATION_DATABASE_URL must point at a *_probe database" },
  () => {
    let prisma: import("@prisma/client").PrismaClient;
    let repositoryFactory: typeof import("../lib/measurements").getDefaultMeasurementsRepository;

    let patientId = "";
    let templateId = "";
    let fieldId = "";
    let snapshot: unknown;

    before(async () => {
      const measurements = await import("../lib/measurements");
      const templates = await import("../lib/measurement-templates");
      const prismaModule = await import("../lib/prisma");
      repositoryFactory = measurements.getDefaultMeasurementsRepository;
      prisma = prismaModule.getPrisma();

      const stale = await prisma.patient.findFirst({
        where: { documentNumber: "PROBE-ATOMIC-1" },
        select: { id: true },
      });
      if (stale) {
        await prisma.measurementValue.deleteMany({ where: { session: { patientId: stale.id } } });
        await prisma.measurementSession.deleteMany({ where: { patientId: stale.id } });
        await prisma.patient.delete({ where: { id: stale.id } });
      }

      const synced = await templates.syncCompressionTemplate(
        templates.getDefaultMeasurementTemplatesRepository(),
      );
      templateId = synced.templateId;
      snapshot = await repositoryFactory().getActiveTemplateSnapshot("compression-v1");
      const field = await prisma.templateField.findFirstOrThrow({
        where: { section: { templateId } },
      });
      fieldId = field.id;

      const patient = await prisma.patient.create({
        data: {
          documentType: "CC",
          documentNumber: "PROBE-ATOMIC-1",
          fullName: "Probe Atomic",
          sex: "FEMALE",
        },
        select: { id: true },
      });
      patientId = patient.id;
    });

    it("commits context and values together", async () => {
      const repository = repositoryFactory();
      const session = await prisma.measurementSession.create({
        data: {
          patientId,
          templateId,
          status: "DRAFT",
          measuredAt: new Date("2026-05-04T10:00:00.000Z"),
          notes: "original",
          templateSnapshot: snapshot as never,
        },
        select: { id: true },
      });

      const result = await repository.saveDraft({
        sessionId: session.id,
        context: { notes: "actualizado" },
        values: [{ fieldId, valueNumber: 41.5 }],
      });

      assert.equal(result.ok, true);
      const after = await prisma.measurementSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { values: true },
      });
      assert.equal(after.notes, "actualizado");
      assert.equal(after.values.length, 1);
    });

    it("rolls the context change back when a value write fails inside the transaction", async () => {
      const repository = repositoryFactory();
      const session = await prisma.measurementSession.create({
        data: {
          patientId,
          templateId,
          status: "DRAFT",
          measuredAt: new Date("2026-05-04T11:00:00.000Z"),
          notes: "original",
          templateSnapshot: snapshot as never,
        },
        select: { id: true },
      });

      // A fieldId that does not exist violates the FK inside the transaction.
      await assert.rejects(() =>
        repository.saveDraft({
          sessionId: session.id,
          context: { notes: "no debe persistir" },
          values: [{ fieldId: "does-not-exist", valueNumber: 10 }],
        }),
      );

      const after = await prisma.measurementSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { values: true },
      });
      assert.equal(after.notes, "original", "the context change must have rolled back");
      assert.equal(after.values.length, 0);
    });

    it("refuses to touch a session that is no longer DRAFT", async () => {
      const repository = repositoryFactory();
      const session = await prisma.measurementSession.create({
        data: {
          patientId,
          templateId,
          status: "COMPLETED",
          measuredAt: new Date("2026-05-04T12:00:00.000Z"),
          notes: "original",
          templateSnapshot: snapshot as never,
        },
        select: { id: true },
      });

      const result = await repository.saveDraft({
        sessionId: session.id,
        context: { notes: "no debe persistir" },
        values: [{ fieldId, valueNumber: 20 }],
      });

      assert.equal(result.ok, false);
      assert.equal(result.status, "COMPLETED");
      const after = await prisma.measurementSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { values: true },
      });
      assert.equal(after.notes, "original");
      assert.equal(after.values.length, 0);
    });
  },
);

/**
 * B5 — duplication must never leave an orphan draft.
 */
describe(
  "atomic duplication against real PostgreSQL",
  { skip: isDisposable ? false : "INTEGRATION_DATABASE_URL must point at a *_probe database" },
  () => {
    let prisma: import("@prisma/client").PrismaClient;
    let repositoryFactory: typeof import("../lib/measurements").getDefaultMeasurementsRepository;

    let patientId = "";
    let templateId = "";
    let snapshot: unknown;

    before(async () => {
      const measurements = await import("../lib/measurements");
      const templates = await import("../lib/measurement-templates");
      const prismaModule = await import("../lib/prisma");
      repositoryFactory = measurements.getDefaultMeasurementsRepository;
      prisma = prismaModule.getPrisma();

      const stale = await prisma.patient.findFirst({
        where: { documentNumber: "PROBE-DUP-1" },
        select: { id: true },
      });
      if (stale) {
        await prisma.measurementValue.deleteMany({ where: { session: { patientId: stale.id } } });
        await prisma.measurementSession.deleteMany({ where: { patientId: stale.id } });
        await prisma.patient.delete({ where: { id: stale.id } });
      }

      const synced = await templates.syncCompressionTemplate(
        templates.getDefaultMeasurementTemplatesRepository(),
      );
      templateId = synced.templateId;
      snapshot = await repositoryFactory().getActiveTemplateSnapshot("compression-v1");

      const patient = await prisma.patient.create({
        data: {
          documentType: "CC",
          documentNumber: "PROBE-DUP-1",
          fullName: "Probe Duplication",
          sex: "FEMALE",
        },
        select: { id: true },
      });
      patientId = patient.id;
    });

    it("creates the draft and its values together", async () => {
      const repository = repositoryFactory();
      const field = await prisma.templateField.findFirstOrThrow({
        where: { section: { templateId } },
      });

      const created = await repository.createDraftWithValues({
        draft: {
          patientId,
          templateId,
          measuredAt: new Date("2026-05-05T10:00:00.000Z"),
          notes: "copiado",
          diagnosis: null,
          garmentType: "MC",
          compressionClass: null,
          productFlags: null,
          metadata: null,
          templateSnapshot: snapshot as never,
        },
        values: [{ fieldId: field.id, valueNumber: 33.5 }],
      });

      assert.ok(created.ok);
      const session = await prisma.measurementSession.findUniqueOrThrow({
        where: { id: created.id },
        include: { values: true },
      });
      assert.equal(session.notes, "copiado");
      assert.equal(session.values.length, 1);
      assert.equal(Number(session.values[0]?.valueNumber), 33.5);
    });

    it("leaves NO draft behind when the value write fails", async () => {
      const repository = repositoryFactory();
      const before = await prisma.measurementSession.count({ where: { patientId } });

      await assert.rejects(() =>
        repository.createDraftWithValues({
          draft: {
            patientId,
            templateId,
            measuredAt: new Date("2026-05-05T11:00:00.000Z"),
            notes: "no debe existir",
            diagnosis: null,
            garmentType: "MC",
            compressionClass: null,
            productFlags: null,
            metadata: null,
            templateSnapshot: snapshot as never,
          },
          // FK violation inside the transaction.
          values: [{ fieldId: "does-not-exist", valueNumber: 1 }],
        }),
      );

      const afterCount = await prisma.measurementSession.count({ where: { patientId } });
      assert.equal(afterCount, before, "the destination draft must have rolled back");
    });

    it("repeated failed attempts do not accumulate drafts", async () => {
      const repository = repositoryFactory();
      const before = await prisma.measurementSession.count({ where: { patientId } });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await assert.rejects(() =>
          repository.createDraftWithValues({
            draft: {
              patientId,
              templateId,
              measuredAt: new Date("2026-05-05T12:00:00.000Z"),
              notes: null,
              diagnosis: null,
              garmentType: "MC",
              compressionClass: null,
              productFlags: null,
              metadata: null,
              templateSnapshot: snapshot as never,
            },
            values: [{ fieldId: "does-not-exist", valueNumber: 1 }],
          }),
        );
      }

      const afterCount = await prisma.measurementSession.count({ where: { patientId } });
      assert.equal(afterCount, before, "no orphan may accumulate across retries");
    });
  },
);
