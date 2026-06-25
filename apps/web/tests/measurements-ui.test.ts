import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCompressionTemplate } from "../lib/compression-template";
import type { TemplateSnapshot } from "../lib/measurements";
import {
  buildMeasurementTableRows,
  getActiveZoneIdForField,
  getActiveZoneLabel,
  getFilledZoneIdsFromValues,
  measurementSnapshotRequiresFaceGuide,
  type MeasurementUiField,
} from "../app/patients/[id]/measurements/measurements-ui";
import {
  GARMENT_FIGURE_KEY,
  isGarmentSelectionValid,
  resolveGarmentDisplay,
  resolveGarmentSelectValue,
  resolveLegacyGarmentSelectOption,
} from "../lib/garment-catalog";

function buildSnapshot(): TemplateSnapshot {
  const template = buildCompressionTemplate();
  let fieldId = 0;

  return {
    templateId: "template-1",
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
    sections: template.sections.map((section) => ({
      title: section.title,
      sortOrder: section.sortOrder,
      fields: section.fields.map((field) => {
        fieldId += 1;
        return {
          id: `field-${fieldId}`,
          key: field.key,
          label: field.label,
          fieldType: field.fieldType,
          unit: field.unit,
          isRequired: field.isRequired,
          sortOrder: field.sortOrder,
          minValue: field.minValue,
          maxValue: field.maxValue,
          metadata: field.metadata,
        };
      }),
    })),
  };
}

