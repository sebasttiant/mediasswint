import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BODY_HIGHLIGHT_OUTLINES,
  BODY_HIGHLIGHT_VIEWBOX,
  BODY_HIGHLIGHT_ZONES,
  HEAD_VIEW_CROP,
  HEAD_ZONE_IDS,
  buildHeadMarkerRenderContract,
  findHeadZoneShape,
  getHeadZonesForSex,
  getHeadViewRenderContract,
  findMeasurementKeyForZone,
  findZoneShape,
  findViewForZone,
  getFullMarkerForSex,
  getFullZonePathForSex,
  getSideSummaryForView,
  getZoneA11yLabel,
  getZoneLabel,
  getZonePoint,
  getZoneSide,
  getZonesForView,
  hasFilledZone,
  isBodyHighlightCropped,
  hasZone,
} from "../app/_components/body-highlight/body-highlight-zones";
import {
  HEAD_DETAIL_VIEWBOX,
  HEAD_FIGURE_VIEWBOX,
} from "../app/_components/body-highlight/silhouettes/silhouette-shared";
import {
  getFullBodyCalibration,
  MALE_FULL_BODY,
} from "../app/_components/body-highlight/body-highlight-calibration";
import {
  FULL_BODY_FEMALE_ZONES,
  getFemaleZonePath,
} from "../app/_components/body-highlight/zones-female";
import {
  FULL_BODY_MALE_ZONES,
  getMaleZonePath,
} from "../app/_components/body-highlight/zones-male";
import { COMPRESSION_MEASUREMENTS } from "../lib/compression-measurements";
import {
  getHeadViewComposition,
  type HeadViewComposition,
} from "../lib/head-measurement-layout";

describe("BODY_HIGHLIGHT_ZONES — derived from the catalog", () => {
  it("produces one shape per catalog measurement", () => {
    assert.equal(BODY_HIGHLIGHT_ZONES.length, COMPRESSION_MEASUREMENTS.length);
    assert.equal(BODY_HIGHLIGHT_ZONES.length, 94);
  });

  it("zoneIds match the catalog anatomy zones one-to-one", () => {
    const zoneIds = BODY_HIGHLIGHT_ZONES.map((zone) => zone.zoneId).sort();
    const catalogZones = COMPRESSION_MEASUREMENTS.map((measurement) => measurement.anatomyZone).sort();
    assert.deepEqual(zoneIds, catalogZones);
  });

  it("contains 56 leg zones and 38 arm zones", () => {
    assert.equal(BODY_HIGHLIGHT_ZONES.filter((zone) => zone.view === "legs").length, 56);
    assert.equal(BODY_HIGHLIGHT_ZONES.filter((zone) => zone.view === "arms").length, 38);
  });

  it("each shape has a non-empty SVG path d", () => {
    for (const zone of BODY_HIGHLIGHT_ZONES) {
      assert.equal(typeof zone.d, "string", `d type for ${zone.zoneId}`);
      assert.equal(typeof zone.fullD, "string", `fullD type for ${zone.zoneId}`);
      assert.ok(zone.d.length > 0, `d non-empty for ${zone.zoneId}`);
      assert.ok(zone.fullD.length > 0, `fullD non-empty for ${zone.zoneId}`);
      assert.ok(zone.d.startsWith("M "), `d starts with move for ${zone.zoneId}`);
      assert.ok(zone.fullD.startsWith("M "), `fullD starts with move for ${zone.zoneId}`);
      assert.ok(zone.d.trimEnd().endsWith("Z"), `d closed path for ${zone.zoneId}`);
      assert.ok(zone.fullD.trimEnd().endsWith("Z"), `fullD closed path for ${zone.zoneId}`);
    }
  });
});

describe("getZonesForView", () => {
  it("returns 56 zones for 'legs'", () => {
    const zones = getZonesForView("legs");
    assert.equal(zones.length, 56);
    for (const zone of zones) {
      assert.equal(zone.view, "legs");
    }
  });

  it("returns 38 zones for 'arms'", () => {
    const zones = getZonesForView("arms");
    assert.equal(zones.length, 38);
    for (const zone of zones) {
      assert.equal(zone.view, "arms");
    }
  });

  it("returns every arm and leg zone for 'full'", () => {
    const zones = getZonesForView("full");

    assert.equal(zones.length, COMPRESSION_MEASUREMENTS.length);
    assert.ok(zones.some((zone) => zone.zoneId === "legs.right.1"));
    assert.ok(zones.some((zone) => zone.zoneId === "arms.left.19"));
  });

  it("returned zones include both sides for legs", () => {
    const zones = getZonesForView("legs");
    const ids = zones.map((zone) => zone.zoneId);
    assert.ok(ids.includes("legs.right.1"));
    assert.ok(ids.includes("legs.right.28"));
    assert.ok(ids.includes("legs.left.1"));
    assert.ok(ids.includes("legs.left.28"));
  });

  it("returned zones include both sides for arms", () => {
    const zones = getZonesForView("arms");
    const ids = zones.map((zone) => zone.zoneId);
    assert.ok(ids.includes("arms.right.1"));
    assert.ok(ids.includes("arms.right.19"));
    assert.ok(ids.includes("arms.left.1"));
    assert.ok(ids.includes("arms.left.19"));
  });
});

