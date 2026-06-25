# Web Admin Measurement UI Specification

## Purpose

Define user-visible web admin, patient, and measurement workspace behavior for commercially usable clinical navigation while preserving safe focused measurement capture.

## Requirements

### Requirement: Consistent Shell Workspaces

Patient list, patient detail, measurement detail, and admin landing views MUST provide consistent workspace navigation, breadcrumbs or context labels, and route affordances.

#### Scenario: Shell routes provide common navigation

- GIVEN an authenticated user can access admin/patient routes
- WHEN the user opens `/patients`, `/patients/[id]`, `/patients/[id]/measurements/[sessionId]`, or `/admin`
- THEN the view MUST expose consistent workspace navigation and current-context labeling
- AND the user MUST be able to move back to relevant patient/admin work areas without browser-only navigation

#### Scenario: Existing patient workflows remain available

- GIVEN a user is on the patient workspace
- WHEN they search for patients or start patient creation
- THEN those actions MUST remain available and recognizable

### Requirement: Patient Detail Separation

Patient detail MUST separate clinical, commercial/operational, and measurement concerns into clear sections so each workflow can be understood independently.

#### Scenario: Detail view groups mixed concerns

- GIVEN a user opens a patient detail view
- WHEN patient demographics, measurements, clinical timeline, and commercial actions are shown
- THEN the content MUST be grouped by concern with clear section labels
- AND measurement-related actions MUST remain associated with the patient context

#### Scenario: Empty or sparse patient state remains useful

- GIVEN a patient has no measurements or limited operational history
- WHEN the detail view loads
- THEN the relevant section MUST show an understandable empty state without hiding other patient context

### Requirement: Useful Admin Landing

The admin route MUST provide a useful landing experience with navigation to available administrative or operational areas instead of placeholder-only content.

#### Scenario: Admin landing gives actionable destinations

- GIVEN an ADMIN user opens `/admin`
- WHEN the page renders
- THEN it MUST show actionable destinations for supported admin or operations workflows
- AND it MUST NOT rely on placeholder text as the primary experience

#### Scenario: Non-admin access remains protected

- GIVEN a user without admin privileges attempts to access admin content
- WHEN authorization is evaluated
- THEN existing access protection MUST remain enforced

### Requirement: Measurement Detail and Capture Boundaries

Read-only measurement detail SHOULD follow workspace navigation, while new measurement capture MUST remain a focused full-screen clinical flow.

#### Scenario: Measurement detail is navigable

- GIVEN a user opens an existing measurement session detail
- WHEN the detail view renders
- THEN it SHOULD provide patient/session context and workspace navigation

#### Scenario: Measurement capture remains focused

- GIVEN a clinician starts a new measurement session
- WHEN the capture flow opens
- THEN the flow MUST remain focused on measurement capture without unrelated admin workspace distractions
- AND clinical progress, body-region context, and completion affordances MUST remain clear

### Requirement: Regression Coverage Before Implementation

Behavioral UI changes MUST be covered by tests before implementation changes are completed.

#### Scenario: Navigation and workflow regressions are tested

- GIVEN implementation work changes shell, patient, admin, or measurement UI behavior
- WHEN tests are written
- THEN they MUST cover changed navigation/workflow expectations before the implementation is considered complete

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
