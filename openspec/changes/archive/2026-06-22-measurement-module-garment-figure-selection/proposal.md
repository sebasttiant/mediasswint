# Proposal: Measurement Module Garment Figure Selection

## Intent

Replace the new-measurement free-text garment field with a curated selector sourced from the custom-product spreadsheet, so operators can choose by reference/label and get safe garment-aware figure guidance without destabilizing existing measurement capture.

## Scope

### In Scope
- Add a static 43-item garment catalog with reference, label, inferred family, and conservative `figureKey` hints.
- Replace `Tipo de prenda` on `/patients/[id]/measurements/new` with a selector/combobox grouped by inferred family.
- Persist the stable reference in existing `MeasurementSession.garmentType` and optional `{reference,label,figureKey,family}` in `metadata.garmentSnapshot`.
- Keep legacy free-text `garmentType` measurements rendering and reloadable.
- Add focused unit tests for catalog mapping, snapshot persistence/reload, and legacy fallback.

### Out of Scope
- Database catalog tables, Prisma migration, or schema changes.
- Commercial-operation linking or full product normalization.
- Rewriting the body diagram, adding new partial SVG figures, or replacing current sex-aware figure behavior.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `web-admin-measurement-ui`: new measurement capture must use curated garment selection while preserving focused capture and legacy measurement rendering.

## Approach

Use a static curated catalog in `apps/web/lib/garment-catalog.ts` based on the spreadsheet (`reference/iniciales` + description only). Infer family/product type only where safe; otherwise use conservative labels. The UI stores the reference in `garmentType`, snapshots display/figure metadata, and maps `figureKey` to current figures/fallbacks without diagram rewrites.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/lib/garment-catalog.ts` | New | Static catalog and safe family/figure mapping. |
| `apps/web/app/patients/[id]/measurements/new/new-measurement-client.tsx` | Modified | Replace free-text input with selector. |
| `apps/web/lib/measurements*.ts` | Modified | Accept/persist snapshot through existing fields. |
| `apps/web/app/patients/[id]/measurements/new/_components/measurement-shell.tsx` | Modified | Use snapshot/figure hint conservatively. |
| `apps/web/tests/measurement-*.test.ts` | Modified | Cover selector persistence and fallback. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ambiguous product family from Excel | Med | Curate static mapping; mark unsafe inference as generic. |
| Missing garment-specific figures/assets | Med | Fall back to current sex-aware figures; no new SVGs. |
| Legacy `garmentType` breaks | Med | Treat unknown values as legacy labels. |
| Body diagram regression | Med | Avoid rewrite; add focused regression tests. |
| Over 400-line PR | Med | Deliver as chained small slices. |

## Rollback Plan

Revert selector/catalog/snapshot usage and restore the free-text field. Existing sessions remain valid because first-stage persistence uses current `garmentType`/`metadata` fields and no migration.

## Dependencies

- Spreadsheet: `/home/sebastian/Documentos/DEV/MEDIASSWINTERNO/MEJORAS/Listado de productos sobre medida.xlsx`.
- Existing sex-aware body figure behavior and measurement snapshot contract.

## Success Criteria

- [ ] User can pick a garment by reference or label.
- [ ] Selected garment persists, reloads, and displays safely.
- [ ] Legacy measurements with old free text still render.
- [ ] Diagram behavior is not regressed.
- [ ] First slice stays suitable for chained PRs under 400 changed lines.