describe("hasZone", () => {
  it("returns true for known leg zones", () => {
    assert.equal(hasZone("legs.right.12"), true);
    assert.equal(hasZone("legs.left.28"), true);
  });

  it("returns true for known arm zones", () => {
    assert.equal(hasZone("arms.right.1"), true);
    assert.equal(hasZone("arms.left.19"), true);
  });

  it("returns false for an unknown zoneId without throwing", () => {
    assert.equal(hasZone("legs.right.999"), false);
    assert.equal(hasZone("torso.center.1"), false);
    assert.equal(hasZone("not-a-zone"), false);
    assert.equal(hasZone(""), false);
  });
});

describe("findViewForZone", () => {
  it("maps a known leg zone to 'legs'", () => {
    assert.equal(findViewForZone("legs.right.5"), "legs");
    assert.equal(findViewForZone("legs.left.20"), "legs");
  });

  it("maps a known arm zone to 'arms'", () => {
    assert.equal(findViewForZone("arms.right.7"), "arms");
    assert.equal(findViewForZone("arms.left.10"), "arms");
  });

  it("returns null for an unknown zoneId", () => {
    assert.equal(findViewForZone("not-a-zone"), null);
    assert.equal(findViewForZone(""), null);
  });
});

describe("getZoneLabel", () => {
  it("returns the label for a known leg zone", () => {
    const label = getZoneLabel("legs.right.7");
    assert.equal(label, "Pierna derecha punto 7");
  });

  it("returns the label for a known arm zone", () => {
    const label = getZoneLabel("arms.left.19");
    assert.equal(label, "Brazo izquierdo punto 19");
  });

  it("returns empty string for an unknown zoneId", () => {
    assert.equal(getZoneLabel("torso.center.1" as never), "");
    assert.equal(getZoneLabel("" as never), "");
  });
});

describe("findMeasurementKeyForZone", () => {
  it("maps a known leg zoneId to its measurement key", () => {
    assert.equal(findMeasurementKeyForZone("legs.right.7"), "legRight7");
    assert.equal(findMeasurementKeyForZone("legs.left.28"), "legLeft28");
  });

  it("maps a known arm zoneId to its measurement key", () => {
    assert.equal(findMeasurementKeyForZone("arms.right.1"), "armRight1");
    assert.equal(findMeasurementKeyForZone("arms.left.19"), "armLeft19");
  });

  it("returns null for an unknown zoneId", () => {
    assert.equal(findMeasurementKeyForZone("torso.center.1" as never), null);
    assert.equal(findMeasurementKeyForZone("" as never), null);
  });
});

describe("zone visual metadata", () => {
  it("findZoneShape returns path metadata for known zones", () => {
    const shape = findZoneShape("legs.right.7");

    assert.equal(shape?.zoneId, "legs.right.7");
    assert.equal(shape?.view, "legs");
    assert.equal(shape?.point, 7);
    assert.equal(shape?.side, "right");
  });

  it("findZoneShape returns null for unknown zones", () => {
    assert.equal(findZoneShape("legs.right.999" as never), null);
  });

  it("derives side and point metadata for active labels", () => {
    assert.equal(getZoneSide("arms.left.19"), "left");
    assert.equal(getZonePoint("arms.left.19"), 19);
    assert.equal(getZoneSide("torso.center.1" as never), null);
    assert.equal(getZonePoint("torso.center.1" as never), null);
  });

  it("builds accessible labels with filled and active state", () => {
    assert.equal(
      getZoneA11yLabel("legs.right.7", { active: true, filled: false }),
      "Pierna derecha punto 7, zona activa",
    );
    assert.equal(
      getZoneA11yLabel("arms.left.19", { active: false, filled: true }),
      "Brazo izquierdo punto 19, medida cargada",
    );
  });

  it("summarizes right and left piece coverage for each visual sheet", () => {
    const legsSummary = getSideSummaryForView("legs");
    const armsSummary = getSideSummaryForView("arms");

    assert.deepEqual(legsSummary, [
      { side: "right", label: "Pierna derecha", points: 28 },
      { side: "left", label: "Pierna izquierda", points: 28 },
    ]);
    assert.deepEqual(armsSummary, [
      { side: "right", label: "Brazo derecho", points: 19 },
      { side: "left", label: "Brazo izquierdo", points: 19 },
    ]);
  });
});

