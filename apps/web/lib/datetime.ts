/**
 * Deterministic date/time formatting for the clinic UI.
 *
 * Root cause this guards against: `Date.prototype.toLocaleString` and
 * `Intl.DateTimeFormat` without an explicit `timeZone` fall back to the runtime
 * timezone. The server (container, UTC) and the browser (clinic, UTC-5) then
 * render different text for the same instant, which breaks React hydration on
 * any client component that prints a date/time.
 *
 * Fix: always format against a fixed, explicit clinic timezone so server and
 * client produce identical strings. Use these helpers everywhere a date is
 * shown — never call toLocale or Intl date formatters with only a locale.
 */

// Clinic operates in Colombia (UTC-5). Single source of truth for display tz.
export const CLINIC_TIME_ZONE = "America/Bogota";
export const CLINIC_LOCALE = "es-CO";

export type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Date + time, e.g. "1/06/2026, 5:03 p. m." — stable across server/client. */
export function formatClinicDateTime(value: DateInput): string {
  return new Intl.DateTimeFormat(CLINIC_LOCALE, {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(toDate(value));
}

/** Date only, e.g. "1/06/2026" — stable across server/client. */
export function formatClinicDate(value: DateInput): string {
  return new Intl.DateTimeFormat(CLINIC_LOCALE, {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "short",
  }).format(toDate(value));
}

/**
 * Convert an instant to a `datetime-local` input value ("YYYY-MM-DDTHH:mm") in
 * the clinic timezone, deterministically. Replaces the getTimezoneOffset()
 * approach, which produced different strings on the server (UTC) and the client
 * (clinic tz) and broke hydration of the measurement form / header.
 */
export function toClinicDatetimeLocal(value: DateInput): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(toDate(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Render a tz-naive `datetime-local` wall-clock string ("YYYY-MM-DDTHH:mm") with
 * a long, stable format. The string is parsed and formatted as UTC so the
 * wall-clock the user picked is shown verbatim, identically on server and
 * client (no runtime-timezone drift).
 */
export function formatWallClockLong(localDateTime: string): string {
  const withSeconds = localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime;
  return new Intl.DateTimeFormat(CLINIC_LOCALE, {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(`${withSeconds}Z`));
}
