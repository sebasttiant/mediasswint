import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MeasurementDetailBody from "../app/patients/[id]/measurements/[sessionId]/measurement-detail-body";
import type { MeasurementDetailViewMeasurement, MeasurementDetailViewPatient } from "../app/patients/[id]/measurements/[sessionId]/measurement-detail-view";
import { buildMpBermudaTemplate } from "../lib/mp-bermuda-template";

// Marks the generic (non-MP) rendering path: the anatomical figure rail only
// exists there, so its absence is how we prove a session did NOT fall through
// to it, and its presence is how we prove a foreign session still owns it.
const FIGURE_RAIL = "Zonas anatómicas";

function patient(): MeasurementDetailViewPatient {
  return {
    id: "p1",
    fullName: "Test",
    name: "Test",
    documentType: null,
    documentNumber: null,
    birthDate: null,
    sex: "male",
    phone: null,
    email: null,
    healthInsuranceName: null,
  } as unknown as MeasurementDetailViewPatient;
}

function measurement(templateSnapshot: unknown, values: Record<string, number | null> = {}): MeasurementDetailViewMeasurement {
  return {
    id: "s1",
    // DRAFT keeps the duplicate-session button (a client component calling
    // useRouter) out of a server-side static render.
    status: "DRAFT",
    measuredAt: new Date("2026-01-01T00:00:00Z"),
    garmentType: null,
    compressionClass: null,
    diagnosis: null,
    notes: null,
    metadata: {},
    templateSnapshot,
    values,
  } as unknown as MeasurementDetailViewMeasurement;
}

type MutableSnapshot = {
  code: string;
  sections: Array<{ fields: Array<{ key: string; metadata: { markerId?: string } }> }>;
};

function mpSnapshot(): MutableSnapshot {
  const template = buildMpBermudaTemplate();
  return {
    templateId: "tpl",
    code: template.code,
    name: template.name,
    version: template.version,
    description: template.description,
    sections: template.sections.map((section, sectionIndex) => ({
      title: section.title,
      sortOrder: sectionIndex,
      fields: section.fields.map((field, fieldIndex) => ({
        ...field,
        id: `f-${field.key}`,
        sortOrder: fieldIndex,
        metadata: { ...field.metadata },
      })),
    })),
  } as unknown as MutableSnapshot;
}

function render(session: MeasurementDetailViewMeasurement): string {
  return renderToStaticMarkup(
    createElement(MeasurementDetailBody, {
      patient: patient(),
      measurement: session,
      isAdmin: false,
    } as never) as React.ReactElement,
  );
}

describe("MP/Bermuda measurement detail body (W7)", () => {
  it("renders a structured MP/Bermuda summary when the snapshot is complete", () => {
    const markup = render(measurement(mpSnapshot(), { mpHeight: 170, mpWeight: 70 }));

    assert.match(markup, /Medidas MP\/Bermuda/);
    assert.match(markup, /Estatura/);
    assert.match(markup, /<td data-label="Valor">170<\/td>/);
    assert.match(markup, /<td data-label="Valor">70<\/td>/);
    // A complete snapshot carries no degradation notice and no raw dump.
    assert.equal(markup.includes("No pudimos leer la plantilla"), false);
    assert.equal(markup.includes(FIGURE_RAIL), false);
  });

  // Regression guard. `classifyMpBermudaSnapshot` answers "not MP" for foreign
  // templates; if that ever collapses back into a degraded MP state, every
  // compression, Mentonera and Máscara session in the clinical history loses its
  // figure and tables to an MP fallback.
  it("leaves a foreign (compression) snapshot on its own rendering path", () => {
    const foreign = { ...mpSnapshot(), code: "compression-v1" };
    const markup = render(measurement(foreign, { mpHeight: 170 }));

    assert.match(markup, new RegExp(FIGURE_RAIL));
    assert.match(markup, /Piernas|Brazos/);
    assert.equal(markup.includes("Medidas MP/Bermuda"), false);
    assert.equal(markup.includes("No pudimos leer la plantilla"), false);
  });

  it("keeps the existing empty state for a session with no readable snapshot", () => {
    const markup = render(measurement(null));

    assert.match(markup, /La medición no tiene snapshot de plantilla\./);
    assert.equal(markup.includes("Medidas MP/Bermuda"), false);
  });

  it("falls back to a raw key/value table when an MP snapshot keeps its code but loses its fields", () => {
    const gutted = { ...mpSnapshot(), sections: [] };
    const markup = render(measurement(gutted, { mpHeight: 170, mpWeight: null }));

    assert.match(markup, /No pudimos leer la plantilla de medidas de esta sesión/);
    assert.match(markup, /<td data-label="Clave">mpHeight<\/td>/);
    assert.match(markup, /<td data-label="Valor">170<\/td>/);
    // A stored null is shown as an explicit blank, never dropped from the dump.
    assert.match(markup, /<td data-label="Clave">mpWeight<\/td>/);
  });

  it("renders visual-degraded MP snapshots textually, with a Spanish notice and no figure", () => {
    const degraded = mpSnapshot();
    for (const section of degraded.sections) {
      for (const field of section.fields) {
        delete field.metadata.markerId;
      }
    }
    const markup = render(measurement(degraded, { mpHeight: 170 }));

    assert.match(markup, /Estatura/);
    assert.match(markup, /<td data-label="Valor">170<\/td>/);
    assert.match(markup, /no conserva las marcas visuales/);
    assert.equal(markup.includes(FIGURE_RAIL), false);
  });

  it("still shows the stored values of a clinical-incomplete MP snapshot, with a Spanish notice", () => {
    const incomplete = mpSnapshot();
    const dropped = incomplete.sections[0]!.fields.pop()!;
    const markup = render(measurement(incomplete, { mpHeight: 170 }));

    assert.match(markup, /no coincide con el contrato clínico/);
    assert.match(markup, /<td data-label="Valor">170<\/td>/);
    assert.equal(markup.includes(dropped.key), false);
  });

  // The classifier's `reason` is a diagnostic string for logs and tests. It must
  // never reach a clinician: this UI is Spanish end to end.
  it("never leaks the classifier's English diagnostic into the rendered page", () => {
    const degraded = mpSnapshot();
    for (const section of degraded.sections) {
      for (const field of section.fields) {
        delete field.metadata.markerId;
      }
    }

    for (const session of [measurement(degraded), measurement({ ...mpSnapshot(), sections: [] })]) {
      const markup = render(session);
      assert.equal(markup.includes("Visual marker metadata is unavailable."), false);
      assert.equal(markup.includes("Unreadable MP/Bermuda snapshot."), false);
      assert.equal(markup.includes("clinical field contract is incomplete"), false);
    }
  });
});
