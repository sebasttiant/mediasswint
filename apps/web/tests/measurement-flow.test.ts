import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COMPRESSION_MEASUREMENTS } from "../lib/compression-measurements";
import {
  buildMeasurementSteps,
  createMeasurementFlowState,
  getActiveZoneId,
  getCurrentStep,
  goNext,
  goPrev,
  setCurrentValue,
} from "../lib/measurement-flow";

describe("buildMeasurementSteps — derives sequence from catalog", () => {
  it("produces one step per catalog entry, in catalog order", () => {
    const steps = buildMeasurementSteps();
    assert.equal(steps.length, COMPRESSION_MEASUREMENTS.length);
    assert.equal(steps.length, 94);

    for (let i = 0; i < steps.length; i += 1) {
      assert.equal(steps[i].index, i, `step.index at position ${i}`);
      assert.equal(steps[i].key, COMPRESSION_MEASUREMENTS[i].key, `step.key at position ${i}`);
      assert.equal(
        steps[i].zoneId,
        COMPRESSION_MEASUREMENTS[i].anatomyZone,
        `step.zoneId at position ${i}`,
      );
    }
  });

  it("starts with right leg points 1..28", () => {
    const steps = buildMeasurementSteps();
    for (let point = 1; point <= 28; point += 1) {
      const step = steps[point - 1];
      assert.equal(step.key, `legRight${point}`);
      assert.equal(step.zoneId, `legs.right.${point}`);
    }
  });

  it("continues with left leg points 1..28", () => {
    const steps = buildMeasurementSteps();
    for (let point = 1; point <= 28; point += 1) {
      const step = steps[28 + (point - 1)];
      assert.equal(step.key, `legLeft${point}`);
      assert.equal(step.zoneId, `legs.left.${point}`);
    }
  });

  it("continues with right arm points 1..19", () => {
    const steps = buildMeasurementSteps();
    for (let point = 1; point <= 19; point += 1) {
      const step = steps[56 + (point - 1)];
      assert.equal(step.key, `armRight${point}`);
      assert.equal(step.zoneId, `arms.right.${point}`);
    }
  });

  it("ends with left arm points 1..19", () => {
    const steps = buildMeasurementSteps();
    for (let point = 1; point <= 19; point += 1) {
      const step = steps[75 + (point - 1)];
      assert.equal(step.key, `armLeft${point}`);
      assert.equal(step.zoneId, `arms.left.${point}`);
    }
  });

  it("each step carries label, unit and range from the catalog", () => {
    const steps = buildMeasurementSteps();
    for (let i = 0; i < steps.length; i += 1) {
      assert.equal(steps[i].label, COMPRESSION_MEASUREMENTS[i].label);
      assert.equal(steps[i].unit, "cm");
      assert.equal(steps[i].min, 0.1);
      assert.equal(steps[i].max, 300);
    }
  });
});

describe("createMeasurementFlowState", () => {
  it("starts at index 0 with all values null", () => {
    const state = createMeasurementFlowState();
    assert.equal(state.stepIndex, 0);
    assert.equal(state.steps.length, 94);
    for (const step of state.steps) {
      assert.equal(state.values[step.key], null, `initial value for ${step.key}`);
    }
  });
});

describe("getCurrentStep / getActiveZoneId", () => {
  it("getCurrentStep returns the step at stepIndex", () => {
    const state = createMeasurementFlowState();
    const current = getCurrentStep(state);
    assert.ok(current);
    assert.equal(current.index, 0);
    assert.equal(current.key, "legRight1");
  });

  it("getActiveZoneId returns the zoneId of the current step", () => {
    const state = createMeasurementFlowState();
    assert.equal(getActiveZoneId(state), "legs.right.1");
  });

  it("getActiveZoneId tracks navigation", () => {
    const state = createMeasurementFlowState();
    const afterNext = goNext(state);
    assert.equal(getActiveZoneId(afterNext), "legs.right.2");
  });
});

describe("goNext / goPrev", () => {
  it("goNext advances stepIndex by one", () => {
    const initial = createMeasurementFlowState();
    const next = goNext(initial);
    assert.equal(next.stepIndex, 1);
    assert.notEqual(next, initial);
  });

  it("goNext clamps at the last step and returns the same state reference", () => {
    let state = createMeasurementFlowState();
    state = { ...state, stepIndex: state.steps.length - 1 };
    const clamped = goNext(state);
    assert.equal(clamped.stepIndex, state.steps.length - 1);
    assert.equal(clamped, state);
  });

  it("goPrev decrements stepIndex by one", () => {
    const initial = createMeasurementFlowState();
    const moved = { ...initial, stepIndex: 5 };
    const prev = goPrev(moved);
    assert.equal(prev.stepIndex, 4);
  });

  it("goPrev clamps at 0 and returns the same state reference", () => {
    const initial = createMeasurementFlowState();
    const clamped = goPrev(initial);
    assert.equal(clamped.stepIndex, 0);
    assert.equal(clamped, initial);
  });

  it("goNext + goPrev round-trip restores the original index", () => {
    const initial = createMeasurementFlowState();
    const result = goPrev(goNext(initial));
    assert.equal(result.stepIndex, 0);
  });
});

describe("setCurrentValue", () => {
  it("stores a value in range for the current step", () => {
    const state = createMeasurementFlowState();
    const updated = setCurrentValue(state, 42);
    assert.equal(updated.values.legRight1, 42);
    assert.equal(state.values.legRight1, null, "original state is not mutated");
  });

  it("only updates the current step's value", () => {
    const state = createMeasurementFlowState();
    const updated = setCurrentValue(state, 30);
    assert.equal(updated.values.legRight1, 30);
    assert.equal(updated.values.legRight2, null);
    assert.equal(updated.values.armLeft19, null);
  });

  it("accepts the lower boundary", () => {
    const state = createMeasurementFlowState();
    const updated = setCurrentValue(state, 0.1);
    assert.equal(updated.values.legRight1, 0.1);
  });

  it("accepts the upper boundary", () => {
    const state = createMeasurementFlowState();
    const updated = setCurrentValue(state, 300);
    assert.equal(updated.values.legRight1, 300);
  });

  it("leaves state unchanged when value is below the minimum", () => {
    const state = createMeasurementFlowState();
    const result = setCurrentValue(state, 0);
    assert.equal(result, state);
    assert.equal(result.values.legRight1, null);
  });

  it("leaves state unchanged when value is above the maximum", () => {
    const state = createMeasurementFlowState();
    const result = setCurrentValue(state, 300.01);
    assert.equal(result, state);
  });

  it("leaves state unchanged for non-finite numbers", () => {
    const state = createMeasurementFlowState();
    assert.equal(setCurrentValue(state, Number.NaN), state);
    assert.equal(setCurrentValue(state, Number.POSITIVE_INFINITY), state);
  });

  it("allows clearing a value with null", () => {
    const state = createMeasurementFlowState();
    const filled = setCurrentValue(state, 25);
    const cleared = setCurrentValue(filled, null);
    assert.equal(cleared.values.legRight1, null);
  });

  it("returns the same reference when setting the same value", () => {
    const state = createMeasurementFlowState();
    const filled = setCurrentValue(state, 25);
    const again = setCurrentValue(filled, 25);
    assert.equal(again, filled);
  });

  it("targets the step at stepIndex after navigation", () => {
    let state = createMeasurementFlowState();
    state = goNext(state);
    state = setCurrentValue(state, 18);
    assert.equal(state.values.legRight1, null);
    assert.equal(state.values.legRight2, 18);
  });
});