// Extract just the Y coordinates from an "M x y L x y …" path. Numbers are
// emitted as alternating x,y pairs, so the odd indices are the Ys.
function pathYs(d: string): number[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  return nums.filter((_, index) => index % 2 === 1);
}
function pathXs(d: string): number[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  return nums.filter((_, index) => index % 2 === 0);
}

describe("sex-specific full-body zone paths", () => {
  it("generates contour-fitted male arm bands instead of the misaligned traced polygons", () => {
    const zone = findZoneShape("arms.right.18");
    assert.ok(zone);

    const traced = getMaleZonePath(zone.zoneId);
    assert.ok(traced);

    const rendered = getFullZonePathForSex("male", zone);

    // Neither the calibrated marker (blocks) nor the raw traced polygon (which
    // is misaligned with the male asset and overflows the limb).
    assert.notEqual(rendered, getFullMarkerForSex(MALE_FULL_BODY, zone).path);
    assert.notEqual(rendered, traced);
  });

  it("keeps every male arm band inside the limb and clear of the hand", () => {
    for (const point of [1, 10, 19]) {
      for (const side of ["right", "left"] as const) {
        const zone = findZoneShape(`arms.${side}.${point}`);
        assert.ok(zone);
        const rendered = getFullZonePathForSex("male", zone);
        const ys = pathYs(rendered);
        const xs = pathXs(rendered);

        // Bands span the shoulder→wrist run (115..234) — never into the hand.
        assert.ok(Math.min(...ys) >= 114, `male arm ${side}.${point} starts at the shoulder`);
        assert.ok(Math.max(...ys) <= 234.5, `male arm ${side}.${point} ends at the wrist`);
        // …and stay within the rendered arm's horizontal contour (right arm
        // outer edge ~x25 at the wrist; left arm mirror tops out ~x215).
        assert.ok(Math.min(...xs) >= 22, `male arm ${side}.${point} stays inside the outer edge`);
        assert.ok(Math.max(...xs) <= 218, `male arm ${side}.${point} stays inside the inner edge`);
        // …and fill the arm width — not thin floating lines (regression guard
        // for the over-narrow bands). Trapezoid xs = [loTop, hiTop, hiBottom,
        // loBottom]; each rung must be a healthy fraction of the limb.
        const widthTop = xs[1] - xs[0];
        const widthBottom = xs[2] - xs[3];
        assert.ok(widthTop >= 15, `male arm ${side}.${point} band is wide enough at top (${widthTop})`);
        assert.ok(widthBottom >= 14, `male arm ${side}.${point} band is wide enough at bottom (${widthBottom})`);
      }
    }
  });

  it("renders male arm bands as a continuous run (contiguous, like the legs)", () => {
    // Adjacent bands must share their edge — no vertical white gap between them
    // — so the limb reads as a solid fill, not thin striped lines.
    for (const side of ["right", "left"] as const) {
      for (let point = 1; point < 19; point += 1) {
        const upper = findZoneShape(`arms.${side}.${point}`);
        const lower = findZoneShape(`arms.${side}.${point + 1}`);
        assert.ok(upper && lower);
        const upperBottom = Math.max(...pathYs(getFullZonePathForSex("male", upper)));
        const lowerTop = Math.min(...pathYs(getFullZonePathForSex("male", lower)));
        assert.ok(
          Math.abs(lowerTop - upperBottom) < 0.02,
          `male arm ${side} bands ${point}/${point + 1} are contiguous (gap ${lowerTop - upperBottom})`,
        );
      }
    }
  });

  it("generates contour-fitted female arm bands instead of the misaligned traced polygons", () => {
    const zone = findZoneShape("arms.right.18");
    assert.ok(zone);
    const rendered = getFullZonePathForSex("female", zone);
    // Neither the calibrated marker nor the raw traced polygon (which is
    // misaligned with the female asset and overflowed the limb at the wrist).
    assert.notEqual(rendered, getFullMarkerForSex(getFullBodyCalibration("female"), zone).path);
    assert.notEqual(rendered, getFemaleZonePath(zone.zoneId));
  });

  it("keeps every female arm band inside the limb, from upper arm to wrist", () => {
    for (const point of [1, 10, 19]) {
      for (const side of ["right", "left"] as const) {
        const zone = findZoneShape(`arms.${side}.${point}`);
        assert.ok(zone);
        const rendered = getFullZonePathForSex("female", zone);
        const ys = pathYs(rendered);
        const xs = pathXs(rendered);

        // Spans the upper-arm→wrist run (130..242): starts up on the upper arm
        // (not too low) and stops before the hand (which begins ~y246).
        assert.ok(Math.min(...ys) >= 129, `female arm ${side}.${point} starts on the upper arm`);
        assert.ok(Math.max(...ys) <= 242.5, `female arm ${side}.${point} ends at the wrist`);
        // Stays within the rendered arm's horizontal contour (right arm outer
        // edge ~x26 at the wrist; left arm mirror tops out ~x214) — no overflow.
        assert.ok(Math.min(...xs) >= 24, `female arm ${side}.${point} stays inside the outer edge`);
        assert.ok(Math.max(...xs) <= 216, `female arm ${side}.${point} stays inside the inner edge`);
        // Fills the arm width — clean continuous band, not a thin floating line.
        const widthTop = xs[1] - xs[0];
        const widthBottom = xs[2] - xs[3];
        assert.ok(widthTop >= 14, `female arm ${side}.${point} band is wide enough at top (${widthTop})`);
        assert.ok(widthBottom >= 14, `female arm ${side}.${point} band is wide enough at bottom (${widthBottom})`);
      }
    }
  });

  it("renders female arm bands as a continuous run (contiguous, like the legs)", () => {
    for (const side of ["right", "left"] as const) {
      for (let point = 1; point < 19; point += 1) {
        const upper = findZoneShape(`arms.${side}.${point}`);
        const lower = findZoneShape(`arms.${side}.${point + 1}`);
        assert.ok(upper && lower);
        const upperBottom = Math.max(...pathYs(getFullZonePathForSex("female", upper)));
        const lowerTop = Math.min(...pathYs(getFullZonePathForSex("female", lower)));
        assert.ok(
          Math.abs(lowerTop - upperBottom) < 0.02,
          `female arm ${side} bands ${point}/${point + 1} are contiguous (gap ${lowerTop - upperBottom})`,
        );
      }
    }
  });

  it("preserves traced full-body paths for female leg zones and male leg zones", () => {
    const femaleArmZone = findZoneShape("arms.left.18");
    const femaleLegZone = findZoneShape("legs.left.18");
    const maleLegZone = findZoneShape("legs.right.18");
    assert.ok(femaleArmZone);
    assert.ok(femaleLegZone);
    assert.ok(maleLegZone);

    assert.notEqual(getFullZonePathForSex("female", femaleArmZone), getFemaleZonePath(femaleArmZone.zoneId));
    assert.equal(getFullZonePathForSex("female", femaleLegZone), getFemaleZonePath(femaleLegZone.zoneId));
    assert.equal(getFullZonePathForSex("male", maleLegZone), getMaleZonePath(maleLegZone.zoneId));
  });
});

