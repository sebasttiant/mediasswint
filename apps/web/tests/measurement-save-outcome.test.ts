import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { completionFieldErrors, interpretSaveResponse } from "../lib/measurement-save-outcome";

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

  it("recognizes the MP completion refusal code returned with committed draft values", () => {
    const outcome = interpretSaveResponse(422, {
      code: "MP_COMPLETION_INVALID",
      committed: true,
      errors: [{ field: "valuesByKey.mpHeight", message: "required" }],
    });

    assert.equal(outcome.kind, "draft-saved-completion-refused");
    assert.equal(outcome.draftSaved, true);
  });

  it("maps key-addressable completion errors to their owning field keys", () => {
    assert.deepEqual(completionFieldErrors({ errors: [
      { field: "valuesByKey.mpHeight", message: "required" },
      { field: "templateSnapshot.fields.mpWeight", message: "invalid" },
    ] }), { mpHeight: "required", mpWeight: "invalid" });
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

  // B4: an unreadable STORED snapshot is refused before any write, so claiming
  // the draft was saved would be false in the opposite direction.
  it("an unreadable stored snapshot must NOT claim the draft was saved", () => {
    const outcome = interpretSaveResponse(422, { code: "MALFORMED_TEMPLATE_SNAPSHOT" });

    assert.equal(outcome.kind, "failed");
    assert.equal(outcome.draftSaved, false);
    assert.doesNotMatch(outcome.message, /[Gg]uardamos el borrador/);
    assert.match(outcome.message, /no se guardó nada|plantilla/i);
    assert.equal(outcome.keepEditing, true);
  });

  it("only INCOMPLETE_TEMPLATE_SNAPSHOT reports a saved draft", () => {
    const incomplete = interpretSaveResponse(422, { code: "INCOMPLETE_TEMPLATE_SNAPSHOT" });
    const malformed = interpretSaveResponse(422, { code: "MALFORMED_TEMPLATE_SNAPSHOT" });

    assert.equal(incomplete.draftSaved, true);
    assert.equal(malformed.draftSaved, false);
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
