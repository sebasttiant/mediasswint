import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BODY_HIGHLIGHT_OUTLINES,
  BODY_HIGHLIGHT_VIEWBOX,
  BODY_HIGHLIGHT_ZONES,
  findViewForZone,
  getZonesForView,
  hasZone,
} from "../app/_components/body-highlight/body-highlight-zones";
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
      assert.ok(zone.d.length > 0, `d non-empty for ${zone.zoneId}`);
      assert.ok(zone.d.startsWith("M "), `d starts with move for ${zone.zoneId}`);
      assert.ok(zone.d.trimEnd().endsWith("Z"), `d closed path for ${zone.zoneId}`);
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
