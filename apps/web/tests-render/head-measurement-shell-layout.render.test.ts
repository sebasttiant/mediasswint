import assert from "node:assert/strict";
import { createElement } from "react";
import { describe, it } from "node:test";

import { HeadMeasurementShellLayout } from "../app/patients/[id]/measurements/new/_components/head-measurement-shell-layout";
import type { MeasurementUiField } from "../app/patients/[id]/measurements/measurements-ui";
import { getHeadViewComposition } from "../lib/head-measurement-layout";
import { attributeValues, render, textContent } from "./support/render";

const mentonera = getHeadViewComposition("mentonera-v1");

const fields: MeasurementUiField[] = [
  {
    key: "mentoneraCrownChin",
    label: "Contorno mentón-coronilla",
    unit: "cm",
    minValue: 0.1,
    maxValue: 200,
    metadata: { anatomyZone: "head.crownChin", kind: "circumference" },
    value: null,
  },
  {
    key: "mentoneraFaceLength",
    label: "Largo de cara",
    unit: "cm",
    minValue: 0.1,
    maxValue: 200,
    metadata: { anatomyZone: "head.faceLength", kind: "length" },
    value: null,
  },
  {
    key: "mentoneraNeck",
    label: "Contorno de cuello",
    unit: "cm",
    minValue: 0.1,
    maxValue: 200,
    metadata: { anatomyZone: "head.neck", kind: "circumference" },
    value: null,
  },
];

function renderLayout(overrides: { fields?: MeasurementUiField[]; warning?: string | null } = {}) {
  assert.ok(mentonera);
  return render(
    createElement(HeadMeasurementShellLayout, {
      composition: mentonera,
      visibleHeadZoneKeys: mentonera.zoneKeys,
      sex: "FEMALE",
      activeZoneId: null,
      filledZoneIds: new Set(),
      fields: overrides.fields ?? fields,
      valuesByKey: {},
      onFocus: () => undefined,
      onChange: () => undefined,
      onZoneClick: () => undefined,
      warning: overrides.warning,
      footer: createElement("button", { type: "button" }, "Finalizar"),
    }),
  );
}

describe("head measurement shell — rendered clinician contract", () => {
  it("renders the garment figure, all editable measurements, and the finalize control", () => {
    const markup = renderLayout();

    assert.deepEqual(attributeValues(markup, "data-head-layout"), ["mobile", "desktop"]);
    assert.deepEqual(attributeValues(markup, "data-anatomy-zone").sort(), [
      "head.crownChin",
      "head.crownChin",
      "head.faceLength",
      "head.faceLength",
      "head.neck",
      "head.neck",
    ]);
    assert.match(textContent(markup), /Mentonera/);
    assert.match(textContent(markup), /Finalizar/);
  });

  it("makes an unusable snapshot visible as an alert instead of a blank form", () => {
    const markup = renderLayout({ fields: [], warning: "No se puede finalizar hasta regenerarla." });

    assert.ok(attributeValues(markup, "role").includes("alert"));
    assert.match(textContent(markup), /No se puede finalizar hasta regenerarla/);
    assert.match(textContent(markup), /No hay medidas disponibles para Mentonera/);
  });
});
