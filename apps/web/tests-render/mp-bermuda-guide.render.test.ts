import assert from "node:assert/strict";
import { createElement } from "react";
import { describe, it } from "node:test";

import { buildMpBermudaTemplate } from "../lib/mp-bermuda-template";
import {
  MpBermudaGuide,
  resolveMpBermudaMarkers,
} from "../app/patients/[id]/measurements/new/_components/mp-bermuda-guide";
import { attributeValues, countAttributeValue, render } from "./support/render";

const fields = buildMpBermudaTemplate().sections.flatMap((section) => section.fields);

describe("MpBermudaGuide — rendered clinical guidance", () => {
  it("projects all catalog markers with bilateral ownership and accessible station context", () => {
    const markers = resolveMpBermudaMarkers(fields);
    const markup = render(createElement(MpBermudaGuide));

    assert.ok(markers);
    assert.equal(markers.length, 55);
    assert.equal(markers.filter((marker) => marker.side === "right").length, 25);
    assert.equal(markers.filter((marker) => marker.side === "left").length, 25);
    assert.equal(markers.filter((marker) => marker.side === "shared").length, 5);
    const rightKnee = markers.find((marker) => marker.key === "mpRightKneeCircumference");
    assert.deepEqual(
      { side: rightKnee?.side, stationId: rightKnee?.stationId, shape: rightKnee?.shape },
      { side: "right", stationId: "knee", shape: "station" },
    );
    assert.match(markup, /aria-label="Contorno Rodilla derecha; right"/);
    assert.match(markup, /aria-label="Distancia Cintura a Cadera izquierda; waist a hip; left"/);
    assert.equal(countAttributeValue(markup, "data-mp-marker-side", "right"), 25);
    assert.equal(countAttributeValue(markup, "data-mp-marker-side", "left"), 25);
    assert.equal(countAttributeValue(markup, "data-mp-marker-side", "shared"), 5);
  });

  it("exposes active and filled state through non-color semantic attributes", () => {
    const markup = render(
      createElement(MpBermudaGuide, {
        activeMarkerId: "right-knee-circumference",
        filledMarkerIds: new Set(["left-waist-to-hip-distance"]),
      }),
    );

    assert.equal(attributeValues(markup, "data-mp-marker-state").length, 55);
    assert.match(markup, /data-mp-marker-id="right-knee-circumference"[^>]*data-mp-marker-state="active"[^>]*aria-current="true"/);
    assert.match(markup, /data-mp-marker-id="left-waist-to-hip-distance"[^>]*data-mp-marker-state="filled"[^>]*data-filled="true"/);
  });

  it("keeps completion exposed when the active marker is already filled", () => {
    const markup = render(
      createElement(MpBermudaGuide, {
        activeMarkerId: "right-knee-circumference",
        filledMarkerIds: new Set(["right-knee-circumference"]),
      }),
    );

    assert.match(markup, /data-mp-marker-id="right-knee-circumference"[^>]*data-mp-marker-state="active"[^>]*data-filled="true"[^>]*aria-current="true"/);
  });

  it("fails closed when catalog geometry metadata is malformed", () => {
    const malformed = fields.map((field) =>
      field.key === "mpRightKneeCircumference"
        ? { ...field, metadata: { ...field.metadata, stationId: "unknown" } }
        : field,
    );

    assert.equal(resolveMpBermudaMarkers(malformed), null);
    assert.equal(render(createElement(MpBermudaGuide, { fields: malformed })), "");
  });

  it("fails closed for missing metadata and invalid metadata shapes", () => {
    const malformedFields = [
      fields.map((field) => field.key === "mpHeight" ? { ...field, metadata: undefined } : field),
      fields.map((field) => field.key === "mpRightKneeCircumference" ? { ...field, metadata: { ...field.metadata, side: "other" } } : field),
      fields.map((field) => field.key === "mpRightKneeCircumference" ? { ...field, metadata: { ...field.metadata, kind: "other" } } : field),
      fields.map((field) => field.key === "mpRightWaistToHipDistance" ? { ...field, metadata: { ...field.metadata, toStationId: "other" } } : field),
    ];

    for (const malformed of malformedFields) {
      const unsafeFields = malformed as unknown as typeof fields;
      assert.equal(resolveMpBermudaMarkers(unsafeFields), null);
      assert.equal(render(createElement(MpBermudaGuide, { fields: unsafeFields })), "");
    }
  });
});
