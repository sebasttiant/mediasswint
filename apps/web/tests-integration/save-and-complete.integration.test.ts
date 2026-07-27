/**
 * C1 — the atomic save+complete primitive, against real PostgreSQL.
 *
 * `saveDraftAndComplete` changed the central concurrency contract: the draft's
 * context, its values and the DRAFT -> COMPLETED transition must commit as ONE
 * unit, and a session that is already COMPLETED must be immutable.
 *
 * Route and unit tests exercise fakes or the two-call fallback
 * (saveDraft + markCompleted), so neither can prove PostgreSQL rollback or what
 * happens when two transactions overlap. These tests drive the DEFAULT Prisma
 * repository — no in-memory copy of its logic — and read the committed rows
 * back out of the database.
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
  "atomic save+complete against real PostgreSQL",
  { skip: isDisposable ? false : "INTEGRATION_DATABASE_URL must point at a *_probe database" },
  () => {
    let prisma: import("@prisma/client").PrismaClient;
    let repositoryFactory: typeof import("../lib/measurements").getDefaultMeasurementsRepository;
    let saveAndCompleteMeasurement: typeof import("../lib/measurements").saveAndCompleteMeasurement;
    let runWithAuditContext: typeof import("../lib/audit-context").runWithAuditContext;

    let patientId = "";
    let templateId = "";
    let fieldId = "";
    let otherFieldId = "";
    let snapshot: unknown;

    before(async () => {
      const measurements = await import("../lib/measurements");
      const templates = await import("../lib/measurement-templates");
      const prismaModule = await import("../lib/prisma");
      const auditContext = await import("../lib/audit-context");
      repositoryFactory = measurements.getDefaultMeasurementsRepository;
      saveAndCompleteMeasurement = measurements.saveAndCompleteMeasurement;
      runWithAuditContext = auditContext.runWithAuditContext;
      prisma = prismaModule.getPrisma();

      // MeasurementSession.patient is onDelete: Restrict, so sessions and their
      // values from a previous run must go before the patient.
      const stale = await prisma.patient.findFirst({
        where: { documentNumber: "PROBE-SAVECOMPLETE-1" },
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

      const fields = await prisma.templateField.findMany({
        where: { section: { templateId } },
        orderBy: { id: "asc" },
        take: 2,
      });
      fieldId = fields[0]!.id;
      otherFieldId = fields[1]!.id;

      const patient = await prisma.patient.create({
        data: {
          documentType: "CC",
          documentNumber: "PROBE-SAVECOMPLETE-1",
          fullName: "Probe SaveComplete",
          sex: "FEMALE",
        },
        select: { id: true },
      });
      patientId = patient.id;
    });

    after(async () => {
      await prisma.$disconnect();
    });

    async function createDraft(notes = "original", status: "DRAFT" | "COMPLETED" = "DRAFT") {
      const session = await prisma.measurementSession.create({
        data: {
          patientId,
          templateId,
          status,
          measuredAt: new Date("2026-05-05T10:00:00.000Z"),
          notes,
          templateSnapshot: snapshot as never,
        },
        select: { id: true },
      });
      return session.id;
    }

    function readBack(sessionId: string) {
      return prisma.measurementSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { values: true },
      });
    }

    it("commits context, values and the COMPLETED transition as one unit", async () => {
      const repository = repositoryFactory();
      const sessionId = await createDraft();

      const result = await repository.saveDraftAndComplete!({
        sessionId,
        context: { notes: "finalizado" },
        values: [
          { fieldId, valueNumber: 41.5 },
          { fieldId: otherFieldId, valueNumber: 38 },
        ],
      });

      assert.equal(result.status, "COMPLETED");
      const persisted = await readBack(sessionId);
      assert.equal(persisted.status, "COMPLETED");
      assert.equal(persisted.notes, "finalizado");
      assert.equal(persisted.values.length, 2);
    });

    it("rolls EVERYTHING back when a value write fails inside the transaction", async () => {
      const repository = repositoryFactory();
      const sessionId = await createDraft();

      // A fieldId that does not exist violates the FK *inside* the transaction —
      // a real failure at a real constraint, not an injected mock.
      await assert.rejects(() =>
        repository.saveDraftAndComplete!({
          sessionId,
          context: { notes: "no debe persistir" },
          values: [
            { fieldId, valueNumber: 12 },
            { fieldId: "does-not-exist", valueNumber: 10 },
          ],
        }),
      );

      const persisted = await readBack(sessionId);
      assert.equal(persisted.status, "DRAFT", "the completion must have rolled back");
      assert.equal(persisted.notes, "original", "the context change must have rolled back");
      assert.equal(persisted.values.length, 0, "the value written before the failure must be gone");
    });

    it("refuses an ALREADY COMPLETED session with zero writes and an explicit domain state", async () => {
      const repository = repositoryFactory();
      const sessionId = await createDraft("original", "COMPLETED");

      const result = await repository.saveDraftAndComplete!({
        sessionId,
        context: { notes: "no debe persistir" },
        values: [{ fieldId, valueNumber: 99 }],
      });

      assert.equal(result.status, "INVALID_STATE");
      const persisted = await readBack(sessionId);
      assert.equal(persisted.notes, "original");
      assert.equal(persisted.values.length, 0);
    });

    it("reports NOT_FOUND, distinctly from INVALID_STATE, for a session that does not exist", async () => {
      const repository = repositoryFactory();

      const result = await repository.saveDraftAndComplete!({
        sessionId: "does-not-exist",
        values: [{ fieldId, valueNumber: 1 }],
      });

      assert.equal(result.status, "NOT_FOUND");
    });

    it("lets exactly ONE of two overlapping completions win", async () => {
      const repository = repositoryFactory();
      const sessionId = await createDraft();

      // Both transactions race for the same conditional DRAFT lock. The loser
      // blocks on the row until the winner commits, then re-evaluates
      // `WHERE status = 'DRAFT'`, finds no row, and reports INVALID_STATE.
      const [first, second] = await Promise.all([
        repository.saveDraftAndComplete!({
          sessionId,
          context: { notes: "ganador-a" },
          values: [{ fieldId, valueNumber: 10 }],
        }),
        repository.saveDraftAndComplete!({
          sessionId,
          context: { notes: "ganador-b" },
          values: [{ fieldId, valueNumber: 20 }],
        }),
      ]);

      const outcomes = [first.status, second.status].sort();
      assert.deepEqual(outcomes, ["COMPLETED", "INVALID_STATE"]);

      const persisted = await readBack(sessionId);
      assert.equal(persisted.status, "COMPLETED");
      // The loser contributed nothing: exactly one value, from one writer.
      assert.equal(persisted.values.length, 1);
      assert.ok(["ganador-a", "ganador-b"].includes(persisted.notes ?? ""));
    });

    it("makes a session immutable the moment a concurrent completion commits", async () => {
      const repository = repositoryFactory();
      const sessionId = await createDraft();

      const [completion, concurrentSave] = await Promise.all([
        repository.saveDraftAndComplete!({
          sessionId,
          context: { notes: "finalizado" },
          values: [{ fieldId, valueNumber: 30 }],
        }),
        repository.saveDraft({
          sessionId,
          context: { notes: "tardio" },
          values: [{ fieldId: otherFieldId, valueNumber: 44 }],
        }),
      ]);

      assert.equal(completion.status, "COMPLETED");
      const persisted = await readBack(sessionId);
      assert.equal(persisted.status, "COMPLETED");

      if (concurrentSave.ok) {
        // The save committed FIRST, while the row was still DRAFT — legitimate.
        assert.equal(persisted.notes, "finalizado");
      } else {
        // It lost the race and must have written nothing.
        assert.equal(concurrentSave.status, "COMPLETED");
        assert.equal(persisted.values.some((value) => value.fieldId === otherFieldId), false);
      }

      // Whatever the interleaving, a COMPLETED session is closed to further writes.
      const afterwards = await repository.saveDraft({
        sessionId,
        context: { notes: "despues" },
        values: [{ fieldId, valueNumber: 77 }],
      });
      assert.equal(afterwards.ok, false);
      assert.equal((await readBack(sessionId)).notes, persisted.notes);
    });

    it("stays truthful about committed state when the post-commit audit write fails", async () => {
      const sessionId = await createDraft();
      const repository = repositoryFactory();

      // AuditLog.userId is a FK to User, so an actor that does not exist makes
      // the audit INSERT fail for real — after the measurement transaction has
      // already committed.
      const result = await runWithAuditContext(
        {
          user: {
            id: "user-does-not-exist",
            email: "ghost@mediasswint.test",
            passwordHash: "hash",
            isActive: true,
            fullName: "Ghost",
            role: "STAFF",
          },
        },
        () =>
          saveAndCompleteMeasurement(
            sessionId,
            { valuesByKey: {}, notes: "finalizado" },
            repository,
          ),
      );

      // The persistence DID happen, so the caller must not be told otherwise.
      assert.equal(result.ok, true, "a failed audit write must not deny a committed save");
      const persisted = await readBack(sessionId);
      assert.equal(persisted.status, "COMPLETED");
      assert.equal(persisted.notes, "finalizado");
      // And the audit row genuinely did not land — the scenario is real.
      const auditRows = await prisma.auditLog.count({
        where: { entityType: "MeasurementSession", entityId: sessionId },
      });
      assert.equal(auditRows, 0);
    });
  },
);
