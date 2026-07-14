import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findRegionSummary } from "../lib/body-anatomy";
import {
  ARM_POINTS_PER_SIDE,
  COMPRESSION_MEASUREMENTS,
  LEG_POINTS_PER_SIDE,
} from "../lib/compression-measurements";

describe("per-side point counts are derived from the catalog", () => {
  it("LEG_POINTS_PER_SIDE matches the catalog leg points on each side", () => {
    for (const side of ["right", "left"] as const) {
      const points = COMPRESSION_MEASUREMENTS.filter(
        (measurement) => measurement.group === "legs" && measurement.side === side,
      );
      assert.equal(points.length, LEG_POINTS_PER_SIDE, `leg points on the ${side} side`);
    }
  });

  it("ARM_POINTS_PER_SIDE matches the catalog arm points on each side", () => {
    for (const side of ["right", "left"] as const) {
      const points = COMPRESSION_MEASUREMENTS.filter(
        (measurement) => measurement.group === "arms" && measurement.side === side,
      );
      assert.equal(points.length, ARM_POINTS_PER_SIDE, `arm points on the ${side} side`);
    }
  });
});

describe("ANATOMICAL_REGION_SUMMARY — region prose stays in sync with the catalog", () => {
  // These guard the leg-count migration: if the catalog count changes and the
  // region description is left behind, the UI would advertise a stale number.
  it("the legs description reports the catalog per-side leg count", () => {
    const legs = findRegionSummary("legs");

    assert.match(legs.description, new RegExp(`\\b${LEG_POINTS_PER_SIDE}\\b`));
  });

  it("the arms description reports the catalog per-side arm count", () => {
    const arms = findRegionSummary("arms");

    assert.match(arms.description, new RegExp(`\\b${ARM_POINTS_PER_SIDE}\\b`));
  });

  it("counts both sides as implemented for legs and arms", () => {
    assert.equal(findRegionSummary("legs").implementedCount, LEG_POINTS_PER_SIDE * 2);
    assert.equal(findRegionSummary("arms").implementedCount, ARM_POINTS_PER_SIDE * 2);
  });
});
