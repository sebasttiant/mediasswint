import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COMPRESSION_MEASUREMENTS, findCompressionMeasurement } from "../lib/compression-measurements";

describe("COMPRESSION_MEASUREMENTS catalog", () => {
  it("matches the scanned measurement form sections", () => {
    const legMeasurements = COMPRESSION_MEASUREMENTS.filter((measurement) => measurement.group === "legs");
    const armMeasurements = COMPRESSION_MEASUREMENTS.filter((measurement) => measurement.group === "arms");

    assert.equal(legMeasurements.length, 56);
    assert.equal(armMeasurements.length, 38);
    assert.equal(COMPRESSION_MEASUREMENTS.length, 94);
  });

  it("contains right and left leg points 1 through 28", () => {
    for (let point = 1; point <= 28; point += 1) {
      assert.ok(findCompressionMeasurement(`legRight${point}`));
      assert.ok(findCompressionMeasurement(`legLeft${point}`));
    }
  });

  it("contains right and left arm points 1 through 19", () => {
    for (let point = 1; point <= 19; point += 1) {
      assert.ok(findCompressionMeasurement(`armRight${point}`));
      assert.ok(findCompressionMeasurement(`armLeft${point}`));
    }
  });

  it("each entry exposes form metadata and centimeter range", () => {
    for (const measurement of COMPRESSION_MEASUREMENTS) {
      assert.equal(typeof measurement.key, "string", `key for ${measurement.key}`);
      assert.equal(typeof measurement.label, "string", `label for ${measurement.key}`);
      assert.equal(measurement.unit, "cm", `unit for ${measurement.key}`);
      assert.equal(typeof measurement.point, "number", `point for ${measurement.key}`);
      assert.equal(measurement.min, 0.1, `min for ${measurement.key}`);
      assert.equal(measurement.max, 300, `max for ${measurement.key}`);
    }
  });

  it("each entry derives anatomyZone as `${group}.${side}.${point}`", () => {
    for (const measurement of COMPRESSION_MEASUREMENTS) {
      assert.equal(
        measurement.anatomyZone,
        `${measurement.group}.${measurement.side}.${measurement.point}`,
        `anatomyZone for ${measurement.key}`,
      );
    }
  });

  it("anatomyZone is unique across the catalog", () => {
    const zones = COMPRESSION_MEASUREMENTS.map((measurement) => measurement.anatomyZone);
    const uniqueZones = new Set(zones);
    assert.equal(uniqueZones.size, zones.length);
    assert.equal(uniqueZones.size, 94);
  });
});

describe("findCompressionMeasurement", () => {
  it("returns the definition for a valid scanned-form key", () => {
    const result = findCompressionMeasurement("legRight1");
    assert.ok(result);
    assert.equal(result.key, "legRight1");
    assert.equal(result.group, "legs");
    assert.equal(result.side, "right");
    assert.equal(result.point, 1);
    assert.equal(result.unit, "cm");
  });

  it("returns null for a vital sign key", () => {
    const result = findCompressionMeasurement("temperatureC");
    assert.equal(result, null);
  });
});