describe("traced leg paths stay in lockstep with the catalog", () => {
  // Leg bands are hand-traced per sex and each path is drawn for one specific
  // slot of the current leg-point count. Both drift directions are silent:
  //  - an ADDED point has no traced path, and getFullZonePathForSex quietly
  //    falls back to a generated marker rectangle;
  //  - a REMOVED point still resolves, but the surviving paths were traced for
  //    the old slot count, so the bands cover only part of the limb.
  // Neither throws. Exact set equality is what makes a leg-count change fail
  // loudly here instead of shipping a silently wrong body figure.
  const catalogLegZones = () =>
    BODY_HIGHLIGHT_ZONES.filter((zone) => zone.view === "legs")
      .map((zone) => zone.zoneId)
      .sort();

  const tracedLegZones = (zones: Readonly<Partial<Record<string, string>>>) =>
    Object.keys(zones)
      .filter((zoneId) => zoneId.startsWith("legs."))
      .sort();

  it("the male traced leg zones are exactly the catalog leg zones", () => {
    assert.deepEqual(tracedLegZones(FULL_BODY_MALE_ZONES), catalogLegZones());
  });

  it("the female traced leg zones are exactly the catalog leg zones", () => {
    assert.deepEqual(tracedLegZones(FULL_BODY_FEMALE_ZONES), catalogLegZones());
  });

  it("every traced leg path is a non-empty string for both sexes", () => {
    // Set equality alone would accept a zone whose path was blanked out to "".
    // An empty `d` renders nothing at all, which is silent in exactly the same
    // way as the fallback marker.
    for (const zone of BODY_HIGHLIGHT_ZONES.filter((candidate) => candidate.view === "legs")) {
      for (const [sex, path] of [
        ["male", getMaleZonePath(zone.zoneId)],
        ["female", getFemaleZonePath(zone.zoneId)],
      ] as const) {
        assert.equal(typeof path, "string", `${sex} ${zone.zoneId} traced path type`);
        assert.ok((path ?? "").trim().length > 0, `${sex} ${zone.zoneId} traced path is empty`);
      }
    }
  });

  it("renders every leg zone from its traced path, never from the fallback marker", () => {
    for (const sex of ["male", "female"] as const) {
      const calibration = sex === "female" ? getFullBodyCalibration(sex) : MALE_FULL_BODY;

      for (const zone of BODY_HIGHLIGHT_ZONES.filter((candidate) => candidate.view === "legs")) {
        assert.notEqual(
          getFullZonePathForSex(sex, zone),
          getFullMarkerForSex(calibration, zone).path,
          `${sex} ${zone.zoneId} rendered the fallback marker instead of its traced path`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Máscara and Mentonera head zones. Landmarks are read from the
// client's "Máscara y mentonera" PDF (its red tapes + face-length bracket) and
// expressed in HEAD_FIGURE_VIEWBOX, the space of the PDF-traced HeadFigure:
// the MENTONERA panel carries all three measurements on the side profile, and
// the MÁSCARA panel repeats the neck circumference on the front view.
// These zones are NOT derived from COMPRESSION_MEASUREMENTS (Mentonera fields
// carry {anatomyZone, kind}, not {group, side, point}), so they live in a
// parallel, additive array.
// ---------------------------------------------------------------------------

const HEAD_SEXES = ["female", "male"] as const;

describe("getHeadZonesForSex — Mentonera zones", () => {
  for (const sex of HEAD_SEXES) {
    it(`[${sex}] draws every measurement carried by Máscara or Mentonera`, () => {
      const drawn = new Set(getHeadZonesForSex(sex).map((zone) => zone.zoneId));
      for (const zoneId of HEAD_ZONE_IDS) {
        assert.ok(drawn.has(zoneId), `${zoneId} has no line on the ${sex} figure`);
      }
    });

    it(`[${sex}] puts crown→chin and face length on the profile, per the form`, () => {
      const panelOf = (zoneId: string) =>
        getHeadZonesForSex(sex)
          .filter((zone) => zone.zoneId === zoneId)
          .map((zone) => zone.panel);

      assert.deepEqual(panelOf("head.crownChin"), ["profile"]);
      assert.deepEqual(panelOf("head.faceLength"), ["profile"]);
    });

    it(`[${sex}] puts the Máscara forehead circumference on the front view`, () => {
      const panels = getHeadZonesForSex(sex)
        .filter((zone) => zone.zoneId === "head.forehead")
        .map((zone) => zone.panel);

      assert.deepEqual(panels, ["front"]);
    });

    it(`[${sex}] draws the neck on both the profile and the front view`, () => {
      const panels = getHeadZonesForSex(sex)
        .filter((zone) => zone.zoneId === "head.neck")
        .map((zone) => zone.panel);

      assert.deepEqual([...panels].sort(), ["front", "profile"]);
    });

    it(`[${sex}] does not crowd every measurement onto a single panel`, () => {
      const panels = new Set(getHeadZonesForSex(sex).map((zone) => zone.panel));
      assert.deepEqual([...panels].sort(), ["front", "profile"]);
    });

    it(`[${sex}] every head zone has a non-empty traced measurement line`, () => {
      for (const zone of getHeadZonesForSex(sex)) {
        assert.equal(typeof zone.line, "string", `${zone.zoneId} line type`);
        assert.ok(zone.line.trim().length > 0, `${zone.zoneId} line is empty`);
        assert.ok(zone.line.startsWith("M "), `${zone.zoneId} line starts with move`);
        assert.ok(!/NaN|Infinity/.test(zone.line), `${zone.zoneId} line has bad coords`);
      }
    });

    it(`[${sex}] every head zone has two valid end bars`, () => {
      for (const zone of getHeadZonesForSex(sex)) {
        assert.equal(zone.endBars?.length, 2, `${zone.zoneId} end bar count`);
        for (const bar of zone.endBars ?? []) {
          assert.ok(bar.trim().startsWith("M "), `${zone.zoneId} end bar is empty`);
          assert.ok(!/NaN|Infinity/.test(bar), `${zone.zoneId} end bar has bad coords`);
        }
      }
    });

    it(`[${sex}] every head zone carries a human label`, () => {
      for (const zone of getHeadZonesForSex(sex)) {
        assert.ok(zone.label.trim().length > 0, `${zone.zoneId} label is empty`);
      }
    });

    it(`[${sex}] draws every line inside the visible crop`, () => {
      const maxX = HEAD_VIEW_CROP.x + HEAD_VIEW_CROP.width;
      const maxY = HEAD_VIEW_CROP.y + HEAD_VIEW_CROP.height;

      for (const zone of getHeadZonesForSex(sex)) {
        const paths = [zone.line, ...(zone.endBars ?? [])].join(" ");
        const numbers = paths.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
        for (let i = 0; i < numbers.length; i += 2) {
          const [x, y] = [numbers[i], numbers[i + 1]];
          assert.ok(x >= HEAD_VIEW_CROP.x && x <= maxX, `${zone.zoneId} x=${x} outside crop`);
          assert.ok(y >= HEAD_VIEW_CROP.y && y <= maxY, `${zone.zoneId} y=${y} outside crop`);
        }
      }
    });
  }

  it("uses one sex-neutral figure — the client form draws a single head", () => {
    const female = getHeadZonesForSex("female").map((zone) => zone.line);
    const male = getHeadZonesForSex("male").map((zone) => zone.line);
    assert.deepEqual(female, male);
  });

  it("frames the traced front + profile figure with no back view", () => {
    // The trace contains only the two heads, so the crop is the whole figure.
    assert.equal(HEAD_VIEW_CROP.x, 0);
    assert.equal(HEAD_VIEW_CROP.y, 0);
    assert.ok(HEAD_VIEW_CROP.width > 200, "crop spans front + profile");
    assert.ok(HEAD_VIEW_CROP.height > 200, "crop keeps full head height");
  });

  it("keeps Mentonera overlays in the PDF figure space, never the generic PNG space", () => {
    // The Mentonera measurement lines live in HEAD_FIGURE_VIEWBOX (the traced
    // figure). The generic full-body head-hotspot detail uses the separate,
    // larger HEAD_DETAIL_VIEWBOX raster space. The two must never coincide, or
    // a measurement line drawn for one would land in the wrong place on the
    // other.
    assert.deepEqual(
      { width: HEAD_VIEW_CROP.width, height: HEAD_VIEW_CROP.height },
      { width: HEAD_FIGURE_VIEWBOX.width, height: HEAD_FIGURE_VIEWBOX.height },
    );
    assert.notDeepEqual(HEAD_FIGURE_VIEWBOX, HEAD_DETAIL_VIEWBOX);

    // Every head zone coordinate stays inside the PDF figure space and well
    // inside the (much larger) generic PNG space — proving no leak either way.
    for (const sex of HEAD_SEXES) {
      for (const zone of getHeadZonesForSex(sex)) {
        const nums = [zone.line, ...(zone.endBars ?? [])]
          .join(" ")
          .match(/-?\d+(\.\d+)?/g)
          ?.map(Number) ?? [];
        for (let i = 0; i < nums.length; i += 2) {
          assert.ok(nums[i] <= HEAD_FIGURE_VIEWBOX.width, `x ${nums[i]} outside figure space`);
          assert.ok(nums[i + 1] <= HEAD_FIGURE_VIEWBOX.height, `y ${nums[i + 1]} outside figure space`);
        }
      }
    }
  });

  it("pins each line to the client PDF's measured tape positions", () => {
    const zones = getHeadZonesForSex("female");
    const at = (id: string) => zones.find((z) => z.zoneId === id && z.panel === "profile");
    const front = zones.find((z) => z.zoneId === "head.neck" && z.panel === "front");

    // crown→chin starts at the crown landmark (272.9, 55) read from the PDF tape.
    const cc = at("head.crownChin");
    assert.ok(cc?.line.startsWith("M 272.9 55"), `crownChin line: ${cc?.line}`);

    // profile neck sits at the PDF tape's y (217.5), spanning throat→nape.
    const pneck = zones.find((z) => z.zoneId === "head.neck" && z.panel === "profile");
    assert.match(pneck?.line ?? "", /^M 232\.4 217\.5 L 298\.3 217\.5$/);

    // front neck sits at the MÁSCARA tape's y (181.3).
    assert.match(front?.line ?? "", /^M 40\.9 181\.3 L 108\.6 181\.3$/);

    // front forehead sits at the MÁSCARA tape's y (73.5).
    const forehead = zones.find((z) => z.zoneId === "head.forehead" && z.panel === "front");
    assert.match(forehead?.line ?? "", /^M 27\.2 73\.5 L 122\.9 73\.5$/);

    // face-length bracket runs vertically at the PDF bracket x (172).
    const fl = at("head.faceLength");
    assert.ok(fl?.line.startsWith("M 172 "), `faceLength line: ${fl?.line}`);
  });

  it("exposes the same head viewBox and hidden overflow contract used by the renderer", () => {
    const contract = getHeadViewRenderContract();

    assert.deepEqual(contract.viewBox, HEAD_VIEW_CROP);
    assert.equal(contract.viewBoxAttribute, `${HEAD_VIEW_CROP.x} ${HEAD_VIEW_CROP.y} ${HEAD_VIEW_CROP.width} ${HEAD_VIEW_CROP.height}`);
    assert.equal(contract.overflow, "hidden");
    assert.deepEqual(contract.style, { overflow: "hidden" });
    assert.equal(isBodyHighlightCropped("head", false), true);
    assert.equal(isBodyHighlightCropped("full", true), true);
    assert.equal(isBodyHighlightCropped("full", false), false);
    assert.equal(isBodyHighlightCropped("legs", false), false);
  });

  it("exposes the inactive readonly marker contract consumed by the renderer", () => {
    const zone = getHeadZonesForSex("female").find((candidate) => candidate.zoneId === "head.faceLength");
    assert.ok(zone);

    const marker = buildHeadMarkerRenderContract(zone, {
      activeZoneId: "head.neck" as never,
      filledZoneIds: new Set(["head.crownChin"] as never),
      isInteractive: false,
    });

    assert.equal(marker.zoneId, "head.faceLength");
    assert.equal(marker.active, "false");
    assert.equal(marker.filled, "false");
    assert.equal(marker.role, undefined);
    assert.equal(marker.tabIndex, undefined);
    assert.equal(marker.clickZoneId, "head.faceLength");
    assert.equal(marker.ariaLabel, "Largo de cara (frente–mentón) (perfil), pendiente");
  });

  it("builds five marker contracts for the Máscara and Mentonera measurements", () => {
    const markers = getHeadZonesForSex("female").map((zone) =>
      buildHeadMarkerRenderContract(zone, {
        activeZoneId: null,
        filledZoneIds: undefined,
        isInteractive: true,
      }),
    );

    assert.equal(markers.length, 5);
    assert.deepEqual(new Set(markers.map((marker) => marker.zoneId)), new Set(HEAD_ZONE_IDS));
    assert.equal(markers.filter((marker) => marker.zoneId === "head.neck").length, 2);
    assert.deepEqual(
      markers.filter((marker) => marker.zoneId === "head.neck").map((marker) => marker.headPanel).sort(),
      ["front", "profile"],
    );
    for (const marker of markers) {
      assert.equal(marker.role, "button");
      assert.equal(marker.tabIndex, 0);
      assert.equal(marker.clickZoneId, marker.zoneId);
    }
  });

  it("shares active and filled state across duplicate neck markers while keeping panel labels distinct", () => {
    const neckMarkers = getHeadZonesForSex("female")
      .filter((zone) => zone.zoneId === "head.neck")
      .map((zone) =>
        buildHeadMarkerRenderContract(zone, {
          activeZoneId: "head.neck" as never,
          filledZoneIds: new Set(["head.neck"] as never),
          isInteractive: true,
        }),
      );

    assert.equal(neckMarkers.length, 2);
    assert.ok(neckMarkers.every((marker) => marker.active === "true"));
    assert.ok(neckMarkers.every((marker) => marker.filled === "true"));
    assert.deepEqual(
      neckMarkers.map((marker) => marker.ariaLabel).sort(),
      [
        "Contorno de cuello (frente), zona activa, medida cargada",
        "Contorno de cuello (perfil), zona activa, medida cargada",
      ],
    );
    assert.ok(neckMarkers.every((marker) => marker.clickZoneId === "head.neck"));
  });
});

describe("Mentonera crown→chin trajectory follows the form's profile path", () => {
  for (const sex of HEAD_SEXES) {
    it(`[${sex}] travels from the crown down to the chin`, () => {
      const zone = getHeadZonesForSex(sex).find((z) => z.zoneId === "head.crownChin");
      assert.ok(zone);
      const [startX, startY, , , endX, endY] = (zone!.line.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

      // Crown is above and behind the chin on a left-facing profile.
      assert.ok(endY > startY, "line must descend from crown toward chin");
      assert.ok(endX < startX, "line must travel forward from crown toward chin");
      assert.ok(endY - startY > 100, "line must span the height of the head");
    });

    it(`[${sex}] face length spans forehead to chin tip vertically`, () => {
      const zone = getHeadZonesForSex(sex).find((z) => z.zoneId === "head.faceLength");
      assert.ok(zone);
      const [x1, y1, x2, y2] = (zone!.line.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

      assert.equal(x1, x2, "face length is a vertical bracket");
      assert.ok(y2 - y1 > 80, "bracket must span the face");
    });

    it(`[${sex}] neck lines are horizontal at neck height`, () => {
      for (const zone of getHeadZonesForSex(sex).filter((z) => z.zoneId === "head.neck")) {
        const [x1, y1, x2, y2] = (zone.line.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
        assert.equal(y1, y2, `${zone.panel} neck line is horizontal`);
        assert.ok(x2 > x1, `${zone.panel} neck line runs left to right`);
      }
    });
  }
});

describe("findHeadZoneShape", () => {
  it("returns the zone shape for a known Mentonera zone id", () => {
    const shape = findHeadZoneShape("head.crownChin" as never);
    assert.ok(shape);
    assert.equal(shape?.zoneId, "head.crownChin");
  });

  it("resolves the same sex-neutral geometry for both sexes", () => {
    const female = findHeadZoneShape("head.neck" as never, "female");
    const male = findHeadZoneShape("head.neck" as never, "male");
    assert.equal(female?.line, male?.line);
  });

  it("returns null for a zone id outside the head catalog", () => {
    assert.equal(findHeadZoneShape("legs.right.1" as never), null);
    assert.equal(findHeadZoneShape("head.unknown" as never), null);
  });
});

describe("getZoneLabel — resolves both compression AND head zones (same function)", () => {
  it("still resolves compression zone labels unchanged (non-regression)", () => {
    assert.equal(getZoneLabel("legs.right.7"), findZoneShape("legs.right.7")?.label);
    assert.equal(getZoneLabel("arms.left.19"), findZoneShape("arms.left.19")?.label);
  });

  it("resolves Mentonera head zone labels via the same lookup", () => {
    for (const zone of getHeadZonesForSex("female")) {
      assert.equal(getZoneLabel(zone.zoneId), zone.label);
    }
  });

  it("returns empty string for a zone id in neither catalog", () => {
    assert.equal(getZoneLabel("torso.center.1" as never), "");
  });
});

describe("hasFilledZone — same highlight primitive drives compression AND head zones", () => {
  it("regression: reports filled compression zones from a Set, unchanged", () => {
    assert.equal(hasFilledZone(new Set(["legs.right.1"] as never), "legs.right.1" as never), true);
    assert.equal(hasFilledZone(new Set(["legs.right.1"] as never), "legs.right.2" as never), false);
  });

  it("regression: reports filled compression zones from an array, unchanged", () => {
    assert.equal(hasFilledZone(["arms.left.5"] as never, "arms.left.5" as never), true);
    assert.equal(hasFilledZone(["arms.left.5"] as never, "arms.right.5" as never), false);
  });

  it("regression: treats undefined filledZoneIds as nothing filled", () => {
    assert.equal(hasFilledZone(undefined, "legs.right.1" as never), false);
  });

  it("resolves filled state for Mentonera head zones through the identical function", () => {
    assert.equal(hasFilledZone(new Set(["head.crownChin"] as never), "head.crownChin" as never), true);
    assert.equal(hasFilledZone(new Set(["head.crownChin"] as never), "head.faceLength" as never), false);
    assert.equal(hasFilledZone(["head.neck"] as never, "head.neck" as never), true);
  });
});

describe("BODY_HIGHLIGHT_OUTLINES and viewbox constants", () => {
  it("provides outlines for both views", () => {
    assert.ok(Array.isArray(BODY_HIGHLIGHT_OUTLINES.legs));
    assert.ok(Array.isArray(BODY_HIGHLIGHT_OUTLINES.arms));
    assert.ok(BODY_HIGHLIGHT_OUTLINES.legs.length > 0);
    assert.ok(BODY_HIGHLIGHT_OUTLINES.arms.length > 0);
  });

  it("exposes a positive viewBox", () => {
    assert.ok(BODY_HIGHLIGHT_VIEWBOX.width > 0);
    assert.ok(BODY_HIGHLIGHT_VIEWBOX.height > 0);
  });
});
