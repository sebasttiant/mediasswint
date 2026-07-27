import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyHeadSnapshot,
  extractHeadFieldDescriptors,
  getHeadSnapshotCompletionBlock,
  HEAD_ANATOMY_ZONE_PREFIX,
  type HeadSnapshotClassification,
  type HeadSnapshotLike,
} from "../lib/head-measurement-layout";

/**
 * Reads blockReason without narrowing `kind` first — asserting the kind narrows
 * the union, which would make a later `kind !== "none"` guard a type error.
 */
function blockReasonOf(classification: HeadSnapshotClassification): string | null {
  return classification.kind === "none" ? null : classification.blockReason;
}

/**
 * A persisted snapshot is a FROZEN copy of the template as it was when the
 * session was created. It can therefore disagree with the current definition —
 * a field renamed, dropped, or never written at all. Finalizing such a session
 * would freeze an incomplete clinical record, so the domain must be able to say
 * exactly WHICH of those states a stored snapshot is in.
 *
 * This is the classification the completion guard and the UI layout both read,
 * so it is pinned directly rather than only through its consumers.
 */

function field(key: string, anatomyZone: string | undefined, sortOrder: number) {
  return {
    key,
    sortOrder,
    metadata: anatomyZone === undefined ? {} : { anatomyZone },
  };
}

function snapshot(code: string, fields: ReturnType<typeof field>[]): HeadSnapshotLike {
  return { code, sections: [{ fields }] };
}

const MENTONERA_COMPLETE = snapshot("mentonera-v1", [
  field("mentoneraCrownChin", "head.crownChin", 1),
  field("mentoneraFaceLength", "head.faceLength", 2),
  field("mentoneraNeck", "head.neck", 3),
]);

const MASCARA_COMPLETE = snapshot("mascara-v1", [
  field("mascaraForehead", "head.forehead", 1),
  field("mascaraNeck", "head.neck", 2),
]);

describe("extractHeadFieldDescriptors", () => {
  it("keeps only fields carrying a head. anatomy zone", () => {
    const mixed = snapshot("mentonera-v1", [
      field("mentoneraNeck", "head.neck", 2),
      field("legRight1", "leg.right", 1),
      field("noZone", undefined, 3),
    ]);

    const descriptors = extractHeadFieldDescriptors(mixed);

    assert.deepEqual(
      descriptors.map((descriptor) => descriptor.key),
      ["mentoneraNeck"],
    );
    assert.ok(descriptors.every((d) => d.anatomyZone.startsWith(HEAD_ANATOMY_ZONE_PREFIX)));
  });

  it("orders descriptors by sortOrder, not by stored position", () => {
    const shuffled = snapshot("mentonera-v1", [
      field("mentoneraNeck", "head.neck", 3),
      field("mentoneraCrownChin", "head.crownChin", 1),
      field("mentoneraFaceLength", "head.faceLength", 2),
    ]);

    assert.deepEqual(
      extractHeadFieldDescriptors(shuffled).map((descriptor) => descriptor.key),
      ["mentoneraCrownChin", "mentoneraFaceLength", "mentoneraNeck"],
    );
  });

  it("ignores a non-string anatomy zone instead of throwing", () => {
    const broken = {
      code: "mentonera-v1",
      sections: [{ fields: [{ key: "x", sortOrder: 1, metadata: { anatomyZone: 42 } }] }],
    } as unknown as HeadSnapshotLike;

    assert.deepEqual(extractHeadFieldDescriptors(broken), []);
  });

  it("returns nothing for an absent snapshot", () => {
    assert.deepEqual(extractHeadFieldDescriptors(null), []);
    assert.deepEqual(extractHeadFieldDescriptors(undefined), []);
  });
});

describe("classifyHeadSnapshot", () => {
  it("classifies a snapshot matching the current definition as complete", () => {
    const classification = classifyHeadSnapshot(MENTONERA_COMPLETE);

    assert.equal(blockReasonOf(classification), null);
    assert.equal(classification.kind, "complete");
  });

  it("classifies a Máscara snapshot matching its own definition as complete", () => {
    assert.equal(classifyHeadSnapshot(MASCARA_COMPLETE).kind, "complete");
  });

  it("classifies a snapshot missing a field as degraded, naming the shortfall", () => {
    const degraded = snapshot("mentonera-v1", [
      field("mentoneraCrownChin", "head.crownChin", 1),
      field("mentoneraFaceLength", "head.faceLength", 2),
    ]);

    const classification = classifyHeadSnapshot(degraded);
    const blockReason = blockReasonOf(classification);

    assert.equal(classification.kind, "degraded");
    assert.ok(blockReason);
    assert.match(blockReason, /2 de 3/);
  });

  it("classifies a renamed field as degraded, not complete", () => {
    // Same COUNT, different identity — a count-only check would call this
    // complete and freeze a record whose keys no longer mean what they say.
    const renamed = snapshot("mentonera-v1", [
      field("mentoneraCrownChin", "head.crownChin", 1),
      field("mentoneraFaceLength", "head.faceLength", 2),
      field("mentoneraThroat", "head.neck", 3),
    ]);

    assert.equal(classifyHeadSnapshot(renamed).kind, "degraded");
  });

  it("classifies a head snapshot carrying no head fields as empty", () => {
    const empty = snapshot("mentonera-v1", [field("legRight1", "leg.right", 1)]);

    const classification = classifyHeadSnapshot(empty);
    const blockReason = blockReasonOf(classification);

    assert.equal(classification.kind, "empty");
    assert.ok(blockReason);
  });

  it("returns 'none' for a non-head template and for an absent snapshot", () => {
    assert.equal(classifyHeadSnapshot(snapshot("compression-v1", [])).kind, "none");
    assert.equal(classifyHeadSnapshot(null).kind, "none");
  });
});

describe("getHeadSnapshotCompletionBlock — the domain invariant in one call", () => {
  it("allows completion of a complete head snapshot", () => {
    assert.equal(getHeadSnapshotCompletionBlock(MENTONERA_COMPLETE), null);
    assert.equal(getHeadSnapshotCompletionBlock(MASCARA_COMPLETE), null);
  });

  it("refuses completion of a degraded or empty head snapshot", () => {
    const degraded = snapshot("mascara-v1", [field("mascaraForehead", "head.forehead", 1)]);
    const empty = snapshot("mascara-v1", []);

    assert.ok(getHeadSnapshotCompletionBlock(degraded));
    assert.ok(getHeadSnapshotCompletionBlock(empty));
  });

  it("NEVER gates a non-head template — the guard narrows head garments only", () => {
    assert.equal(getHeadSnapshotCompletionBlock(snapshot("compression-v1", [])), null);
    assert.equal(getHeadSnapshotCompletionBlock(null), null);
    assert.equal(getHeadSnapshotCompletionBlock(undefined), null);
  });
});
