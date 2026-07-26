/**
 * How the measurement editor must interpret a PATCH response.
 *
 * The editor used to treat every non-ok response identically and tell the user
 * "No se pudieron guardar las medidas". That is false for a refused completion:
 * the server persists the draft values and refuses ONLY the transition to
 * COMPLETED. Telling a clinician their measurements were not saved when they
 * were invites duplicate data entry, or the belief that clinical data was lost.
 *
 * This is a pure function so the contract can be tested without a browser.
 */

const GENERIC_FAILURE = "No se pudieron guardar las medidas. Revisá rangos y campos.";

/**
 * Server codes that mean: the draft was written, only finalization was refused.
 * Both are returned with HTTP 422.
 */
const COMPLETION_REFUSED_CODES = new Set([
  "INCOMPLETE_TEMPLATE_SNAPSHOT",
  "MALFORMED_TEMPLATE_SNAPSHOT",
]);

export type SaveOutcome = {
  kind: "saved" | "draft-saved-completion-refused" | "failed";
  /** True when measured values reached the database despite a non-ok status. */
  draftSaved: boolean;
  /** Whether the editor should stay open and usable. */
  keepEditing: boolean;
  /** Whether the editor should navigate to the measurement detail page. */
  navigateToDetail: boolean;
  /** User-facing message; empty string when there is nothing to report. */
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: unknown, key: string): string | null {
  if (!isRecord(body)) return null;
  const value = body[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function interpretSaveResponse(status: number, body: unknown): SaveOutcome {
  if (status >= 200 && status < 300) {
    return {
      kind: "saved",
      draftSaved: true,
      keepEditing: false,
      navigateToDetail: true,
      message: "",
    };
  }

  const code = readString(body, "code");
  const reason = readString(body, "reason");

  if (status === 422 && code !== null && COMPLETION_REFUSED_CODES.has(code)) {
    // Deliberately explicit about BOTH halves: what was kept and what was not.
    const head = "Guardamos el borrador, pero no pudimos finalizar la sesión.";
    const tail = reason ?? "La plantilla de medidas de esta sesión no está completa.";
    return {
      kind: "draft-saved-completion-refused",
      draftSaved: true,
      keepEditing: true,
      navigateToDetail: false,
      message: `${head} ${tail}`,
    };
  }

  // Everything else genuinely failed: nothing was written, so the existing
  // generic message stays, unless the server explained itself.
  return {
    kind: "failed",
    draftSaved: false,
    keepEditing: true,
    navigateToDetail: false,
    message: reason ?? GENERIC_FAILURE,
  };
}
