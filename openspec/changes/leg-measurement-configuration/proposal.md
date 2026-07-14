# Proposal: Leg Measurement Configuration (MR format)

**Status: BLOCKED — pending client clarification.**

Implementation of the count-dependent work is deliberately NOT started. See
`client-clarification.md` for the exact question that unblocks it, and
`exploration.md` for the evidence.

## Intent

Replace the current opaque 28-ordinal-per-leg measurement model with the real
clinical model used by the MR (`Media a la rodilla`) capture form: a fixed,
ordered set of **named anatomical circumferences** plus the **measured
intermediate distances** between them.

## Why the current model is wrong

`apps/web/lib/compression-measurements.ts` declares `LEG_POINTS = [1..28]`.
Each point is an opaque ordinal rendered as `"Pierna derecha punto 7"`. The
model has:

- no anatomical meaning per point;
- no distinction between a **circumference** and a **distance**;
- no representation of the intermediate distances the form asks the clinician
  to record.

The clinical form prescribes something structurally different.

## The blocking ambiguity

The evidence is self-contradictory on the total number of values per leg.

| Source | Says |
| --- | --- |
| `Formato Toma de mdidas MR 2024 18oct.pdf` (authoritative form) | 7 circumferences + 6 intermediate distances = **13** per leg |
| Client annotation on `MEDIDAS 15 .png` | "ENTRE ESO SOLO **15** MEDIDAS" |

The two extra values needed to reach 15 are **not defined anywhere** in the
form. Choosing 13 or 15 is not a cosmetic decision: it determines the seeded
`MeasurementTemplate`, the hand-traced SVG zone paths, and how existing
28-ordinal sessions are reinterpreted. It is therefore not guessed here.

## Scope

### In Scope (blocked until the count is confirmed)
- Named, typed leg measurement catalog (`circumference` | `distance` kind).
- Server-boundary validation of exact completeness and ordering.
- Re-traced SVG zone paths for the new leg positions, both sexes.
- Template re-seed and a backward-compatibility strategy for historical sessions.

### In Scope (count-independent, DONE in this change)
- Remove duplicated per-side point counts so the future migration has exactly
  one place to change.
- Add a regression guard so a leg-count change can no longer silently render
  fallback SVG rectangles instead of traced anatomy.

### Out of Scope
- The 3.8 cm band spacing. It belongs to a **different garment format** (MP /
  amputee stump), not to the MR knee-high leg. See `exploration.md`.
- Arm measurements (19 per side) — untouched.
- Sucursal (PR #112) and patient EPS work.

## Approach

Two-stage. Stage 1 (this change) lands only work that is correct regardless of
whether the answer is 13 or 15. Stage 2 lands the catalog, validation, SVG
re-tracing, and migration once the client confirms the count.
