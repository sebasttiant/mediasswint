/**
 * MP/Bermuda completion must be validated against the state it actually
 * completes, not against an earlier read.
 *
 * `saveAndCompleteMeasurement` reads the draft, validates persisted + submitted
 * values, and only then opens the locked save+complete transaction. A save that
 * commits in that window (clearing a required value the completion does not
 * resubmit) used to be finalized on the strength of the stale validation.
 *
 * The interleaving is forced deterministically: the repository handed to the
 * service runs the competing save to commit right before delegating to the real
 * atomic primitive — i.e. after the service has read and validated. No sleeps.
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
  "MP completion vs a concurrent draft save, against real PostgreSQL",
  { skip: isDisposable ? false : "INTEGRATION_DATABASE_URL must point at a *_probe database" },
  () => {
    type Measurements = typeof import("../lib/measurements");
    let prisma: import("@prisma/client").PrismaClient;
    let measurements: Measurements;

    let patientId = "";
    const templates: Record<"mp" | "compression", { id: string; snapshot: unknown; fields: Array<{ id: string; key: string; minValue: number }> }> =
      {} as never;

    before(async () => {
      measurements = await import("../lib/measurements");
      const templateModule = await import("../lib/measurement-templates");
      prisma = (await import("../lib/prisma")).getPrisma();

      const stale = await prisma.patient.findFirst({
        where: { documentNumber: "PROBE-MPRACE-1" },
        select: { id: true },
      });
      if (stale) {
        await prisma.measurementValue.deleteMany({ where: { session: { patientId: stale.id } } });
        await prisma.measurementSession.deleteMany({ where: { patientId: stale.id } });
        await prisma.patient.delete({ where: { id: stale.id } });
      }

      const repository = measurements.getDefaultMeasurementsRepository();
      const syncs = {
        mp: ["mp-bermuda-v1", templateModule.syncMpBermudaTemplate],
        compression: ["compression-v1", templateModule.syncCompressionTemplate],
      } as const;
      for (const [name, [code, sync]] of Object.entries(syncs) as Array<[keyof typeof syncs, (typeof syncs)[keyof typeof syncs]]>) {
        const synced = await sync(templateModule.getDefaultMeasurementTemplatesRepository());
        const snapshot = await repository.getActiveTemplateSnapshot(code);
        assert.ok(snapshot, `${code} snapshot must exist`);
        templates[name] = {
          id: synced.templateId,
          snapshot,
          fields: snapshot.sections.flatMap((section) =>
            section.fields.map((field) => ({ id: field.id, key: field.key, minValue: field.minValue ?? 1 })),
          ),
        };
      }

      const patient = await prisma.patient.create({
        data: { documentType: "CC", documentNumber: "PROBE-MPRACE-1", fullName: "Probe MpRace", sex: "FEMALE" },
        select: { id: true },
      });
      patientId = patient.id;
    });

    after(async () => {
      await prisma.$disconnect();
    });

    /** A DRAFT whose persisted values already satisfy every required field. */
    async function createFilledDraft(kind: "mp" | "compression") {
      const template = templates[kind];
      const session = await prisma.measurementSession.create({
        data: {
          patientId,
          templateId: template.id,
          status: "DRAFT",
          measuredAt: new Date("2026-05-05T10:00:00.000Z"),
          notes: "original",
          templateSnapshot: template.snapshot as never,
          values: {
            create: template.fields.map((field) => ({ fieldId: field.id, valueNumber: field.minValue })),
          },
        },
        select: { id: true },
      });
      return session.id;
    }

    /** Real repository, with B's save committing between A's validation and A's transaction. */
    function repositoryWithConcurrentClear(sessionId: string, clearedFieldId: string) {
      const real = measurements.getDefaultMeasurementsRepository();
      return {
        ...real,
        async saveDraftAndComplete(input: Parameters<NonNullable<typeof real.saveDraftAndComplete>>[0]) {
          const concurrent = await real.saveDraft({ sessionId, values: [{ fieldId: clearedFieldId, valueNumber: null }] });
          assert.equal(concurrent.ok, true, "the competing save must commit first");
          return real.saveDraftAndComplete!(input);
        },
      };
    }

    function readBack(sessionId: string) {
      return prisma.measurementSession.findUniqueOrThrow({ where: { id: sessionId }, include: { values: true } });
    }

    it("refuses to finalize an MP draft whose required value was cleared after validation", async () => {
      const sessionId = await createFilledDraft("mp");
      const [cleared, resubmitted] = templates.mp.fields;

      // A resubmits one value and relies on the persisted value of `cleared`.
      const result = await measurements.saveAndCompleteMeasurement(
        sessionId,
        { valuesByKey: { [resubmitted!.key]: resubmitted!.minValue + 1 }, notes: "finalizado" },
        repositoryWithConcurrentClear(sessionId, cleared!.id),
      );

      assert.deepEqual(result, {
        ok: false,
        error: "MP_COMPLETION_INVALID",
        errors: [{ field: `valuesByKey.${cleared!.key}`, message: "a finite value is required" }],
      });
      const persisted = await readBack(sessionId);
      assert.equal(persisted.status, "DRAFT", "an incomplete MP session must never be COMPLETED");
      assert.equal(persisted.notes, "original", "the refused completion must write nothing");
      assert.equal(persisted.values.some((value) => value.fieldId === cleared!.id), false, "B's committed clear survives");
    });

    it("still completes an MP draft that remains complete under the lock", async () => {
      const sessionId = await createFilledDraft("mp");
      const [first] = templates.mp.fields;

      const result = await measurements.saveAndCompleteMeasurement(
        sessionId,
        { valuesByKey: { [first!.key]: first!.minValue + 1 }, notes: "finalizado" },
        measurements.getDefaultMeasurementsRepository(),
      );

      assert.deepEqual(result, { ok: true, value: { id: sessionId, status: "COMPLETED" } });
      const persisted = await readBack(sessionId);
      assert.equal(persisted.status, "COMPLETED");
      assert.equal(persisted.notes, "finalizado");
      assert.equal(persisted.values.length, templates.mp.fields.length);
    });

    it("leaves non-MP completion unchanged: a concurrent clear does not block it", async () => {
      const sessionId = await createFilledDraft("compression");
      const [cleared] = templates.compression.fields;

      const result = await measurements.saveAndCompleteMeasurement(
        sessionId,
        { valuesByKey: {}, notes: "finalizado" },
        repositoryWithConcurrentClear(sessionId, cleared!.id),
      );

      assert.deepEqual(result, { ok: true, value: { id: sessionId, status: "COMPLETED" } });
      const persisted = await readBack(sessionId);
      assert.equal(persisted.status, "COMPLETED");
      assert.equal(persisted.values.length, templates.compression.fields.length - 1);
    });
  },
);
