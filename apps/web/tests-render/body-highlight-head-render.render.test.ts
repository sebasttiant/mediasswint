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

describe("head figure — rendered markers", () => {
  it("renders exactly the markers the garment declares, and no others", () => {
    assert.ok(mascara && mentonera);

    // Expected zone ids come from production's own parser, so this asserts the
    // rendered result rather than re-implementing the filtering rule.
    const expected = (composition: NonNullable<typeof mentonera>) =>
      [...new Set(composition.zoneKeys.map((key) => parseHeadZoneKey(key)?.zoneId))].sort();

    assert.deepEqual(
      [...new Set(attributeValues(renderHead(mascara), "data-zone-id"))].sort(),
      expected(mascara),
    );
    assert.deepEqual(
      [...new Set(attributeValues(renderHead(mentonera), "data-zone-id"))].sort(),
      expected(mentonera),
    );
    // Máscara must never paint a Mentonera-only measurement.
    assert.equal(
      attributeValues(renderHead(mascara), "data-zone-id").includes("head.crownChin"),
      false,
    );
  });

  it("a degraded garment paints only its surviving markers", () => {
    assert.ok(mentonera);
    const full = renderHead(mentonera);
    const degraded = renderHead(mentonera, { visibleHeadZoneKeys: ["head.neck.front"] });

    assert.deepEqual([...new Set(attributeValues(degraded, "data-zone-id"))], ["head.neck"]);
    assert.deepEqual(attributeValues(degraded, "data-head-panel"), ["front"]);
    assert.ok(
      attributeValues(full, "data-zone-id").length >
        attributeValues(degraded, "data-zone-id").length,
      "the degraded figure must paint strictly fewer markers",
    );
  });

  it("marks the active and filled zones so the figure follows the form", () => {
    assert.ok(mentonera);
    const markup = renderHead(mentonera, {
      activeZoneId: "head.neck",
      filledZoneIds: ["head.crownChin"],
    });

    assert.ok(hasAttributeValue(markup, "data-active", "true"));
    assert.ok(hasAttributeValue(markup, "data-filled", "true"));
    assert.equal(countAttributeValue(markup, "data-active", "true") > 0, true);
  });
});

describe("head figure — rendered accessibility", () => {
  it("announces the garment it is actually showing", () => {
    assert.ok(mascara && mentonera);

    const mascaraText = textContent(renderHead(mascara));
    const mentoneraText = textContent(renderHead(mentonera));

    assert.match(mascaraText, /Máscara/);
    assert.doesNotMatch(mascaraText, /Mentonera/i);
    assert.match(mentoneraText, /Mentonera/);
  });

  it("never announces the old hardcoded '3 medidas de mentonera' for Máscara", () => {
    assert.ok(mascara);
    const text = textContent(renderHead(mascara));

    assert.doesNotMatch(text, /3 medidas de mentonera/i);
    assert.match(text, /2 medidas/);
  });

  it("a degraded figure describes what is on screen, not the full set", () => {
    assert.ok(mentonera);
    const text = textContent(
      renderHead(mentonera, { visibleHeadZoneKeys: ["head.neck.front"] }),
    );

    assert.match(text, /1 medida/);
    assert.doesNotMatch(text, /3 medidas/);
  });
});

describe("compression rendering is unaffected by the head branch", () => {
  it("still renders the full-body figure with its leg and arm zones", () => {
    const markup = render(
      createElement(BodyHighlight, {
        view: "full",
        sex: "FEMALE",
        filledZoneIds: ["legs.right.1"],
        activeZoneId: null,
      } as never),
    );

    // No head-view artefact may leak into the compression path.
    assert.deepEqual(attributeValues(markup, "data-head-panel"), []);
    assert.ok(markup.includes("<svg"), "the body figure must still render");
  });

  it("renders the isolated legs view without head markers", () => {
    const markup = render(
      createElement(BodyHighlight, {
        view: "legs",
        sex: "MALE",
        filledZoneIds: [],
        activeZoneId: null,
      } as never),
    );

    assert.deepEqual(attributeValues(markup, "data-head-panel"), []);
    assert.equal(
      attributeValues(markup, "data-zone-key").some((zone) => zone.startsWith("head.")),
      false,
    );
  });
});
