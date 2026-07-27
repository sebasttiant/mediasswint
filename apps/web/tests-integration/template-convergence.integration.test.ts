/**
 * REAL PostgreSQL / Prisma integration proof for template convergence.
 *
 * An in-memory fake cannot prove this behaviour, because the whole problem is a
 * database constraint: `MeasurementValue.field` is `onDelete: Restrict`. Any
 * design that deletes retired template rows is refused by Postgres the moment a
 * removed field was ever measured. This test exercises the real repository
 * against a real database so that constraint is enforced, not simulated.
 *
 * Runs only when INTEGRATION_DATABASE_URL points at a DISPOSABLE database. It
 * is deliberately outside the `tests/**` unit glob so CI without a database is
 * unaffected.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const integrationUrl = process.env["INTEGRATION_DATABASE_URL"];

// Refuse to run against anything that is not obviously disposable. Losing a
// shared dev database to a test fixture is not an acceptable failure mode.
const isDisposable = typeof integrationUrl === "string" && /_probe(\?|$)/.test(integrationUrl);

if (integrationUrl) {
  process.env["DATABASE_URL"] = integrationUrl;
}

describe(
  "template convergence against real PostgreSQL",
  { skip: isDisposable ? false : "INTEGRATION_DATABASE_URL must point at a *_probe database" },
  () => {
    let prisma: import("@prisma/client").PrismaClient;
    let syncMeasurementTemplate: typeof import("../lib/measurement-templates").syncMeasurementTemplate;
    let getDefaultMeasurementTemplatesRepository: typeof import("../lib/measurement-templates").getDefaultMeasurementTemplatesRepository;
    let getDefaultMeasurementsRepository: typeof import("../lib/measurements").getDefaultMeasurementsRepository;

    const CODE = "probe-head-v1";

    function buildDefinition(fieldKeys: ReadonlyArray<string>) {
      return {
        code: CODE,
        name: "Probe Head v1",
        version: 1,
        description: "Probe template",
        sections: [
          {
            title: "Cabeza",
            sortOrder: 0,
            fields: fieldKeys.map((key, index) => ({
              key,
              label: `Medida ${key}`,
              fieldType: "NUMBER" as const,
              unit: "cm",
              isRequired: false,
              sortOrder: index,
              minValue: 1,
              maxValue: 200,
              metadata: { anatomyZone: `head.${key}` },
            })),
          },
        ],
      };
    }

    before(async () => {
      const templates = await import("../lib/measurement-templates");
      const measurements = await import("../lib/measurements");
      const prismaModule = await import("../lib/prisma");
      syncMeasurementTemplate = templates.syncMeasurementTemplate;
      getDefaultMeasurementTemplatesRepository = templates.getDefaultMeasurementTemplatesRepository;
      getDefaultMeasurementsRepository = measurements.getDefaultMeasurementsRepository;
      prisma = prismaModule.getPrisma();

      // Clean slate for this probe template only.
      const existing = await prisma.measurementTemplate.findUnique({ where: { code: CODE } });
      if (existing) {
        await prisma.measurementValue.deleteMany({
          where: { field: { section: { templateId: existing.id } } },
        });
        await prisma.measurementSession.deleteMany({ where: { templateId: existing.id } });
        await prisma.templateField.deleteMany({ where: { section: { templateId: existing.id } } });
        await prisma.templateSection.deleteMany({ where: { templateId: existing.id } });
        await prisma.measurementTemplate.delete({ where: { id: existing.id } });
      }
      await prisma.patient.deleteMany({ where: { documentNumber: "PROBE-CONV-1" } });
    });

    after(async () => {
      await prisma.$disconnect();
    });

    it("preserves history, converges the active definition, and keeps drafts saveable", async () => {
      const templatesRepo = getDefaultMeasurementTemplatesRepository();
      const measurementsRepo = getDefaultMeasurementsRepository();

      // ---- Aged database shape -------------------------------------------
      // Old definition carries two fields that the current one will drop:
      //   staleMeasured  -> will have a MeasurementValue  (F1)
      //   staleSnapshot  -> referenced ONLY by a draft snapshot, no value (F2)
      const first = await syncMeasurementTemplate(
        buildDefinition(["current", "staleMeasured", "staleSnapshot"]),
        templatesRepo,
      );
      assert.equal(first.deactivatedFieldsCount, 0);

      const patient = await prisma.patient.create({
        data: {
          documentType: "CC",
          documentNumber: "PROBE-CONV-1",
          fullName: "Probe Convergence",
          sex: "FEMALE",
        },
        select: { id: true },
      });

      const oldSnapshot = await measurementsRepo.getActiveTemplateSnapshot(CODE);
      assert.ok(oldSnapshot);
      assert.equal(oldSnapshot.sections[0]?.fields.length, 3);

      const measuredField = await prisma.templateField.findFirstOrThrow({
        where: { key: "staleMeasured", section: { templateId: first.templateId } },
      });
      const snapshotOnlyField = await prisma.templateField.findFirstOrThrow({
        where: { key: "staleSnapshot", section: { templateId: first.templateId } },
      });

      // A historical COMPLETED session that measured the soon-to-be-stale field.
      const historical = await prisma.measurementSession.create({
        data: {
          patientId: patient.id,
          templateId: first.templateId,
          status: "COMPLETED",
          measuredAt: new Date("2026-01-05T10:00:00.000Z"),
          templateSnapshot: oldSnapshot as never,
        },
        select: { id: true },
      });
      await prisma.measurementValue.create({
        data: { sessionId: historical.id, fieldId: measuredField.id, valueNumber: "56.5" },
      });

      // A live DRAFT whose snapshot references the field that has NO value.
      const draft = await prisma.measurementSession.create({
        data: {
          patientId: patient.id,
          templateId: first.templateId,
          status: "DRAFT",
          measuredAt: new Date("2026-01-06T10:00:00.000Z"),
          templateSnapshot: oldSnapshot as never,
        },
        select: { id: true },
      });

      // ---- Converge to the current definition ----------------------------
      const second = await syncMeasurementTemplate(buildDefinition(["current"]), templatesRepo);
      assert.equal(second.deactivatedFieldsCount, 2, "both obsolete fields must be retired");

      // Nothing was deleted: the Restrict constraint was never challenged.
      const survivingRows = await prisma.templateField.count({
        where: { section: { templateId: first.templateId } },
      });
      assert.equal(survivingRows, 3, "retired rows must still exist");

      // History is untouched.
      const historicalValue = await prisma.measurementValue.findFirstOrThrow({
        where: { sessionId: historical.id },
      });
      assert.equal(Number(historicalValue.valueNumber), 56.5);
      assert.equal(historicalValue.fieldId, measuredField.id);

      // A NEW session inherits only the current declared fields.
      const newSnapshot = await measurementsRepo.getActiveTemplateSnapshot(CODE);
      assert.ok(newSnapshot);
      assert.equal(newSnapshot.sections[0]?.fields.length, 1);
      assert.deepEqual(
        newSnapshot.sections[0]?.fields.map((field) => field.key),
        ["current"],
      );

      // F2: the pre-existing draft can STILL be saved against its own snapshot,
      // because the retired field row was deactivated, not deleted.
      await prisma.measurementValue.create({
        data: { sessionId: draft.id, fieldId: snapshotOnlyField.id, valueNumber: "12.5" },
      });
      const draftValue = await prisma.measurementValue.findFirstOrThrow({
        where: { sessionId: draft.id, fieldId: snapshotOnlyField.id },
      });
      assert.equal(Number(draftValue.valueNumber), 12.5);

      // ---- Idempotence ---------------------------------------------------
      const third = await syncMeasurementTemplate(buildDefinition(["current"]), templatesRepo);
      assert.equal(third.deactivatedFieldsCount, 0);
      assert.equal(third.deactivatedSectionsCount, 0);
      assert.equal(third.fieldsCount, 1);

      // ---- Revival -------------------------------------------------------
      const revived = await syncMeasurementTemplate(
        buildDefinition(["current", "staleMeasured"]),
        templatesRepo,
      );
      const revivedSnapshot = await measurementsRepo.getActiveTemplateSnapshot(CODE);
      assert.equal(revivedSnapshot?.sections[0]?.fields.length, 2);
      assert.equal(revived.deactivatedFieldsCount, 0);
      const stillThree = await prisma.templateField.count({
        where: { section: { templateId: first.templateId } },
      });
      assert.equal(stillThree, 3, "revival must reuse the row, never duplicate it");
    });

    it("proves the Restrict constraint that makes deletion unusable", async () => {
      const template = await prisma.measurementTemplate.findUniqueOrThrow({ where: { code: CODE } });
      const measured = await prisma.templateField.findFirstOrThrow({
        where: { key: "staleMeasured", section: { templateId: template.id } },
      });

      // This is what the rejected "prune by deletion" design would have done.
      await assert.rejects(
        () => prisma.templateField.delete({ where: { id: measured.id } }),
        /RESTRICT|constraint|foreign key/i,
        "deleting a measured field must be refused by the database",
      );
    });
  },
);
