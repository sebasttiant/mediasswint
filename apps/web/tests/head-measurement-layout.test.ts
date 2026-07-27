import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHeadFigureAriaLabel,
  buildHeadFigureDescription,
  getHeadViewComposition,
  HEAD_FIGURE_FRONT_CROP,
  HEAD_FIGURE_FULL_CROP,
  HEAD_MEASUREMENT_TEMPLATE_CODES,
  isHeadMeasurementTemplateCode,
  parseHeadZoneKey,
} from "../lib/head-measurement-layout";

const mentonera = getHeadViewComposition("mentonera-v1");
const mascara = getHeadViewComposition("mascara-v1");

// The approved Mentonera figure height. Every other composition must render at
// or under it so the whole figure clears the sticky footer.
const FOOTER_SAFE_HEIGHT_PX = 418;

function renderedHeightPx(composition: NonNullable<typeof mentonera>): number {
  return (composition.crop.height / composition.crop.width) * composition.maxWidthPx;
}

describe("head view composition contract", () => {
  it("registers exactly the two head garments", () => {
    assert.deepEqual([...HEAD_MEASUREMENT_TEMPLATE_CODES].sort(), ["mascara-v1", "mentonera-v1"]);
    assert.equal(isHeadMeasurementTemplateCode("compression-v1"), false);
    assert.equal(getHeadViewComposition("compression-v1"), null);
  });

  it("MÁSCARA is FRONT-ONLY, matching the client form's MÁSCARA panel", () => {
    assert.ok(mascara);
    assert.deepEqual([...mascara.panels], ["front"]);
    assert.deepEqual([...mascara.zoneKeys], ["head.forehead.front", "head.neck.front"]);
    // Not a single profile marker may be declared.
    assert.equal(
      mascara.zoneKeys.some((key) => key.endsWith(".profile")),
      false,
    );
  });

  it("MÁSCARA crops the profile head out of the traced figure", () => {
    assert.ok(mascara);
    assert.deepEqual({ ...mascara.crop }, { ...HEAD_FIGURE_FRONT_CROP });
    // The traced profile ink starts at x=179.22; the crop must end before it
    // and after the front ink's right edge (x=138.20).
    assert.ok(mascara.crop.width > 138.2, "crop must not clip the front head");
    assert.ok(mascara.crop.width < 179.22, "crop must exclude the profile head");
  });

  it("MENTONERA keeps front + profile at the user-approved 560px scale", () => {
    assert.ok(mentonera);
    assert.deepEqual([...mentonera.panels], ["front", "profile"]);
    assert.deepEqual({ ...mentonera.crop }, { ...HEAD_FIGURE_FULL_CROP });
    assert.equal(mentonera.maxWidthPx, 560);
    assert.deepEqual(
      [...mentonera.zoneKeys],
      [
        "head.crownChin.profile",
        "head.faceLength.profile",
        "head.neck.profile",
        "head.neck.front",
      ],
    );
  });

  it("every composition renders within the footer-safe height", () => {
    assert.ok(mentonera && mascara);
    assert.ok(
      Math.round(renderedHeightPx(mentonera)) <= FOOTER_SAFE_HEIGHT_PX,
      `Mentonera renders ${renderedHeightPx(mentonera)}px tall`,
    );
    assert.ok(
      Math.round(renderedHeightPx(mascara)) <= FOOTER_SAFE_HEIGHT_PX,
      `Máscara renders ${renderedHeightPx(mascara)}px tall`,
    );
  });

  it("expected fields match the authoritative PDF panels", () => {
    assert.ok(mentonera && mascara);
    assert.deepEqual(
      mascara.expectedFields.map(([key]) => key),
      ["mascaraForehead", "mascaraNeck"],
    );
    assert.deepEqual(
      mentonera.expectedFields.map(([key]) => key),
      ["mentoneraCrownChin", "mentoneraFaceLength", "mentoneraNeck"],
    );
  });

  it("parses zone keys back into zone and panel", () => {
    assert.deepEqual(parseHeadZoneKey("head.neck.front"), {
      zoneId: "head.neck",
      panel: "front",
    });
    assert.deepEqual(parseHeadZoneKey("head.crownChin.profile"), {
      zoneId: "head.crownChin",
      panel: "profile",
    });
    assert.equal(parseHeadZoneKey("head.neck"), null);
  });
});

describe("generated accessibility text", () => {
  it("describes Máscara by its own garment, views and measurements", () => {
    assert.ok(mascara);
    const description = buildHeadFigureDescription(mascara);

    assert.match(description, /Máscara/);
    assert.match(description, /vista frontal/);
    assert.match(description, /2 medidas/);
    assert.match(description, /Contorno de la cabeza alrededor de la frente/);
    assert.match(description, /Contorno de cuello/);
    // The old hardcoded sentence must never reappear.
    assert.doesNotMatch(description, /mentonera/i);
    assert.doesNotMatch(description, /3 medidas/);
  });

  it("describes Mentonera with both views and its three measurements", () => {
    assert.ok(mentonera);
    const description = buildHeadFigureDescription(mentonera);

    assert.match(description, /Mentonera/);
    assert.match(description, /vistas frontal y de perfil/);
    assert.match(description, /3 medidas/);
    assert.doesNotMatch(description, /Máscara/);
  });

  it("describes a DEGRADED figure by the markers actually painted, not the full set", () => {
    assert.ok(mentonera);
    const description = buildHeadFigureDescription(mentonera, ["head.neck.front"]);

    assert.match(description, /1 medida:/);
    assert.match(description, /Contorno de cuello/);
    assert.doesNotMatch(description, /3 medidas/);
  });

  it("states explicitly when no measurement is available", () => {
    assert.ok(mascara);
    const description = buildHeadFigureDescription(mascara, []);
    assert.match(description, /Sin medidas disponibles/);
  });

  it("builds a garment-specific aria-label", () => {
    assert.ok(mentonera && mascara);
    assert.match(buildHeadFigureAriaLabel(mascara), /Máscara/);
    assert.match(buildHeadFigureAriaLabel(mentonera), /Mentonera/);
  });

  // NOTE: this module deliberately does NOT assert what body-highlight.tsx
  // contains. The previous revision read that file as text and required
  // `buildHeadFigureDescription(` to appear in it, which made this commit
  // depend on a LATER one and proved nothing about behaviour. The renderer's
  // use of these builders is proven by rendering the renderer — see
  // tests/body-highlight-head-render.test.ts, which ships with it.
});
