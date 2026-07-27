/**
 * Head-view composition contract.
 *
 * Single source of truth for HOW a head-measurement garment is drawn: which
 * head panels appear, how the figure is cropped, how wide it may render, and
 * which measurement lines belong to it.
 *
 * This exists because composition must be DECLARED, never inferred. An earlier
 * iteration decided "which lines to show" from a hardcoded array in the shell
 * and derived the figure's accessible description from a hardcoded sentence
 * that said "3 medidas de mentonera" for every garment — so Máscara announced
 * itself as Mentonera and drew a bare profile head the client's form never
 * shows. Composition now travels with the template code.
 *
 * Authoritative source: the client's "Máscara y mentonera" form.
 *   - MÁSCARA panel  -> ONE frontal head; forehead contour + neck circumference.
 *   - MENTONERA panel -> profile head (crown-chin, face length, neck) plus the
 *     frontal neck tape, so the neck reads on both heads.
 */

/** Which traced head a measurement line is drawn on. */
export type HeadPanelId = "front" | "profile";

export type HeadViewCrop = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type HeadViewComposition = {
  /** Template code this composition belongs to. */
  readonly templateCode: string;
  /** Clinical garment name shown in the panel heading and a11y description. */
  readonly garmentLabel: string;
  /** Head panels actually painted. Drives both the crop and the marker filter. */
  readonly panels: ReadonlyArray<HeadPanelId>;
  /** viewBox applied to the traced HeadFigure so unused panels are cropped out. */
  readonly crop: HeadViewCrop;
  /**
   * Desktop cap for the rendered figure. Chosen per-composition so a narrower
   * crop cannot letterbox into a taller figure than the footer-safe height:
   * every composition renders at most ~418px tall (crop.height / crop.width *
   * maxWidthPx), which is the user-approved Mentonera height.
   */
  readonly maxWidthPx: number;
  /** `${zoneId}.${panel}` keys of every marker this composition paints. */
  readonly zoneKeys: ReadonlyArray<string>;
  /** Ordered [fieldKey, anatomyZone] pairs a complete snapshot must contain. */
  readonly expectedFields: ReadonlyArray<readonly [string, string]>;
};

/**
 * Zone labels, owned here so the figure, the field strip and the accessible
 * description all read from one place.
 */
export const HEAD_ZONE_LABELS: Readonly<Record<string, string>> = {
  "head.forehead": "Contorno de la cabeza alrededor de la frente",
  "head.crownChin": "Contorno mentón–coronilla",
  "head.faceLength": "Largo de cara (frente–mentón)",
  "head.neck": "Contorno de cuello",
};

/** Full traced figure: front head on the left, profile head on the right. */
export const HEAD_FIGURE_FULL_CROP: HeadViewCrop = {
  x: 0,
  y: 0,
  width: 331,
  height: 247,
} as const;

/**
 * Front head only. The traced artwork separates cleanly: every front path lies
 * in x [8.48, 138.20] and every profile path in x [179.22, 323.22], with no
 * path straddling the gap, so cutting at x=150 removes the profile head
 * without clipping a single front stroke. y is tightened to 222 because the
 * front head's ink ends at y=209.69 (the profile chin/neck is what reaches
 * y=239).
 */
export const HEAD_FIGURE_FRONT_CROP: HeadViewCrop = {
  x: 0,
  y: 0,
  width: 150,
  height: 222,
} as const;

export const MENTONERA_TEMPLATE_CODE_REF = "mentonera-v1";
export const MASCARA_TEMPLATE_CODE_REF = "mascara-v1";

const MENTONERA_COMPOSITION: HeadViewComposition = {
  templateCode: MENTONERA_TEMPLATE_CODE_REF,
  garmentLabel: "Mentonera",
  panels: ["front", "profile"],
  crop: HEAD_FIGURE_FULL_CROP,
  // User-approved scale. 560 / 331 * 247 = 418px tall.
  maxWidthPx: 560,
  zoneKeys: [
    "head.crownChin.profile",
    "head.faceLength.profile",
    "head.neck.profile",
    "head.neck.front",
  ],
  expectedFields: [
    ["mentoneraCrownChin", "head.crownChin"],
    ["mentoneraFaceLength", "head.faceLength"],
    ["mentoneraNeck", "head.neck"],
  ],
};

