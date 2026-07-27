import assert from "node:assert/strict";
import { createElement } from "react";
import { describe, it } from "node:test";

import { BodyHighlight } from "../app/_components/body-highlight/body-highlight";
import { getHeadViewComposition, parseHeadZoneKey } from "../lib/head-measurement-layout";
import {
  attributeValues,
  countAttributeValue,
  hasAttributeValue,
  render,
  textContent,
} from "./support/render";

/**
 * RENDERED behaviour for the head figure.
 *
 * This is the coverage the previous chain could not have: it renders the real
 * component and asserts what a clinician sees. It deliberately does NOT read
 * implementation source, pin Tailwind class strings, or compare SVG path data —
 * the earlier suite did all three and still missed that Máscara drew a bare
 * profile head.
 *
 * Neither does it re-implement any filtering: the composition comes from
 * production (`getHeadViewComposition`) and the assertions are about the markup
 * that came out.
 */

const mentonera = getHeadViewComposition("mentonera-v1");
const mascara = getHeadViewComposition("mascara-v1");

function renderHead(
  composition: NonNullable<typeof mentonera>,
  options: {
    visibleHeadZoneKeys?: ReadonlyArray<string>;
    filledZoneIds?: ReadonlyArray<string>;
    activeZoneId?: string | null;
  } = {},
): string {
  return render(
    createElement(BodyHighlight, {
      view: "head",
      sex: "FEMALE",
      headComposition: composition,
      visibleHeadZoneKeys: options.visibleHeadZoneKeys ?? composition.zoneKeys,
      filledZoneIds: options.filledZoneIds ?? [],
      activeZoneId: options.activeZoneId ?? null,
    } as never),
  );
}

describe("head figure — rendered garment composition", () => {
  it("MÁSCARA renders the front head only", () => {
    assert.ok(mascara);
    const markup = renderHead(mascara);

    const panels = attributeValues(markup, "data-head-panel");
    assert.ok(panels.includes("front"), "front panel must be drawn");
    assert.equal(
      panels.includes("profile"),
      false,
      `Máscara must not draw the profile head; panels were ${panels.join(",")}`,
    );
  });

  it("MENTONERA renders both the front and the profile head", () => {
    assert.ok(mentonera);
    const markup = renderHead(mentonera);

    const panels = attributeValues(markup, "data-head-panel");
    assert.ok(panels.includes("front"));
    assert.ok(panels.includes("profile"));
  });

  it("MÁSCARA crops the viewBox so the profile artwork is outside the frame", () => {
    assert.ok(mascara && mentonera);
    const mascaraMarkup = renderHead(mascara);
    const mentoneraMarkup = renderHead(mentonera);

    const mascaraViewBox = attributeValues(mascaraMarkup, "viewBox")[0];
    const mentoneraViewBox = attributeValues(mentoneraMarkup, "viewBox")[0];

    assert.ok(mascaraViewBox);
    assert.notEqual(mascaraViewBox, mentoneraViewBox);
    // The traced profile ink begins at x=179.22; the crop width must end before it.
    const width = Number(mascaraViewBox.split(/\s+/)[2]);
    assert.ok(width < 179.22, `crop width ${width} must exclude the profile head`);
    assert.ok(width > 138.2, `crop width ${width} must not clip the front head`);
  });
});

