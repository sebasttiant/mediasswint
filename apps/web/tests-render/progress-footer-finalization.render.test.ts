import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";

import { ProgressFooter } from "../app/patients/[id]/measurements/new/_components/progress-footer";
import { hasAttributeValue, render, textContent } from "./support/render";

/**
 * The domain refuses to finalize a session whose persisted template snapshot is
 * degraded or empty. The footer is where a clinician actually meets that
 * refusal, so the control must be disabled BEFORE the request is sent and must
 * say why — otherwise the only feedback is a 422 after the click.
 *
 * Draft saving must stay available throughout: the values already measured are
 * clinical data and refusing to finalize is not a reason to lose them.
 */

function footer(props: Partial<Parameters<typeof ProgressFooter>[0]> = {}) {
  return render(
    createElement(ProgressFooter, {
      filledCount: 1,
      totalCount: 3,
      saving: false,
      onSaveDraft: () => {},
      onComplete: () => {},
      ...props,
    }),
  );
}

describe("ProgressFooter finalization gating", () => {
  it("enables finalization when nothing blocks it", () => {
    const markup = footer();

    assert.equal(hasAttributeValue(markup, "data-complete-blocked", "false"), true);
    assert.equal(hasAttributeValue(markup, "data-complete-blocked", "true"), false);
  });

  it("disables finalization when the snapshot blocks it", () => {
    const markup = footer({ completeBlockedReason: "La plantilla no coincide." });

    assert.equal(hasAttributeValue(markup, "data-complete-blocked", "true"), true);
    // The disabled attribute must be on the markup the server sends, not applied
    // later by a client effect.
    assert.match(markup, /disabled=""/u);
  });

  it("shows the blocking reason instead of the progress hint", () => {
    const reason = "La plantilla de Máscara de esta sesión no coincide con la definición vigente.";
    const markup = footer({ completeBlockedReason: reason });

    const text = textContent(markup);
    assert.ok(text.includes(reason));
    assert.equal(text.includes("Podés guardar borrador o finalizar con pendientes"), false);
  });

  it("keeps the blocking reason visible even when every zone is filled", () => {
    // A complete-looking progress bar must not override the refusal.
    const markup = footer({
      filledCount: 3,
      totalCount: 3,
      completeBlockedReason: "Plantilla degradada.",
    });

    const text = textContent(markup);
    assert.ok(text.includes("Plantilla degradada."));
    assert.equal(text.includes("Ya podés cerrar la sesión"), false);
    assert.equal(hasAttributeValue(markup, "data-complete-blocked", "true"), true);
  });

  it("exposes the reason as a title so the disabled control is still explainable", () => {
    const markup = footer({ completeBlockedReason: "Sin medidas utilizables." });

    assert.match(markup, /title="Sin medidas utilizables\."/u);
  });

  it("keeps draft saving available while completion is blocked", () => {
    const markup = footer({ completeBlockedReason: "Plantilla degradada." });

    // Exactly one control is disabled: finalization. The draft button is not.
    assert.ok(textContent(markup).includes("Guardar borrador"));
    assert.equal((markup.match(/disabled=""/gu) ?? []).length, 1);
  });

  it("disables BOTH controls while a save is in flight", () => {
    const markup = footer({ saving: true });

    assert.equal((markup.match(/disabled=""/gu) ?? []).length, 2);
  });
});