const MASCARA_COMPOSITION: HeadViewComposition = {
  templateCode: MASCARA_TEMPLATE_CODE_REF,
  garmentLabel: "Máscara",
  panels: ["front"],
  crop: HEAD_FIGURE_FRONT_CROP,
  // 280 / 150 * 222 = 414px tall — under Mentonera's approved 418px, so the
  // whole figure still clears the sticky footer.
  maxWidthPx: 280,
  zoneKeys: ["head.forehead.front", "head.neck.front"],
  expectedFields: [
    ["mascaraForehead", "head.forehead"],
    ["mascaraNeck", "head.neck"],
  ],
};

const COMPOSITIONS_BY_TEMPLATE_CODE: Readonly<Record<string, HeadViewComposition>> = {
  [MENTONERA_TEMPLATE_CODE_REF]: MENTONERA_COMPOSITION,
  [MASCARA_TEMPLATE_CODE_REF]: MASCARA_COMPOSITION,
};

/** Template codes that render through the head-measurement layout. */
export const HEAD_MEASUREMENT_TEMPLATE_CODES: ReadonlyArray<string> = Object.keys(
  COMPOSITIONS_BY_TEMPLATE_CODE,
);

export function getHeadViewComposition(templateCode: string): HeadViewComposition | null {
  return COMPOSITIONS_BY_TEMPLATE_CODE[templateCode] ?? null;
}

export function isHeadMeasurementTemplateCode(templateCode: string): boolean {
  return getHeadViewComposition(templateCode) !== null;
}

/** Split a `${zoneId}.${panel}` key back into its parts. */
export function parseHeadZoneKey(zoneKey: string): { zoneId: string; panel: HeadPanelId } | null {
  if (zoneKey.endsWith(".front")) {
    return { zoneId: zoneKey.slice(0, -".front".length), panel: "front" };
  }
  if (zoneKey.endsWith(".profile")) {
    return { zoneId: zoneKey.slice(0, -".profile".length), panel: "profile" };
  }
  return null;
}

function describePanels(panels: ReadonlyArray<HeadPanelId>): string {
  const hasFront = panels.includes("front");
  const hasProfile = panels.includes("profile");
  if (hasFront && hasProfile) return "vistas frontal y de perfil";
  if (hasProfile) return "vista de perfil";
  if (hasFront) return "vista frontal";
  return "sin vistas";
}

/**
 * Accessible description for the head figure, GENERATED from the composition
 * and the zones actually painted — never a hardcoded sentence. `zoneKeys` is
 * passed in (rather than read off the composition) so a degraded snapshot
 * describes the markers the user can really see.
 */
export function buildHeadFigureDescription(
  composition: HeadViewComposition,
  zoneKeys: ReadonlyArray<string> = composition.zoneKeys,
): string {
  const zoneIds: string[] = [];
  for (const zoneKey of zoneKeys) {
    const parsed = parseHeadZoneKey(zoneKey);
    if (!parsed) continue;
    if (!zoneIds.includes(parsed.zoneId)) zoneIds.push(parsed.zoneId);
  }

  const panelText = describePanels(composition.panels);

  if (zoneIds.length === 0) {
    return `Referencia clínica de ${composition.garmentLabel}: ${panelText}. Sin medidas disponibles.`;
  }

  const labels = zoneIds.map((zoneId) => HEAD_ZONE_LABELS[zoneId] ?? zoneId);
  const measureWord = zoneIds.length === 1 ? "medida" : "medidas";

  return `Referencia clínica de ${composition.garmentLabel}: ${panelText}. ${zoneIds.length} ${measureWord}: ${labels.join(", ")}.`;
}

/** aria-label for the figure, generated the same way. */
export function buildHeadFigureAriaLabel(composition: HeadViewComposition): string {
  return `Figura de cabeza para ${composition.garmentLabel} con zonas de medición`;
}

// ---------------------------------------------------------------------------
// Head snapshot validity — PURE DOMAIN CONTRACT.
//
// This is the single source of truth for "is this persisted head snapshot
// usable, and may the session be completed?". It is deliberately free of React,
// of UI field types and of Prisma: the measurement service enforces the
// invariant with it on the server, and the measurement UI derives its layout
// from it on the client. Neither duplicates the rules.
//
// The invariant it protects: a session whose template snapshot claims to be a
// head garment but does not carry that garment's full measurement set must
