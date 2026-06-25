/**
 * Computes whole-year age from an exact birth date.
 * Uses calendar-accurate year subtraction with birthday-month-day adjustment.
 * Equivalent to floor((now - birthDate) / year) but without floating point drift.
 * Clamped to >= 0.
 */
export function computeAge(birthDate: Date, now?: Date): number {
  const reference = now ?? new Date();
  if (reference.getTime() <= birthDate.getTime()) return 0;

  let years = reference.getUTCFullYear() - birthDate.getUTCFullYear();

  // Subtract 1 if the birthday hasn't occurred yet this calendar year.
  const monthDiff = reference.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = reference.getUTCDate() - birthDate.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }

  return Math.max(0, years);
}

/**
 * Approximate DOB for an entered age: July 1 of (currentYear - age).
 * Month index 6 = July in JavaScript Date.
 */
export function ageToApproxBirthDate(age: number, now?: Date): Date {
  const reference = now ?? new Date();
  return new Date(Date.UTC(reference.getUTCFullYear() - age, 6, 1));
}

/**
 * UTC YYYY-MM-DD string for use in <input type="date"> and the birthDate wire field.
 */
export function formatISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
