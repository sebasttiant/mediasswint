# Design: Measurement Module Garment Figure Selection

## Technical Approach

Replace the new-measurement free-text garment field with a curated static TypeScript catalog while preserving the existing `compression-v1` template, sex-aware `BodyHighlight`, and measurement value pipeline. The selector stores the stable catalog `reference` in `MeasurementSession.garmentType` and stores display/figure metadata as `metadata.garmentSnapshot` alongside the existing `metadata.patientSex`. This satisfies curated selection, persistence/reload, legacy compatibility, conservative figure guidance, and stage-boundary requirements without Prisma changes.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Static TS catalog in `apps/web/lib/garment-catalog.ts` | Prisma catalog table, commercial operation product normalization | The spreadsheet has 43 rows and only reference + description. Static data is reviewable, testable, and avoids migration risk while business taxonomy is still inferred. |
| Store reference in `garmentType`; snapshot display metadata in `metadata.garmentSnapshot` | New columns or relation tables | Existing services already pass `garmentType` and `metadata` through create/update/detail/duplicate. This preserves audit/reload behavior and keeps rollback trivial. |
| Conservative `figureKey` hints only | Diagram rewrite or new SVG assets | Current diagram correctness depends on sex snapshots. Hints may guide safe labels/fallbacks, but `BodyHighlight` remains sex-driven until a later figure contract exists. |
| Legacy fallback for unknown `garmentType` | Reject unknown values or force migration | Existing measurements can contain free text. Unknown values must render as legacy display labels and remain editable/reloadable. |

## Data Flow

```text
Garment selector -> NewMeasurementClient state
  -> POST/PATCH measurement API
  -> measurements-input validates garmentSnapshot metadata
  -> measurements service persists garmentType + metadata
  -> edit/detail reload resolve snapshot or legacy fallback
  -> MeasurementShell/Detail keep existing sex-aware diagram fallback
```

Create and update requests should send:

- `garmentType`: selected catalog reference, or legacy text when editing old drafts.
- `metadata`: merge of existing context, at minimum `{ patientSex, garmentSnapshot? }`.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/web/lib/garment-catalog.ts` | Create | 43-item catalog, const types, lookup helpers, legacy display resolver, figure mapping. |
| `apps/web/lib/measurements-input.ts` | Modify | Parse optional `metadata.garmentSnapshot` safely for create/update; keep short `garmentType` validation. |
| `apps/web/app/api/patients/[id]/measurements/route.ts` | Modify | Merge `patientSex` and parsed `garmentSnapshot` into metadata on create. |
| `apps/web/app/api/patients/[id]/measurements/[sessionId]/route.ts` | Modify | Forward parsed metadata on PATCH. |
| `apps/web/app/patients/[id]/measurements/new/new-measurement-client.tsx` | Modify | Replace input with selector; initialize from snapshot/reference/legacy text; submit snapshot. |
| `apps/web/app/patients/[id]/measurements/new/_components/measurement-shell.tsx` | Modify | Accept optional figure hint only for UI guidance; keep existing `BodyHighlight`. |
| `apps/web/app/patients/[id]/measurements/[sessionId]/edit/page.tsx` | Modify | Pass metadata/snapshot to the client for reload. |
| `apps/web/app/patients/[id]/measurements/[sessionId]/measurement-detail-body.tsx` | Modify | Render snapshot label/reference when available, else legacy `garmentType`. |
| `apps/web/tests/garment-catalog.test.ts` | Create | Catalog uniqueness, lookup, fallback, figure mapping. |
| `apps/web/tests/measurement-*.test.ts`, `body-figure-sex.test.ts` | Modify | Persistence/reload and diagram regression coverage. |

## Interfaces / Contracts

```ts
const GARMENT_FIGURE_KEY = {
  FULL_BODY: "full-body",
  LOWER_LIMB: "lower-limb",
  UPPER_LIMB: "upper-limb",
  HEAD_OR_HAND: "head-or-hand",
  GENERIC: "generic",
} as const;

type GarmentFigureKey = (typeof GARMENT_FIGURE_KEY)[keyof typeof GARMENT_FIGURE_KEY];

interface GarmentOption {
  reference: string;
  label: string;
  family: string;
  figureKey: GarmentFigureKey;
}

interface GarmentSnapshot {
  reference: string;
  label: string;
  family: string;
  figureKey: GarmentFigureKey;
}

function findGarmentOption(reference: string): GarmentOption | null;
function getGarmentSnapshot(reference: string): GarmentSnapshot | null;
function resolveGarmentDisplay(garmentType: string | null, metadata: Record<string, unknown> | null): string;
function resolveFigureHint(snapshot: GarmentSnapshot | null): GarmentFigureKey;
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Catalog references, snapshot guards, legacy fallback | Node `node:test` in new `garment-catalog.test.ts`. |
| Unit | Create/update metadata parsing and preservation | Extend measurement route/input tests or add focused parser tests. |
| Regression | Sex-aware figure behavior remains unchanged | Extend `body-figure-sex.test.ts`; assert garment hints do not override patient-sex fallback. |
| Integration-adjacent | Draft reload/detail display | Repository/service tests proving `garmentType`, `metadata`, duplicate/edit reload survive. |
| E2E | Not available | No Playwright/Cypress configured. |

## Migration / Rollout

No migration required. Roll out as chained slices: catalog/tests, API metadata contract, selector UI, detail/reload polish. Rollback restores the text input and ignores `metadata.garmentSnapshot`; existing records remain valid.

## Open Questions

None.
