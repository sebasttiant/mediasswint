# Garment Measurement Configuration Specification

## Purpose

Define per-garment resolution of measurement template + dedicated figure +
anatomy zones for new measurement capture, replacing the single generic
figure/catalog used for every garment today, with a safe generic fallback and
full backward compatibility for existing sessions.

## Non-Goals

- Leg (MR) 13-vs-15 measurement count — BLOCKED
  (`leg-measurement-configuration/client-clarification.md`).
- Variable-count interval bands (glove 5cm, chaqueta 4cm, stump 3.8cm).
- Product sub-variants (e.g., máscara media/completa).
- Embedding branded client PDFs as figures.

## Requirements

### Requirement: Garment-to-Template Resolution

The system MUST resolve the measurement `templateCode` for a new draft
session from the selected garment's catalog `figureKey` instead of a
hardcoded constant. Garments without a dedicated template mapping MUST
resolve to `compression-v1`.

#### Scenario: Mentonera garment resolves to its dedicated template

- GIVEN a clinician starts a new measurement session and selects garment `ME` (Mentonera)
- WHEN the draft session is created
- THEN the resolved `templateCode` MUST be `mentonera-v1`

#### Scenario: Garment without dedicated template falls back to compression-v1

- GIVEN a clinician selects a garment that has no dedicated template mapping
- WHEN the draft session is created
- THEN the resolved `templateCode` MUST be `compression-v1`

#### Scenario: Unknown or empty garment falls back to compression-v1

- GIVEN a draft session is created with a legacy, unknown, or empty garment reference
- WHEN `templateCode` resolution runs
- THEN the resolved `templateCode` MUST be `compression-v1`
- AND creation MUST NOT fail or throw

### Requirement: Mentonera Template Shape

The `mentonera-v1` template MUST define exactly 3 fields, each measured in
centimeters, each carrying a `kind` of `circumference` or `length` in field
metadata, with stable field keys and a fixed display order:

1. crown-to-chin circumference (`circumference`)
2. forehead-to-chin face length (`length`)
3. neck circumference (`circumference`)

#### Scenario: Mentonera session exposes exactly 3 typed fields

- GIVEN a draft session resolves to `templateCode` `mentonera-v1`
- WHEN its `templateSnapshot` is read
- THEN it MUST contain exactly 3 fields matching the fixed keys, cm unit, and `kind` values above, in order

### Requirement: Graceful Fallback on Missing Template or Figure

IF a garment references a `figureKey` with no matching figure/zone
configuration, the system MUST fall back to the existing generic full-body
figure and `compression-v1` template rather than error or render blank.

#### Scenario: Missing figure mapping does not crash the workspace

- GIVEN a garment has a `figureKey` with no matching figure/zone configuration
- WHEN the measurement workspace renders
- THEN it MUST render the existing generic full-body figure
- AND it MUST NOT crash or show a blank figure

### Requirement: Non-Regression of Compression Catalog and Highlight Sync

Existing `compression-v1` sessions, templates, and the full ~94-point catalog
MUST remain unchanged. Anatomical highlight synchronization — focusing or
entering a value activates the correct zone, and a filled field renders its
zone as measured — MUST continue working for compression zones (legs/arms)
AND MUST work equivalently for Mentonera zones.

#### Scenario: Compression catalog and template are unaffected

- GIVEN the existing `compression-v1` template and its ~94 fields
- WHEN the system is queried after this change ships
- THEN the field count, keys, and values MUST be identical to before the change

#### Scenario: Highlight sync holds for compression zones

- GIVEN a clinician is on a compression-v1 capture session
- WHEN they focus or enter a value in a leg/arm field
- THEN the corresponding anatomical zone MUST activate, and filled zones MUST render as measured

#### Scenario: Highlight sync holds for Mentonera zones

- GIVEN a clinician is on a mentonera-v1 capture session
- WHEN they focus or enter a value in one of the 3 fields
- THEN the corresponding face-figure zone MUST activate, and filled zones MUST render as measured

### Requirement: Additive Persistence, No Migration

Adding `mentonera-v1` MUST be purely additive (new template/field rows). No
existing session's persisted meaning MUST change, and no schema migration is
required. Historical sessions MUST always render from their own frozen
`templateSnapshot`.

#### Scenario: Historical sessions render unchanged

- GIVEN a measurement session created before this change existed
- WHEN its detail view renders
- THEN it MUST render from its frozen `templateSnapshot` exactly as before, unaffected by the new `mentonera-v1` template

#### Scenario: New template registration adds rows only

- GIVEN `mentonera-v1` is seeded via `syncMeasurementTemplate`
- WHEN the seed runs
- THEN it MUST insert new template/field rows only
- AND it MUST NOT alter or delete any existing template or field row
