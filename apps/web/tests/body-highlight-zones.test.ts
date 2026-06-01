import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BODY_HIGHLIGHT_OUTLINES,
  BODY_HIGHLIGHT_VIEWBOX,
  BODY_HIGHLIGHT_ZONES,
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
  hasZone,
} from "../app/_components/body-highlight/body-highlight-zones";
import { MALE_FULL_BODY } from "../app/_components/body-highlight/body-highlight-calibration";
import { getFemaleZonePath } from "../app/_components/body-highlight/zones-female";
import { getMaleZonePath } from "../app/_components/body-highlight/zones-male";
import { COMPRESSION_MEASUREMENTS } from "../lib/compression-measurements";

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

describe("sex-specific full-body zone paths", () => {
  it("uses calibrated markers for male arm zones to keep highlights inside the arm", () => {
    const zone = findZoneShape("arms.right.18");
    assert.ok(zone);

    const calibratedMarker = getFullMarkerForSex(MALE_FULL_BODY, zone).path;

    assert.equal(getFullZonePathForSex("male", zone), calibratedMarker);
    assert.notEqual(getFullZonePathForSex("male", zone), getMaleZonePath(zone.zoneId));
  });

  it("preserves traced full-body paths for female arm zones and male leg zones", () => {
    const femaleArmZone = findZoneShape("arms.left.18");
    const maleLegZone = findZoneShape("legs.right.18");
    assert.ok(femaleArmZone);
    assert.ok(maleLegZone);

    assert.equal(getFullZonePathForSex("female", femaleArmZone), getFemaleZonePath(femaleArmZone.zoneId));
    assert.equal(getFullZonePathForSex("male", maleLegZone), getMaleZonePath(maleLegZone.zoneId));
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
