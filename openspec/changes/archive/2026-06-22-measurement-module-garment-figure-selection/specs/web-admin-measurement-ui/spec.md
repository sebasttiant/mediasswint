# Delta for Web Admin Measurement UI

## ADDED Requirements

### Requirement: Curated Garment Selection

New measurement capture MUST require garment type selection from a curated list of over-measure/custom-product references instead of uncontrolled free text.

#### Scenario: Operator selects known garment reference

- GIVEN a clinician starts a new measurement session
- WHEN the garment field is shown
- THEN the user MUST be able to select a curated garment option
- AND each option MUST show enough available reference, label, and family context to identify it

#### Scenario: Free-text garment entry is not the primary path

- GIVEN the curated garment list is available
- WHEN the clinician captures garment context
- THEN the flow MUST NOT rely on arbitrary free-text garment type entry for new sessions

### Requirement: Garment Session Persistence and Reload

Selected garment context MUST persist and reload within the current measurement session using existing session fields, without requiring schema migration.

#### Scenario: Selected garment survives draft reload

- GIVEN a clinician selected a curated garment for a draft measurement
- WHEN the draft or detail context reloads
- THEN the selected reference MUST remain available
- AND display metadata or snapshot values SHOULD render safely when present

#### Scenario: Missing snapshot remains safe

- GIVEN a measurement session has a selected garment reference but incomplete display metadata
- WHEN the draft or detail context renders
- THEN the UI MUST still show a safe garment identifier
- AND capture/detail rendering MUST continue without data-model migration

### Requirement: Legacy Garment Compatibility

Existing measurement sessions with legacy free-text `garmentType` values MUST continue to render and remain usable.

#### Scenario: Legacy free-text garment renders

- GIVEN an existing measurement has a non-catalog `garmentType`
- WHEN its detail or capture context renders
- THEN the value MUST be treated as a legacy display label
- AND unknown garment values MUST NOT break measurement rendering or navigation

### Requirement: Conservative Figure Guidance

Garment selection MAY guide figure or zone display only when the guidance is conservative and compatible with the existing sex-aware diagram behavior.

#### Scenario: Existing diagram remains fallback

- GIVEN a selected garment has no safe figure guidance
- WHEN the measurement diagram is displayed
- THEN the existing sex-aware diagram behavior MUST remain the default fallback
- AND the stage MUST NOT require new SVG figures or a diagram rewrite

### Requirement: Stage Boundary Protection

This stage MUST NOT introduce a normalized garment database catalog, commercial operation linking, schema migration, or body-diagram rewrite.

#### Scenario: First-stage scope remains bounded

- GIVEN implementation starts for garment selection
- WHEN persistence, display, and figure behavior are designed
- THEN the solution MUST stay within existing measurement session persistence boundaries
- AND catalog normalization or commercial-operation linking MUST remain out of scope
