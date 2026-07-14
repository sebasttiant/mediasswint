# Tasks: Leg Measurement Configuration

## Stage 1 — count-independent (safe to land now)

These are correct whether the leg model turns out to be 13 or 15. They exist to
shrink and de-risk Stage 2.

- [x] **TASK-01** — Document the 13 confirmed positions, their order, and the
      two undefined ones (`exploration.md`).
- [x] **TASK-02** — Produce a numbered diagram on the client's own form so the
      clarification can be answered by reference. Kept **outside the repository**
      with the rest of the private client material, at
      `MEDIASSWINTERNO/MEJORAS/mr-leg-numbered.png`; referenced by path only.
- [x] **TASK-03** — Write the client clarification question
      (`client-clarification.md`).
- [x] **TASK-04** — Remove the duplicated per-side point counts. `body-anatomy.ts`
      hardcoded `"28 puntos por lado"` / `"19 puntos por lado"` as prose, which
      would have silently gone stale the moment the catalog changed. Export
      `LEG_POINTS_PER_SIDE` / `ARM_POINTS_PER_SIDE` from the catalog and derive
      the prose from them, so the count lives in exactly one place.
- [x] **TASK-05** — Guard the silent SVG fallback. `getFullZonePathForSex` falls
      back to a generated marker rectangle when a leg zone has no hand-traced
      path, so changing `LEG_POINTS` would have rendered fake anatomy with no
      error. Add a regression test asserting every leg zone in the catalog has a
      traced path in **both** `zones-male` and `zones-female`.

## Stage 2 — BLOCKED on client confirmation

Do not start until `client-clarification.md` is answered.

- [ ] **TASK-06** — Define the canonical leg catalog: ordered, named positions
      with a `kind` discriminator (`circumference` | `distance`) and explicit
      `unit: "cm"`.
- [ ] **TASK-07** — Decide template versioning (`compression-v2`) vs in-place
      reinterpretation. Historical sessions must not silently change meaning.
- [ ] **TASK-08** — Server-boundary validation in `measurements-input.ts`:
      exact completeness, no extras, no duplicates, deterministic ordering,
      left/right symmetry.
- [ ] **TASK-09** — Re-trace leg SVG zone paths in `zones-male.ts` and
      `zones-female.ts` for the confirmed count; re-tune
      `body-highlight-calibration.ts`.
- [ ] **TASK-10** — Re-seed the measurement template; verify legacy sessions
      still render and export.

## Deferred — separate change

- [ ] **TASK-11** — 3.8 cm fixed band pitch for the **MP / amputee-stump**
      format. Not part of the MR leg model. See `exploration.md` Finding 3.
