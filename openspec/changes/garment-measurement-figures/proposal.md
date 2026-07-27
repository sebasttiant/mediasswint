# Proposal: Per-Garment Measurement Figures (Mentonera pilot)

## Intent

Today the "Nueva medición" flow shows ONE generic full-body figure and an opaque
fixed ~94-point catalog for EVERY garment. Clinicians must map a real capture
form (leg / hand / face / torso) onto an unrelated body diagram. This change
makes each garment load ITS OWN dedicated figure and ITS OWN named, typed
measurement set, replicating the client's real forms. It ships ONE garment —
**Mentonera** (`ME`, figureKey `head-or-hand`) — and frames the reusable
per-garment configuration architecture that later garments and the BLOCKED leg
change will consume.

## Scope

### In Scope
- New additive template `mentonera-v1` seeded via `syncMeasurementTemplate`:
  3 fixed typed fields — crown-to-chin circumference, forehead-to-chin face
  length, neck circumference.
- Resolve `templateCode` from the selected garment (its catalog `figureKey`)
  instead of the hardcoded `compression-v1`; fall back to `compression-v1` for
  garments without a dedicated template.
- Dedicated brand-neutral face figure (front + side profile) with its own
  anatomy zone ids, reusing/extending existing `HeadDetail` silhouettes.
- Reusable seam: garment → templateCode + figureKey → figure + zones, so later
  garments plug in without reinterpreting existing records.

### Out of Scope / BLOCKED
- **Leg (MR)** — 13-vs-15 count BLOCKED (`leg-measurement-configuration/client-clarification.md`).
- Variable-count interval bands (glove 5cm, chaqueta 4cm, stump 3.8cm).
- Product sub-variants (máscara media/completa). Mentonera is single-variant.
- Embedding branded client PDFs. Trace clean SVGs into `apps/web/public/anatomy/`.

## Capabilities

### New Capabilities
- `garment-measurement-configuration`: per-garment resolution of measurement
  template + dedicated figure + anatomy zones, with generic fallback.

### Modified Capabilities
- None. Existing `web-admin-measurement-ui` highlight/capture/persistence
  behavior is a protected invariant and must not regress.

## Approach

Backward-compat is already structural: `createDraftMeasurement` FREEZES a
`templateSnapshot` per session, so historical records always render from their
own snapshot. Adding `mentonera-v1` is additive (new rows, NO migration, NO
reinterpretation). The only integration seam is resolving `templateCode` from
the garment catalog in the create route. The generic `body-highlight` component
stays untouched; the new figure supplies its own zone ids + traced SVG.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/lib/measurement-templates.ts` (+ new mentonera builder) | New | Seed `mentonera-v1` |
| `apps/web/app/api/patients/[id]/measurements/route.ts` | Modified | Resolve templateCode from garment |
| `apps/web/lib/garment-catalog.ts` | Modified | Map `ME` → templateCode |
| `apps/web/app/_components/body-highlight/silhouettes/` + `public/anatomy/` | New | Face figure + zones |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regressing generic highlight sync | Med | No edits to shared component; regression test |
| Wrong garment→template fallback | Low | Default to `compression-v1` for unmapped garments |
| PR exceeds 400 lines | Med | Chained PRs per garment; Mentonera slice only |

## Rollback Plan

Fully additive. Revert the `templateCode` resolution to the `compression-v1`
constant and unregister `mentonera-v1`. No data migration to undo; frozen
session snapshots are unaffected.

## Dependencies

- Builds on merged `garment-figure-focus.ts` seam.
- Traced face SVG asset (brand-neutral) copied into `apps/web/public/anatomy/`.

## Success Criteria

- [ ] Selecting Mentonera loads the face figure and exactly its 3 typed fields.
- [ ] Non-Mentonera garments keep the current generic figure and catalog.
- [ ] Historical sessions render unchanged from their frozen snapshot.
- [ ] Highlight/capture/persistence invariant verified by tests; slice < 400 lines.
