import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { recordAudit, type AuditRepository } from "../lib/audit-log";

/**
 * B2 — audit persistence failure must not leak clinical data into operational
 * logs.
 *
 * `recordAudit` logged the ENTIRE entry on failure, and a measurement entry's
 * `diff` carries measurement values, diagnosis, notes, productFlags and
 * arbitrary metadata. An audit write failing is exactly the moment those logs
 * get read, shipped and retained, so it was the worst possible place to dump a
 * clinical payload.
 */

const CLINICAL_PAYLOAD = {
  before: {
    valuesByKey: { legRight1: 41.5, legRight2: 38.2 },
    diagnosis: "Insuficiencia venosa crónica grado III",
    notes: "Paciente refiere dolor nocturno",
    productFlags: { urgente: true },
    metadata: { patientSex: "FEMALE", documentNumber: "1001001001" },
    fullName: "María Fernanda Rojas Gómez",
  },
  after: {
    valuesByKey: { legRight1: 42.0 },
  },
};

const FORBIDDEN_SUBSTRINGS = [
  "41.5",
  "38.2",
  "42",
  "Insuficiencia venosa",
  "dolor nocturno",
  "urgente",
  "1001001001",
  "María Fernanda",
  "valuesByKey",
  "diagnosis",
  "notes",
  "productFlags",
];

function failingRepository(): AuditRepository {
  return {
    async record() {
      throw new Error("audit sink unavailable");
    },
    async list() {
      return { rows: [], total: 0 };
    },
  } as unknown as AuditRepository;
}

async function captureLogs(run: () => Promise<void>): Promise<unknown[]> {
  const captured: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    captured.push(...args);
  };
  try {
    await run();
  } finally {
    console.error = original;
  }
  return captured;
}

describe("audit persistence failure logging", () => {
  it("actually reaches the failure branch (guards against a vacuous assertion)", async () => {
    const captured = await captureLogs(async () => {
      await recordAudit(
        {
          action: "UPDATE",
          entityType: "MeasurementSession",
          entityId: "ses-1",
          diff: CLINICAL_PAYLOAD,
        },
        failingRepository(),
      );
    });

    assert.ok(
      captured.length > 0,
      "the failure branch must have logged something; an empty log would make the privacy assertions meaningless",
    );
    assert.ok(
      JSON.stringify(captured).includes("audit"),
      "the log must identify itself as an audit failure",
    );
  });

  it("never writes clinical or personal data to the operational log", async () => {
    const captured = await captureLogs(async () => {
      await recordAudit(
        {
          action: "UPDATE",
          entityType: "MeasurementSession",
          entityId: "ses-1",
          diff: CLINICAL_PAYLOAD,
        },
        failingRepository(),
      );
    });

    const serialized = JSON.stringify(captured);
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      assert.equal(
        serialized.includes(forbidden),
        false,
        `clinical/personal data leaked into the audit failure log: ${forbidden}`,
      );
    }
  });

  it("logs only the allow-listed operational fields", async () => {
    const captured = await captureLogs(async () => {
      await recordAudit(
        {
          action: "UPDATE",
          entityType: "MeasurementSession",
          entityId: "ses-1",
          diff: CLINICAL_PAYLOAD,
        },
        failingRepository(),
      );
    });

    const context = captured.find(
      (value): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value),
    );
    assert.ok(context, "a structured context object must be logged");

    const allowed = new Set(["action", "entityType", "entityId", "userId", "errorName", "errorCode"]);
    for (const key of Object.keys(context)) {
      assert.ok(allowed.has(key), `unexpected key in audit failure log: ${key}`);
    }

    assert.equal(context["action"], "UPDATE");
    assert.equal(context["entityType"], "MeasurementSession");
    assert.equal(context["entityId"], "ses-1");
    assert.equal(context["errorName"], "Error");
  });

  it("does not log the raw error object, which can carry query parameters", async () => {
    const captured = await captureLogs(async () => {
      await recordAudit(
        {
          action: "DELETE",
          entityType: "MeasurementSession",
          entityId: "ses-2",
          diff: { before: { secretValue: 99.9 } },
        },
        {
          async record() {
            const error = new Error("insert failed: valueNumber=99.9 diagnosis=secret");
            throw error;
          },
          async list() {
            return { rows: [], total: 0 };
          },
        } as unknown as AuditRepository,
      );
    });

    const serialized = JSON.stringify(captured);
    assert.equal(serialized.includes("99.9"), false);
    assert.equal(serialized.includes("diagnosis=secret"), false);
  });
});
