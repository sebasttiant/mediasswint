import {
  COMPRESSION_MEASUREMENTS,
  type AnatomyZoneId,
  type CompressionMeasurementDefinition,
  type CompressionMeasurementKey,
} from "./compression-measurements";

export type MeasurementStep = {
  index: number;
  key: CompressionMeasurementKey;
  zoneId: AnatomyZoneId;
  label: string;
  unit: "cm";
  min: number;
  max: number;
};

export type MeasurementValuesByKey = Readonly<
  Record<CompressionMeasurementKey, number | null>
>;

export type MeasurementFlowState = {
  readonly steps: ReadonlyArray<MeasurementStep>;
  readonly stepIndex: number;
  readonly values: MeasurementValuesByKey;
};

function toStep(
  definition: CompressionMeasurementDefinition,
  index: number,
): MeasurementStep {
  return {
    index,
    key: definition.key,
    zoneId: definition.anatomyZone,
    label: definition.label,
    unit: definition.unit,
    min: definition.min,
    max: definition.max,
  };
}

export function buildMeasurementSteps(
  catalog: ReadonlyArray<CompressionMeasurementDefinition> = COMPRESSION_MEASUREMENTS,
): ReadonlyArray<MeasurementStep> {
  return catalog.map((definition, index) => toStep(definition, index));
}

function buildEmptyValues(
  steps: ReadonlyArray<MeasurementStep>,
): MeasurementValuesByKey {
  return Object.fromEntries(
    steps.map((step) => [step.key, null] as const),
  ) as MeasurementValuesByKey;
}

export function createMeasurementFlowState(
  catalog: ReadonlyArray<CompressionMeasurementDefinition> = COMPRESSION_MEASUREMENTS,
): MeasurementFlowState {
  const steps = buildMeasurementSteps(catalog);
  return {
    steps,
    stepIndex: 0,
    values: buildEmptyValues(steps),
  };
}

export function getCurrentStep(state: MeasurementFlowState): MeasurementStep | null {
  return state.steps[state.stepIndex] ?? null;
}

export function getActiveZoneId(state: MeasurementFlowState): AnatomyZoneId | null {
  const step = getCurrentStep(state);
  return step ? step.zoneId : null;
}

export function goNext(state: MeasurementFlowState): MeasurementFlowState {
  if (state.steps.length === 0) return state;
  const nextIndex = Math.min(state.stepIndex + 1, state.steps.length - 1);
  if (nextIndex === state.stepIndex) return state;
  return { ...state, stepIndex: nextIndex };
}

export function goPrev(state: MeasurementFlowState): MeasurementFlowState {
  const prevIndex = Math.max(state.stepIndex - 1, 0);
  if (prevIndex === state.stepIndex) return state;
  return { ...state, stepIndex: prevIndex };
}

export function setCurrentValue(
  state: MeasurementFlowState,
  value: number | null,
): MeasurementFlowState {
  const step = getCurrentStep(state);
  if (!step) return state;

  if (value !== null) {
    if (typeof value !== "number" || !Number.isFinite(value)) return state;
    if (value < step.min || value > step.max) return state;
  }

  if (state.values[step.key] === value) return state;

  return {
    ...state,
    values: { ...state.values, [step.key]: value },
  };
}
