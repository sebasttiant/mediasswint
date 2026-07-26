import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { interpretSaveResponse } from "../lib/measurement-save-outcome";

/**
 * F9 — the client told the user "no se pudieron guardar las medidas" for EVERY
 * non-ok response. A 422 INCOMPLETE_TEMPLATE_SNAPSHOT means the opposite: the
 * draft values WERE persisted and only finalization was refused. Reporting that
 * as a save failure invites the clinician to re-enter data that is already
 * stored, or to believe measurements were lost.
 */
describe("interpretSaveResponse — partial success must not be reported as failure", () => {
  it("treats a 200 as a completed save", () => {
    const outcome = interpretSaveResponse(200, {});

    assert.equal(outcome.kind, "saved");
  });

  it("reports a refused completion as draft-saved, NOT as a failed save", () => {
    const outcome = interpretSaveResponse(422, {
      code: "INCOMPLETE_TEMPLATE_SNAPSHOT",
      reason: "La plantilla de Máscara de esta sesión no coincide con la definición vigente.",
    });

    assert.equal(outcome.kind, "draft-saved-completion-refused");
    assert.equal(outcome.draftSaved, true);
    assert.match(outcome.message, /guard/i, "must say the draft was saved");
    assert.doesNotMatch(
      outcome.message,
      /no se pudieron guardar/i,
      "must never claim the measurements were not saved",
    );
    assert.match(outcome.message, /finaliz/i, "must say finalization was refused");
  });

  it("carries the server's reason through so the user can act on it", () => {
    const reason = "La plantilla de Mentonera de esta sesión no tiene medidas utilizables.";
    const outcome = interpretSaveResponse(422, {
      code: "INCOMPLETE_TEMPLATE_SNAPSHOT",
      reason,
    });

    assert.ok(outcome.message.includes(reason));
  });

  it("keeps the session editable after a refused completion", () => {
    const outcome = interpretSaveResponse(422, { code: "INCOMPLETE_TEMPLATE_SNAPSHOT" });

    assert.equal(outcome.keepEditing, true);
    assert.equal(outcome.navigateToDetail, false);
  });

  it("navigates away only on a real completed save", () => {
    assert.equal(interpretSaveResponse(200, {}).navigateToDetail, true);
  });

  it("an unreadable stored snapshot is also a refusal, not a lost save", () => {
    const outcome = interpretSaveResponse(422, { code: "MALFORMED_TEMPLATE_SNAPSHOT" });

    assert.equal(outcome.kind, "draft-saved-completion-refused");
    assert.doesNotMatch(outcome.message, /no se pudieron guardar/i);
  });

  it("a cross-garment refusal is a genuine failure: nothing was written", () => {
    const outcome = interpretSaveResponse(409, {
      code: "GARMENT_TEMPLATE_MISMATCH",
      reason: "La prenda solicitada usa una plantilla de medidas distinta.",
    });

    assert.equal(outcome.kind, "failed");
    assert.equal(outcome.draftSaved, false);
    assert.match(outcome.message, /plantilla de medidas distinta/);
  });

  it("keeps the existing generic message for an ordinary validation failure", () => {
    const outcome = interpretSaveResponse(400, {
      errors: [{ field: "valuesByKey", message: "unknown measurement keys" }],
    });

    assert.equal(outcome.kind, "failed");
    assert.equal(outcome.draftSaved, false);
    assert.match(outcome.message, /No se pudieron guardar las medidas/);
  });

  it("keeps the generic message for a 500 and for an unparsable body", () => {
    assert.match(interpretSaveResponse(500, null).message, /No se pudieron guardar las medidas/);
    assert.match(
      interpretSaveResponse(503, "not json" as unknown).message,
      /No se pudieron guardar las medidas/,
    );
  });

  it("does not mistake a 422 without a known code for partial success", () => {
    const outcome = interpretSaveResponse(422, { error: "something else" });

    assert.equal(outcome.kind, "failed");
    assert.equal(outcome.draftSaved, false);
  });
});
