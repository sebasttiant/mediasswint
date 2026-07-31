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
 * The ONLY code that means "the draft was written, finalization was refused".
 *
 * MALFORMED_TEMPLATE_SNAPSHOT deliberately does NOT belong here. The service
 * detects an unreadable stored snapshot BEFORE any write, so nothing was saved;
 * telling the clinician their draft was kept would be exactly as false as the
 * bug this contract exists to fix, only in the opposite direction.
 */
const COMPLETION_REFUSED_CODE = "INCOMPLETE_TEMPLATE_SNAPSHOT";
const MP_COMPLETION_REFUSED_CODE = "MP_COMPLETION_INVALID";

/** An unreadable stored snapshot: nothing was written, and it is not the user's input. */
const UNREADABLE_SNAPSHOT_CODE = "MALFORMED_TEMPLATE_SNAPSHOT";

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

export function completionFieldErrors(body: unknown): Record<string, string> {
  if (!isRecord(body) || !Array.isArray(body.errors)) return {};
  return Object.fromEntries(body.errors.flatMap((error) => {
    if (!isRecord(error) || typeof error.field !== "string" || typeof error.message !== "string") return [];
    const key = error.field.replace(/^(valuesByKey|templateSnapshot\.fields)\./, "");
    return key === error.field ? [] : [[key, error.message]];
  }));
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

  if (status === 422 && code === UNREADABLE_SNAPSHOT_CODE) {
    return {
      kind: "failed",
      draftSaved: false,
      keepEditing: true,
      navigateToDetail: false,
      message:
        reason ??
        "No pudimos leer la plantilla guardada de esta sesión, así que no se guardó nada. " +
          "Avisá al equipo para regenerarla.",
    };
  }

  // Two distinct domain refusals reach the same clinician-facing outcome: the
  // head-template one, which writes the draft before refusing, and the MP one,
  // which says so on the wire. MP is only trusted to be a draft-saved refusal
  // when it actually claims `committed`, so a future non-committing 422 under
  // the same code cannot silently tell a clinician their values were kept.
  const mpDraftSavedRefusal =
    code === MP_COMPLETION_REFUSED_CODE && isRecord(body) && body.committed === true;

  if (status === 422 && (code === COMPLETION_REFUSED_CODE || mpDraftSavedRefusal)) {
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
