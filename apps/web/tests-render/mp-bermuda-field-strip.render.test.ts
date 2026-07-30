import assert from "node:assert/strict";
import { createElement } from "react";
import { describe, it } from "node:test";

import { MpBermudaFieldStrip } from "../app/patients/[id]/measurements/new/_components/mp-bermuda-field-strip";
import {
  buildMpBermudaFieldStripItems,
  type MpBermudaFieldStripItem,
} from "../app/patients/[id]/measurements/measurements-ui";
import type { TemplateSnapshot, TemplateSnapshotField } from "../lib/measurements";
import { buildMpBermudaTemplate } from "../lib/mp-bermuda-template";
import { countAttributeValue, openingTagFor, render, textContent } from "./support/render";

/** Frozen-snapshot shape of the canonical catalog — never a second definition. */
function snapshot(
  override: (field: TemplateSnapshotField) => TemplateSnapshotField = (field) => field,
): TemplateSnapshot {
  const template = buildMpBermudaTemplate();
  return {
    templateId: "tpl-mp-bermuda", code: template.code, name: template.name,
    version: template.version, description: template.description,
    sections: template.sections.map((section) => ({
      title: section.title, sortOrder: section.sortOrder,
      fields: section.fields.map((field) => override({ ...field, id: `fld-${field.key}`, metadata: { ...field.metadata } })),
    })),
  };
}

const items = buildMpBermudaFieldStripItems(snapshot());

function itemFor(key: string): MpBermudaFieldStripItem | undefined {
  return items.find((item) => item.key === key);
}

function strip(props: Partial<Parameters<typeof MpBermudaFieldStrip>[0]> = {}): string {
  return render(createElement(MpBermudaFieldStrip, { items, valuesByKey: {}, onChange: () => undefined, ...props }));
}

describe("MP/Bermuda textual fallback", () => {
  it("projects every canonical field with side ownership, station and endpoint context", () => {
    assert.equal(items.length, 55);
    assert.equal(items.filter((item) => item.side === "right").length, 25);
    assert.equal(items.filter((item) => item.side === "left").length, 25);
    assert.equal(items.filter((item) => item.side === "shared").length, 5);
    assert.equal(items.every((item) => item.isRequired), true);

    assert.deepEqual({ ...itemFor("mpRightKneeCircumference") }, {
      key: "mpRightKneeCircumference", label: "Contorno Rodilla derecha", unit: "cm",
      minValue: 0.1, maxValue: 300, isRequired: true,
      side: "right", station: "Rodilla", endpoints: null,
    });
    assert.equal(itemFor("mpLeftWaistToHipDistance")?.endpoints, "Cintura → Cadera");
    assert.equal(itemFor("mpLeftWaistToHipDistance")?.station, null);
    assert.equal(itemFor("mpHeight")?.side, "shared");
    assert.equal(itemFor("mpHeight")?.endpoints, null);
    assert.equal(itemFor("mpWaistToGlutealFoldLength")?.endpoints, "Cintura → Pliegue de la nalga");
  });

  it("keeps a field usable when its presentation metadata is unusable or it is optional", () => {
    const degraded = buildMpBermudaFieldStripItems(snapshot((field) => field.key === "mpWeight"
      ? { ...field, isRequired: false, metadata: { layout: "mp-bermuda", side: "other", stationId: 42 } }
      : field));

    assert.equal(degraded.length, 55);
    assert.deepEqual({ ...degraded.find((item) => item.key === "mpWeight") }, {
      key: "mpWeight", label: "Peso", unit: "kg", minValue: 1, maxValue: 500,
      isRequired: false, side: null, station: null, endpoints: null,
    });

    const input = openingTagFor(strip({ items: degraded }), "id", "mp-field-mpWeight") ?? "";
    assert.match(input, /^<input/);
    assert.match(input, /aria-required="false"/);
    assert.doesNotMatch(input, /\srequired[\s/>]/);
    assert.match(textContent(strip({ items: degraded })), /Peso Pendiente Opcional Sin contexto anatómico disponible/);
  });

  it("never leaks unknown or inherited endpoint metadata and excludes foreign layouts", () => {
    const foreign = { id: "x", key: "compressionLegR1", label: "Punto 1", fieldType: "NUMBER" as const, unit: "cm", isRequired: true, sortOrder: 99, minValue: 1, maxValue: 2, metadata: { group: "legs", side: "right", point: 1 } };
    const base = snapshot((field) => field.key === "mpRightWaistToHipDistance"
      ? { ...field, metadata: { ...field.metadata, stationId: "internal_debug_id", fromStationId: "toString" } }
      : field);
    const mixed = buildMpBermudaFieldStripItems({ ...base, sections: [...base.sections, { title: "Foreign", sortOrder: 9, fields: [foreign] }] });
    const malformed = mixed.find((item) => item.key === "mpRightWaistToHipDistance");

    assert.equal(mixed.length, 55);
    assert.equal(mixed.some((item) => item.key === "compressionLegR1"), false);
    assert.deepEqual({ station: malformed?.station, endpoints: malformed?.endpoints }, { station: null, endpoints: null });
    assert.doesNotMatch(textContent(strip({ items: mixed })), /internal_debug_id|function toString/);
  });

  it("renders label, side, endpoints and required state as text without any drawing", () => {
    const markup = strip();
    const text = textContent(markup);

    assert.equal(markup.includes("<svg"), false);
    assert.equal(countAttributeValue(markup, "data-mp-field-state", "pending"), 55);
    assert.equal(countAttributeValue(markup, "aria-required", "true"), 55);
    assert.match(markup, /<label for="mp-field-mpRightKneeCircumference"/);
    assert.match(markup, /<input[^>]*id="mp-field-mpRightKneeCircumference"[^>]*required/);
    assert.match(text, /Contorno Rodilla derecha Pendiente Obligatoria Lado derecho · Rodilla/);
    assert.match(text, /Lado izquierdo · Cintura → Cadera/);
    assert.match(text, /Estatura Pendiente Obligatoria Medida compartida/);
  });

  it("exposes pending, filled and active completion states independently", () => {
    const markup = strip({
      valuesByKey: { mpHeight: "170", mpRightKneeCircumference: "38" },
      activeFieldKey: "mpRightKneeCircumference",
    });
    const filled = openingTagFor(markup, "data-mp-field-key", "mpHeight") ?? "";
    const active = openingTagFor(markup, "data-mp-field-key", "mpRightKneeCircumference") ?? "";

    assert.match(filled, /data-mp-field-state="filled"/);
    assert.match(filled, /data-filled="true"/);
    assert.doesNotMatch(filled, /aria-current/);
    assert.doesNotMatch(openingTagFor(markup, "data-mp-field-key", "mpWeight") ?? "", /data-filled/);

    assert.match(active, /data-mp-field-state="active"/);
    assert.match(active, /data-filled="true"/);
    assert.match(active, /aria-current="true"/);
    assert.match(textContent(markup), /Contorno Rodilla derecha Activa/);
  });

  it("exposes validation errors through native describedby and alert semantics", () => {
    const markup = strip({ errorsByKey: { mpWeight: "Ingresá el peso en kg" } });
    const input = openingTagFor(markup, "id", "mp-field-mpWeight") ?? "";

    assert.match(input, /aria-invalid="true"/);
    assert.match(input, /aria-describedby="mp-field-mpWeight-context mp-field-mpWeight-error"/);
    assert.match(markup, /role="alert"[^>]*>Ingresá el peso en kg/);
    assert.doesNotMatch(openingTagFor(markup, "id", "mp-field-mpHeight") ?? "", /aria-invalid/);
  });
});
