import type { TemplateSnapshot } from "./measurements";
import { MP_BERMUDA_TEMPLATE_CODE, buildMpBermudaTemplate } from "./mp-bermuda-template";

const MP_BERMUDA_LAYOUT_STATES = {
  // `not-mp` is the ownership answer, not a degradation: the snapshot belongs to
  // another template (compression, Mentonera, Máscara) or is absent altogether,
  // and MP must keep its hands off whatever renders it. The remaining states all
  // mean "this IS an MP snapshot, in this condition", so a caller may only reach
  // for an MP degraded view once it has ruled `not-mp` out.
  NOT_MP: "not-mp",
  COMPLETE: "complete",
  VISUAL_DEGRADED: "visual-degraded",
  CLINICAL_INCOMPLETE: "clinical-incomplete",
  STRUCTURALLY_MALFORMED: "structurally-malformed",
} as const;

export type MpBermudaLayoutState = (typeof MP_BERMUDA_LAYOUT_STATES)[keyof typeof MP_BERMUDA_LAYOUT_STATES];
export type MpBermudaSnapshotClassification = { kind: MpBermudaLayoutState; reason: string | null };

const canonicalFields = buildMpBermudaTemplate().sections.flatMap((section) => section.fields);

function hasClinicalMetadata(field: TemplateSnapshot["sections"][number]["fields"][number]): boolean {
  const expected = canonicalFields.find((candidate) => candidate.key === field.key);
  if (!expected) return false;
  const metadata = field.metadata;
  const canonicalMetadata = expected.metadata;
  return metadata.side === canonicalMetadata.side
    && metadata.kind === canonicalMetadata.kind
    && metadata.stationId === canonicalMetadata.stationId
    && metadata.fromStationId === canonicalMetadata.fromStationId
    && metadata.toStationId === canonicalMetadata.toStationId
    && field.isRequired === expected.isRequired;
}

export function classifyMpBermudaSnapshot(snapshot: TemplateSnapshot | null | undefined): MpBermudaSnapshotClassification {
  if (!snapshot || snapshot.code !== MP_BERMUDA_TEMPLATE_CODE) {
    return { kind: MP_BERMUDA_LAYOUT_STATES.NOT_MP, reason: null };
  }
  const fields = snapshot.sections.flatMap((section) => section.fields);
  if (fields.length === 0) {
    return { kind: MP_BERMUDA_LAYOUT_STATES.STRUCTURALLY_MALFORMED, reason: "Unreadable MP/Bermuda snapshot." };
  }
  const keys = new Set(fields.map((field) => field.key));
  const canonicalKeys = new Set(canonicalFields.map((field) => field.key));
  if (fields.length !== canonicalFields.length || keys.size !== fields.length || [...keys].some((key) => !canonicalKeys.has(key)) || fields.some((field) => !hasClinicalMetadata(field))) {
    return { kind: MP_BERMUDA_LAYOUT_STATES.CLINICAL_INCOMPLETE, reason: "The MP/Bermuda clinical field contract is incomplete." };
  }
  const visualUsable = fields.every((field) => field.metadata.layout === "mp-bermuda" && typeof field.metadata.markerId === "string");
  return visualUsable
    ? { kind: MP_BERMUDA_LAYOUT_STATES.COMPLETE, reason: null }
    : { kind: MP_BERMUDA_LAYOUT_STATES.VISUAL_DEGRADED, reason: "Visual marker metadata is unavailable." };
}
