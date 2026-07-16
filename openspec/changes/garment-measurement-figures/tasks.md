# Tasks: Per-Garment Measurement Figures (Mentonera pilot)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR-A ~230 / PR-B ~250-350 |
| 400-line budget risk | Low (PR-A) / Medium (PR-B) |
| Chained PRs recommended | Yes |
| Suggested split | PR-A (data/logic) → PR-B (figure/zones/UI) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Resolver + Mentonera template + generalized sync + seed wiring + route | PR-A | Base = feature/tracker branch; TDD throughout |
| 2 | Head zones + BodyHighlight head branch + shell Mentonera layout | PR-B | Base = PR-A branch; re-forecast lines once traced paths land |

## Phase 1: PR-A — Resolver & Template (Foundation)

- [x] 1.1 RED: `apps/web/tests/garment-template-resolver.test.ts` — table test: `ME`→`mentonera-v1`; unmapped/unknown/empty/null/undefined→`compression-v1` (spec: Garment-to-Template Resolution, all 3 scenarios)
- [x] 1.2 GREEN: Create `apps/web/lib/garment-template-resolver.ts` — `TEMPLATE_CODE_BY_REFERENCE` map + `resolveTemplateCode(reference)` pure function
- [x] 1.3 RED: `apps/web/tests/mentonera-template.test.ts` — assert `buildMentoneraTemplate()` returns exactly 3 fields, fixed keys/order, cm unit, `kind` values (`circumference`/`circumference`/`length`) (spec: Mentonera Template Shape)
- [x] 1.4 GREEN: Create `apps/web/lib/mentonera-template.ts` — `buildMentoneraTemplate()` with the 3 typed fields (`mentoneraCrownChin`, `mentoneraFaceLength`, `mentoneraNeck`), metadata `{anatomyZone, kind}`
- [x] 1.5 RED: extend `apps/web/tests/measurement-templates.test.ts` — `syncMeasurementTemplate` accepts a Mentonera-shaped input (structural `MeasurementTemplateInput`) without type errors; existing `syncCompressionTemplate` behavior/output unchanged (regression guard, spec: Non-Regression + Additive Persistence)
- [x] 1.6 GREEN: Widen `syncMeasurementTemplate` param in `apps/web/lib/measurement-templates.ts` to structural `MeasurementTemplateInput` (`metadata: Record<string, unknown>`); add `syncMentoneraTemplate()` calling `syncMeasurementTemplate(buildMentoneraTemplate(), repository)`
- [x] 1.7 RED: extend `apps/web/tests/compression-measurements.test.ts` (or new zone-type test) — `AnatomyZoneId` accepts `` `head.${string}` `` values; existing `legs.*`/`arms.*` values still type-check
- [x] 1.8 GREEN: Extend `AnatomyZoneId` union in `apps/web/lib/compression-measurements.ts` with `` `head.${string}` `` (additive, no behavior change)
- [x] 1.9 Locate and modify seed call sites: `apps/web/scripts/seed-compression-template.ts` (invoked via `pnpm templates:seed`, wired into the `template-seeder` Docker target) and `apps/web/scripts/seed-demo-data.ts` (line ~149) — call `syncMentoneraTemplate()` alongside `syncCompressionTemplate()` in both, additively
- [x] 1.10 RED: extend route integration test in `apps/web/tests/` for `POST /api/patients/[id]/measurements` — selecting garment `ME` creates a draft with `templateCode: "mentonera-v1"`; non-ME garments still create `compression-v1` (spec: Garment-to-Template Resolution scenarios)
- [x] 1.11 GREEN: Modify `apps/web/app/api/patients/[id]/measurements/route.ts` — resolve `templateCode` via `deps.resolveTemplateCode(parsed.value.garmentType)` (default = real resolver) instead of hardcoded `compression-v1`
- [x] 1.12 REFACTOR: run `node --test --import tsx "tests/**/*.test.ts"`, `pnpm typecheck`, `pnpm exec eslint` from `apps/web`; confirm compression field count/keys/values identical to pre-change baseline

## Phase 2: PR-B — Head Figure, Zones & Shell Wiring

- [ ] 2.1 RED: `apps/web/tests/body-highlight-zones.test.ts` (extend) — assert the 3 Mentonera zone ids (`head.crownChin`, `head.faceLength`, `head.neck`) exist and map onto `HeadDetailFemale`/`HeadDetailMale` silhouette regions
- [ ] 2.2 GREEN: Extend `apps/web/app/_components/body-highlight/body-highlight-zones.ts` — define the 3 Mentonera zones traced against the existing `HeadDetailFemale`/`HeadDetailMale` (`silhouettes/head-detail-female.tsx`, `head-detail-male.tsx`) and `HEAD_DETAIL_VIEWBOX` from `silhouette-shared.ts`
- [ ] 2.3 RED: `apps/web/tests/body-highlight.test.tsx` (extend) — non-regression guard: compression zones (legs/arms) still render `data-filled` via `ZoneMarker` on focus/fill; Mentonera head zones render `data-filled` equivalently (spec: Non-Regression of Compression Catalog and Highlight Sync, both scenarios)
- [ ] 2.4 GREEN: Modify `apps/web/app/_components/body-highlight/body-highlight.tsx` — add head-view render branch driven by the SAME generic `filledZoneIds`/`activeZoneId` → `ZoneMarker` mechanism (no changes to existing leg/arm rendering path)
- [ ] 2.5 RED: extend `apps/web/tests/measurement-shell.test.tsx` (or equivalent) — when `templateSnapshot.code === "mentonera-v1"`, shell renders the head figure + exactly 3 typed fields, and `getFilledZoneIdsFromValues` drives the highlight; assert fallback to the generic full-body figure + `compression-v1` template when `figureKey` has no matching config, without crash or blank render (spec: Graceful Fallback scenario)
- [ ] 2.6 GREEN: Modify `apps/web/app/patients/[id]/measurements/new/_components/measurement-shell.tsx` — add guarded Mentonera branch (head figure + 3-field strip) alongside the existing compression legs/arms layout; keep compression path untouched
- [ ] 2.7 REFACTOR: run `node --test --import tsx "tests/**/*.test.ts"`, `pnpm typecheck`, `pnpm exec eslint` from `apps/web`; re-forecast PR-B changed-line count once head-zone traced paths are final — if it exceeds 400 lines, split zone tracing into its own slice before requesting review

## Non-Goals (explicitly out of scope for this change)

- Leg (MR) 13-vs-15 measurement count — BLOCKED, see `leg-measurement-configuration/client-clarification.md`.
- Variable-count interval bands (glove 5cm, chaqueta 4cm, stump 3.8cm).
- Product sub-variants (e.g., máscara media/completa).
- Embedding branded client PDFs as figures.
