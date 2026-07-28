import { COMPRESSION_TEMPLATE_CODE } from "./compression-template";
import { MASCARA_TEMPLATE_CODE } from "./mascara-template";
import { MENTONERA_TEMPLATE_CODE } from "./mentonera-template";

export const MP_BERMUDA_TEMPLATE_CODE = "mp-bermuda-v1";

/**
 * Maps a garment catalog reference (see `garment-catalog.ts`) to the
 * measurement `templateCode` that should back a new draft session. Only
 * garments with a dedicated measurement template are listed here; every
 * other reference falls back to `compression-v1` in `resolveTemplateCode`.
 */
const TEMPLATE_CODE_BY_REFERENCE: Record<string, string> = {
  MA: MASCARA_TEMPLATE_CODE,
  MMA: MASCARA_TEMPLATE_CODE,
  ME: MENTONERA_TEMPLATE_CODE,
  MP: MP_BERMUDA_TEMPLATE_CODE,
  MPD: MP_BERMUDA_TEMPLATE_CODE,
  MPI: MP_BERMUDA_TEMPLATE_CODE,
  BP: MP_BERMUDA_TEMPLATE_CODE,
  BD: MP_BERMUDA_TEMPLATE_CODE,
  BI: MP_BERMUDA_TEMPLATE_CODE,
};

/**
 * Resolves the measurement `templateCode` for a garment reference. Unknown,
 * empty, null, or undefined references safely fall back to
 * `compression-v1` — this function never throws.
 */
export function resolveTemplateCode(reference: string | null | undefined): string {
  const normalized = reference?.trim().toUpperCase();
  if (!normalized) return COMPRESSION_TEMPLATE_CODE;

  return TEMPLATE_CODE_BY_REFERENCE[normalized] ?? COMPRESSION_TEMPLATE_CODE;
}
