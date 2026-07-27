# Design: Per-Garment Measurement Figures (Mentonera pilot)

## Technical Approach

Add one additive template (`mentonera-v1`) plus a pure garment→template resolver,
reusing the existing template/snapshot/highlight machinery. The create route stops
hardcoding `compression-v1` and instead resolves the template from the selected
garment reference, falling back to `compression-v1` for every unmapped garment so
all non-Mentonera flows stay byte-for-byte unchanged. The generic
`filledZoneIds`/`activeZoneId` → `ZoneMarker` mechanism in `body-highlight.tsx` is
NOT edited; Mentonera plugs into it by supplying its own `anatomyZone` ids and
traced head zones. Delivered as two chained PRs (data seam, then figure/UI).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Resolve `templateCode` | Pure `resolveTemplateCode(reference)` keyed by garment **reference** (`ME → mentonera-v1`), default `compression-v1` | Key by `figureKey` | `HEAD_OR_HAND` is shared by masks/gloves — only `ME` must switch template. Reference is exact. |
| Resolver location / wiring | New `lib/garment-template-resolver.ts`; route computes code from `parsed.value.garmentType` via `deps.resolveTemplateCode` (default = real resolver) | Inline map in route.ts | Pure + injectable = unit-testable; keeps `defaultDeps` override seam intact. |
| Mentonera template build | New `buildMentoneraTemplate()` in `lib/mentonera-template.ts`, seeded via existing `syncMeasurementTemplate` | Extend compression builder | Different anatomy/metadata; additive sibling keeps compression untouched. |
| Generalize sync input type | Widen `syncMeasurementTemplate` param to a structural `MeasurementTemplateInput` with `metadata: Record<string, unknown>` | Keep `CompressionTemplate` only | `CompressionTemplate` stays assignable (specific metadata ⊆ `Record<string,unknown>`); no compression change. |
| Metadata generalization | Add optional `kind?: "circumference" \| "length"`. Compression keeps `{anatomyZone,group,side,point}` (no `kind`); Mentonera uses `{anatomyZone,kind}` | Replace metadata shape | `getFilledZoneIdsFromValues` reads only `anatomyZone` → works for both; `buildMeasurementTableRows` filters by `group` → safely skips Mentonera. |
| `AnatomyZoneId` type | Additively extend union with `` `head.${string}` `` | Broaden to `string` | Keeps existing ids valid + typed; head zones become first-class. |
| Shell layout | Guarded garment-specific branch (render head figure + 3-field strip when `code === "mentonera-v1"`); compression path unchanged | Full template-driven generalization | Compression shell is hardwired legs/arms 3-column; full rewrite is high-risk and out of scope. |

## Data Flow

    Client (garmentType=ME) ─POST─▶ route.ts
        resolveTemplateCode("ME") ─▶ "mentonera-v1"
        createDraftMeasurement(templateCode) ─▶ getActiveTemplateSnapshot
        ─▶ FREEZE templateSnapshot on session (metadata: {anatomyZone, kind})
    Shell reads snapshot.code ─▶ head layout
        getFilledZoneIdsFromValues(snapshot,values) ─▶ Set<head.*>
        BodyHighlight(filledZoneIds) ─▶ same ZoneMarker (unchanged)

## Interfaces / Contracts

```ts
// lib/garment-template-resolver.ts
const TEMPLATE_CODE_BY_REFERENCE: Record<string, string> = { ME: "mentonera-v1" };
export function resolveTemplateCode(reference: string | null | undefined): string; // default "compression-v1"

// mentonera-v1 fields (unit cm, range ~0.1–200)
// mentoneraCrownChin  "Contorno mentón–coronilla"   {anatomyZone:"head.crownChin",  kind:"circumference"}
// mentoneraFaceLength "Largo de cara (frente–mentón)" {anatomyZone:"head.faceLength", kind:"length"}
// mentoneraNeck       "Contorno de cuello"           {anatomyZone:"head.neck",       kind:"circumference"}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/lib/garment-template-resolver.ts` | Create | Pure reference→templateCode resolver (PR-A) |
| `apps/web/lib/mentonera-template.ts` | Create | `buildMentoneraTemplate()` + 3 field defs (PR-A) |
| `apps/web/lib/measurement-templates.ts` | Modify | Widen sync input type; add `syncMentoneraTemplate` (PR-A) |
| `apps/web/lib/compression-measurements.ts` | Modify | Extend `AnatomyZoneId` with `head.*` (PR-A) |
| `apps/web/app/api/patients/[id]/measurements/route.ts` | Modify | Resolve code from garment; `deps.resolveTemplateCode` (PR-A) |
| (seed call site) | Modify | Call `syncMentoneraTemplate` alongside compression (PR-A) |
| `body-highlight-zones.ts` + `body-highlight.tsx` | Modify | Traced head zones + head-view render branch (PR-B) |
| `measurement-shell.tsx` | Modify | Guarded Mentonera head layout (PR-B) |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | resolver: `ME→mentonera-v1`, all others→`compression-v1` | table test |
| Unit | `buildCompressionTemplate()` output unchanged (keys/metadata/count) | snapshot/regression guard |
| Unit | `getFilledZoneIdsFromValues(mentonera)` → `{head.crownChin,…}` | proves shared mechanism |
| Integration | POST non-ME still creates `compression-v1` draft | existing route tests stay green |
| Component | head zones render `data-filled` via same `ZoneMarker` (PR-B) | RTL |

## Migration / Rollout

No migration. `MeasurementTemplate/Section/Field` + JSON `metadata` already exist;
`mentonera-v1` = new upserted rows. Frozen `templateSnapshot` guarantees historical
`compression-v1` sessions are untouched. `AnatomyZoneId` is a TS-only type. If any
schema change surfaces, STOP — flag for approval.

## Slice Boundary

- **PR-A** (~230 lines): template + resolver + seed + type generalization + tests.
- **PR-B**: head zone tracing + `body-highlight` head branch + shell layout.
- Chained PRs recommended; each < 400 lines. PR-B follows PR-A on its branch.

## Open Questions

- [ ] Confirm the seed/bootstrap call site for `syncCompressionTemplate` (add Mentonera there).
- [ ] PR-B head-zone traced paths risk crossing 400 lines — re-forecast in sdd-tasks.
