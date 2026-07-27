import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidElement, type ReactNode } from "react";

import { HeadMeasurementFieldStrip } from "../app/patients/[id]/measurements/new/_components/head-measurement-field-strip";
import type { MeasurementUiField } from "../app/patients/[id]/measurements/measurements-ui";

type InputProps = {
  onFocus?: () => void;
  onChange?: (event: { target: { value: string } }) => void;
};

function getInputs(node: ReactNode): InputProps[] {
  if (Array.isArray(node)) return node.flatMap(getInputs);
  if (!isValidElement(node)) return [];

  const props = node.props as { children?: ReactNode } & InputProps;
  const inputs = node.type === "input" ? [props] : [];
  return [...inputs, ...getInputs(props.children)];
}

const fields: MeasurementUiField[] = [
  {
    key: "mentoneraCrownChin",
    label: "Crown to chin circumference",
    unit: "cm",
    minValue: 0.1,
    maxValue: 200,
    metadata: { anatomyZone: "head.crownChin", kind: "circumference" },
    value: null,
  },
  {
    key: "mentoneraFaceLength",
    label: "Forehead to chin length",
    unit: "cm",
    minValue: 0.1,
    maxValue: 200,
    metadata: { anatomyZone: "head.faceLength", kind: "length" },
    value: null,
  },
  {
    key: "mentoneraNeck",
    label: "Neck circumference",
    unit: "cm",
    minValue: 0.1,
    maxValue: 200,
    metadata: { anatomyZone: "head.neck", kind: "circumference" },
    value: null,
  },
];

describe("HeadMeasurementFieldStrip focus synchronization", () => {
  it("activates the corresponding head zone when each measurement input receives focus", () => {
    const focusedZones: string[] = [];
    const tree = HeadMeasurementFieldStrip({
      title: "Mentonera",
      fields,
      valuesByKey: {},
      activeZoneId: null,
      onFocus: (zoneId: string) => focusedZones.push(zoneId),
      onChange: () => undefined,
    });

    const inputs = getInputs(tree);
    assert.equal(inputs.length, 3);

    for (const input of inputs) input.onFocus?.();

    assert.deepEqual(focusedZones, ["head.crownChin", "head.faceLength", "head.neck"]);
  });

  it("keeps the active head zone synchronized when a measurement value changes", () => {
    const focusedZones: string[] = [];
    const changedValues: Array<[string, string]> = [];
    const tree = HeadMeasurementFieldStrip({
      title: "Mentonera",
      fields,
      valuesByKey: {},
      activeZoneId: null,
      onFocus: (zoneId: string) => focusedZones.push(zoneId),
      onChange: (key: string, value: string) => changedValues.push([key, value]),
    });

    const neckInput = getInputs(tree)[2];
    assert.ok(neckInput?.onChange);
    neckInput.onChange({ target: { value: "36" } });

    assert.deepEqual(focusedZones, ["head.neck"]);
    assert.deepEqual(changedValues, [["mentoneraNeck", "36"]]);
  });
});