describe("measurement UI helpers", () => {
  it("builds paired leg rows for points 1..28 with right and left values", () => {
    const rows = buildMeasurementTableRows(buildSnapshot(), "legs", {
      legRight1: 24.5,
      legLeft1: 25,
      legRight28: null,
    });

    assert.equal(rows.length, 28);
    assert.equal(rows[0]?.point, 1);
    assert.equal(rows[0]?.right?.key, "legRight1");
    assert.equal(rows[0]?.right?.value, 24.5);
    assert.equal(rows[0]?.left?.key, "legLeft1");
    assert.equal(rows[0]?.left?.value, 25);
    assert.equal(rows[27]?.point, 28);
  });

  it("builds paired arm rows for points 1..19", () => {
    const rows = buildMeasurementTableRows(buildSnapshot(), "arms", {
      armRight19: 31,
      armLeft19: 32,
    });

    assert.equal(rows.length, 19);
    assert.equal(rows[18]?.right?.key, "armRight19");
    assert.equal(rows[18]?.right?.value, 31);
    assert.equal(rows[18]?.left?.key, "armLeft19");
  });

  it("resolves the BodyHighlight zone id from field metadata", () => {
    const field: MeasurementUiField = {
      key: "legRight7",
      label: "Pierna derecha punto 7",
      unit: "cm",
      minValue: 0.1,
      maxValue: 300,
      metadata: { anatomyZone: "legs.right.7" },
      value: null,
    };

    assert.equal(getActiveZoneIdForField(field), "legs.right.7");
    assert.equal(getActiveZoneIdForField(null), null);
    assert.equal(getActiveZoneIdForField({ ...field, metadata: {} }), null);
  });

  it("getActiveZoneLabel returns a human label from field metadata", () => {
    const legField: MeasurementUiField = {
      key: "legRight7",
      label: "Pierna derecha punto 7",
      unit: "cm",
      minValue: 0.1,
      maxValue: 300,
      metadata: { anatomyZone: "legs.right.7", group: "legs", side: "right", point: 7 },
      value: null,
    };

    assert.equal(getActiveZoneLabel(legField), "Pierna Derecho/a · Punto 7");

    const armField: MeasurementUiField = {
      key: "armLeft19",
      label: "Brazo izquierdo punto 19",
      unit: "cm",
      minValue: 0.1,
      maxValue: 300,
      metadata: { anatomyZone: "arms.left.19", group: "arms", side: "left", point: 19 },
      value: null,
    };

    assert.equal(getActiveZoneLabel(armField), "Brazo Izquierdo/a · Punto 19");
  });

  it("getActiveZoneLabel returns null for null field", () => {
    assert.equal(getActiveZoneLabel(null), null);
  });

  it("getActiveZoneLabel falls back to field.label when metadata is incomplete", () => {
    const field: MeasurementUiField = {
      key: "legRight7",
      label: "Pierna derecha punto 7",
      unit: "cm",
      minValue: 0.1,
      maxValue: 300,
      metadata: {},
      value: null,
    };

    assert.equal(getActiveZoneLabel(field), "Pierna derecha punto 7");
  });

  it("maps entered draft values to filled anatomy zones", () => {
    const filledZoneIds = getFilledZoneIdsFromValues(buildSnapshot(), {
      legRight1: "24.5",
      legLeft1: "   ",
      armLeft19: "31",
    });

    assert.equal(filledZoneIds.has("legs.right.1"), true);
    assert.equal(filledZoneIds.has("arms.left.19"), true);
    assert.equal(filledZoneIds.has("legs.left.1"), false);
    assert.equal(filledZoneIds.size, 2);
  });

  it("maps saved numeric values to filled anatomy zones", () => {
    const filledZoneIds = getFilledZoneIdsFromValues(buildSnapshot(), {
      legRight2: 25,
      legLeft2: null,
      armRight3: 0,
    });

    assert.equal(filledZoneIds.has("legs.right.2"), true);
    assert.equal(filledZoneIds.has("arms.right.3"), true);
    assert.equal(filledZoneIds.has("legs.left.2"), false);
    assert.equal(filledZoneIds.size, 2);
  });

  it("ignores values for unknown keys", () => {
    const filledZoneIds = getFilledZoneIdsFromValues(buildSnapshot(), {
      unknown: "123",
    });

    assert.equal(filledZoneIds.size, 0);
  });

  it("does not require a face guide for the default limb template", () => {
    assert.equal(measurementSnapshotRequiresFaceGuide(buildSnapshot()), false);
  });

  it("requires a face guide when section, field, or metadata references head/face", () => {
    const snapshot = buildSnapshot();
    const firstSection = snapshot.sections[0]!;
    const firstField = firstSection.fields[0]!;

    const faceSnapshot: TemplateSnapshot = {
      ...snapshot,
      sections: [
        {
          ...firstSection,
          title: "Rostro",
          fields: [
            {
              ...firstField,
              key: "headFaceWidth",
              label: "Ancho de cara",
              metadata: { ...firstField.metadata, placeholder: "head-face" },
            },
          ],
        },
      ],
    };

    assert.equal(measurementSnapshotRequiresFaceGuide(faceSnapshot), true);
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentType, ReactElement, ReactNode } from "react";

import { AppShell } from "../app/_components/app-shell/app-shell";
import type { Patient } from "@prisma/client";
import type { MeasurementSessionDetail } from "../lib/measurements";
import {
  buildMeasurementDetailNotice,
  MEASUREMENT_DETAIL_VIEW_KICKER,
  renderMeasurementDetailView,
  type MeasurementDetailViewMeasurement,
  type MeasurementDetailViewPatient,
  type MeasurementDetailViewUser,
} from "../app/patients/[id]/measurements/[sessionId]/measurement-detail-view";
import MeasurementDetailPage from "../app/patients/[id]/measurements/[sessionId]/page";

type MeasurementDetailAppShellProps = {
  currentPath: string;
  title: string;
  kicker: string;
  description?: string;
  userLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
};

function readMeasurementDetailViewProps(view: ReactElement): MeasurementDetailAppShellProps {
  return view.props as MeasurementDetailAppShellProps;
}

function buildMeasurementPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "pat-1",
    fullName: "Ada Lovelace",
    sex: null,
    documentType: null,
    documentNumber: null,
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

function buildMeasurement(
  overrides: Partial<MeasurementSessionDetail> = {},
): MeasurementSessionDetail {
  return {
    id: "sess-1",
    patientId: "pat-1",
    templateId: null,
    status: "COMPLETED",
    measuredAt: new Date("2026-02-01T10:00:00.000Z"),
    notes: null,
    diagnosis: null,
    garmentType: null,
    compressionClass: null,
    productFlags: null,
    metadata: null,
    templateSnapshot: null,
    values: {},
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("buildMeasurementDetailNotice", () => {
  it("returns the read-only notice copy", () => {
    const notice = buildMeasurementDetailNotice();
    assert.ok(notice.length > 0);
    assert.match(notice, /Solo lectura/i);
  });
});

describe("renderMeasurementDetailView composition", () => {
  it("wraps the measurement detail inside AppShell with patient + session context", () => {
    const patient = buildMeasurementPatient();
    const measurement = buildMeasurement();
    const view = renderMeasurementDetailView({
      user: { fullName: "Staff Lead" },
      patient,
      measurement,
      children: null,
    });

    assert.equal(view.type, AppShell);
    const props = readMeasurementDetailViewProps(view);
    assert.equal(props.currentPath, "/patients/pat-1/measurements/sess-1");
    assert.equal(props.title, "Detalle de medición");
    assert.equal(props.kicker, MEASUREMENT_DETAIL_VIEW_KICKER);
    assert.ok((props.description ?? "").includes("Ada Lovelace"));
    assert.equal(props.userLabel, "Bienvenido, Staff Lead");
  });

  it("passes the read-only children through unchanged", () => {
    const marker = { __marker: true } as unknown as ReactNode;
    const view = renderMeasurementDetailView({
      user: { fullName: null },
      patient: buildMeasurementPatient(),
      measurement: buildMeasurement(),
      children: marker,
    });
    const props = readMeasurementDetailViewProps(view);
    assert.equal(props.children, marker);
  });

  it("falls back to a neutral userLabel when fullName is missing", () => {
    const view = renderMeasurementDetailView({
      user: { fullName: null },
      patient: buildMeasurementPatient(),
      measurement: buildMeasurement(),
      children: null,
    });
    const props = readMeasurementDetailViewProps(view);
    assert.equal(props.userLabel, "Bienvenido");
  });
});

describe("MeasurementDetailPage route", () => {
  const MeasurementDetailBodyStub: ComponentType<{
    patient: MeasurementDetailViewPatient;
    measurement: MeasurementDetailViewMeasurement;
  }> = () => null;

  function defaultDeps(overrides: Record<string, unknown> = {}) {
    return {
      readUser: async (): Promise<MeasurementDetailViewUser & { id: string; role: string }> => ({
        id: "staff-1",
        role: "STAFF",
        fullName: "Staff Lead",
      }),
      loadPatient: async (id: string) => ({
        ok: true as const,
        value: buildMeasurementPatient({ id }),
      }),
      loadMeasurement: async (sessionId: string, patientId: string) => ({
        ok: true as const,
        value: buildMeasurement({ id: sessionId, patientId }),
      }),
      loadBody: async () => ({ default: MeasurementDetailBodyStub }),
      ...overrides,
    };
  }

  it("renders the measurement detail inside AppShell after authenticating the user", async () => {
    const view = await MeasurementDetailPage(
      { params: Promise.resolve({ id: "pat-1", sessionId: "sess-1" }) },
      defaultDeps(),
    );

    assert.equal(view.type, AppShell);
    const props = readMeasurementDetailViewProps(view);
    assert.equal(props.currentPath, "/patients/pat-1/measurements/sess-1");
  });
});

describe("capture page stays outside AppShell", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const capturePath = resolve(
    here,
    "..",
    "app",
    "patients",
    "[id]",
    "measurements",
    "new",
    "page.tsx",
  );
  const captureSource = readFileSync(capturePath, "utf8");

  it("does not import AppShell in the capture route", () => {
    assert.ok(
      !/from\s+["'][^"']*app-shell[^"']*["']/.test(captureSource),
      "capture route must remain full-screen and not import AppShell",
    );
  });

  it("does not reference the <AppShell> JSX in the capture route", () => {
    assert.ok(
      !/<\s*AppShell\b/.test(captureSource),
      "capture route must not wrap its render in <AppShell>",
    );
  });
});

describe("resolveGarmentSelectValue — garment selector reload adapter", () => {
  it("returns the catalog reference when a valid snapshot is present in metadata", () => {
    const metadata = {
      garmentSnapshot: {
        reference: "MR",
        label: "Media a la Rodilla Par Adulto",
        family: "Lower limb",
        figureKey: GARMENT_FIGURE_KEY.LOWER_LIMB,
      },
    };

    assert.equal(resolveGarmentSelectValue("MR", metadata), "MR");
  });

  it("returns the garmentType reference when no snapshot is present but the reference is in the catalog", () => {
    assert.equal(resolveGarmentSelectValue("MRD", null), "MRD");
  });

  it("returns the legacy free-text garmentType when the value is not a known catalog reference", () => {
    assert.equal(resolveGarmentSelectValue("Media hasta rodilla", null), "Media hasta rodilla");
  });

  it("returns empty string when garmentType is null and no snapshot is present", () => {
    assert.equal(resolveGarmentSelectValue(null, null), "");
  });

  it("snapshot reference wins over a different garmentType string", () => {
    const metadata = {
      garmentSnapshot: {
        reference: "MRD",
        label: "Media a la Rodilla Derecha Adulto",
        family: "Lower limb",
        figureKey: GARMENT_FIGURE_KEY.LOWER_LIMB,
      },
    };

    assert.equal(resolveGarmentSelectValue("old-legacy-text", metadata), "MRD");
  });
});

describe("resolveLegacyGarmentSelectOption — legacy free-text fallback option", () => {
  it("returns a selectable fallback option for legacy free-text not in the catalog", () => {
    assert.deepEqual(resolveLegacyGarmentSelectOption("Media hasta rodilla"), {
      value: "Media hasta rodilla",
      label: "Media hasta rodilla (texto libre anterior)",
    });
  });

  it("returns null for a known catalog reference (no fallback needed)", () => {
    assert.equal(resolveLegacyGarmentSelectOption("MR"), null);
  });

  it("returns null when the value is empty, whitespace, or null", () => {
    assert.equal(resolveLegacyGarmentSelectOption(""), null);
    assert.equal(resolveLegacyGarmentSelectOption("   "), null);
    assert.equal(resolveLegacyGarmentSelectOption(null), null);
    assert.equal(resolveLegacyGarmentSelectOption(undefined), null);
  });

  it("trims the legacy value before building the fallback option", () => {
    assert.deepEqual(resolveLegacyGarmentSelectOption("  Funda vieja  "), {
      value: "Funda vieja",
      label: "Funda vieja (texto libre anterior)",
    });
  });
});

describe("isGarmentSelectionValid — required garment guard on create", () => {
  it("accepts a known catalog reference", () => {
    assert.equal(isGarmentSelectionValid("MR"), true);
  });

  it("accepts a non-empty legacy free-text value (edit flow)", () => {
    assert.equal(isGarmentSelectionValid("Media hasta rodilla"), true);
  });

  it("rejects empty, whitespace-only, null, or undefined", () => {
    assert.equal(isGarmentSelectionValid(""), false);
    assert.equal(isGarmentSelectionValid("   "), false);
    assert.equal(isGarmentSelectionValid(null), false);
    assert.equal(isGarmentSelectionValid(undefined), false);
  });
});

describe("garment display contract for edit/reload (visible representation)", () => {
  it("derives the legacy free-text as visible garment text on reload", () => {
    // GIVEN a legacy measurement with free-text garmentType and no snapshot
    // THEN the UI can derive a visible label (the legacy text itself)
    assert.equal(resolveGarmentDisplay("Media hasta rodilla", null), "Media hasta rodilla");
  });

  it("prefers the snapshot label/reference over the stored garmentType on reload", () => {
    const metadata = {
      garmentSnapshot: {
        reference: "MR",
        label: "Media a la Rodilla Par Adulto",
        family: "Lower limb",
        figureKey: GARMENT_FIGURE_KEY.LOWER_LIMB,
      },
    };
    assert.equal(
      resolveGarmentDisplay("legacy-noise", metadata),
      "Media a la Rodilla Par Adulto (MR)",
    );
  });
});
