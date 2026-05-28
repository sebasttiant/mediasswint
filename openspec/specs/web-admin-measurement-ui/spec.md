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
