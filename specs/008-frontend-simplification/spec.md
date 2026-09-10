# Feature Specification: Frontend Simplification and Design Fidelity (FE-04)

**Feature Branch**: `008-frontend-simplification`

**Created**: 2026-09-10

**Status**: In progress

**Input**: Act on `review.md` in this directory — a consolidated review of
`apps/web` merging a correctness/simplification pass, a React/Next performance
pass, and a side-by-side comparison against the approved design.

## Context

`apps/web` works and looks right. This spec does not change what it does; it
fixes three behaviours that are wrong, closes three gaps against the approved
design, and removes duplication that would be hard to defend in review.

Every finding acted on here is recorded in `review.md` with its file, line and a
reproduction. That file is the source; this spec is the commitment.

**Not in scope**: the request-waterfall work (`review.md` §C1). Those three
options were labelled "needs your decision" and one of them reverses a
documented boundary in `apps/web/README.md` 8.2. They belong to their own spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The screen never contradicts itself (Priority: P1)

Whatever period the figures describe, every control and label on the screen says
the same period.

**Why this priority**: a filter that disagrees with the table is worse than no
filter — the reader cannot tell which to believe.

**Independent Test**: reach a period by URL that the loaded data does not hold.

**Acceptance Scenarios**:

1. **Given** data covering only part of a year, **When** `/?year=2025&month=7`
   is opened and July is not covered, **Then** the month control and the empty
   state name the same period.
2. **Given** any covered period, **When** the screen renders, **Then** the page
   title carries a chip naming that period, matching the controls.

---

### User Story 2 - A rejected import does not cost the user their file (Priority: P1)

Fixing what the API objected to does not mean starting over.

**Why this priority**: the API's rejection messages are row-level and
actionable; discarding the file discards the ability to act on them.

**Independent Test**: upload a file the API rejects.

**Acceptance Scenarios**:

1. **Given** a staged workbook, **When** the import is rejected, **Then** the
   file and any year entered are still staged, and the message is shown beside
   them.
2. **Given** a staged workbook, **When** the import succeeds, **Then** the
   staging panel clears.

---

### User Story 3 - A first-time user can fill the app from where they are (Priority: P1)

Someone signing in to an empty instance is told what is missing and can act on
it without navigating away.

**Why this priority**: it is the first thing anyone does with the product, and
today it costs a screen change to reach a button that already exists.

**Independent Test**: empty the database, sign in, and reach a populated screen
without visiting `/uploads`.

**Acceptance Scenarios**:

1. **Given** an empty instance, **When** any reporting screen loads, **Then** it
   offers to load the sample workbooks in place, and still links to Uploads.
2. **Given** that button, **When** it succeeds, **Then** the screen fills in
   with no reload.
3. **Given** that button, **When** it fails, **Then** the failure is shown
   beside the empty state.

---

### User Story 4 - An incomplete figure comes with somewhere to go (Priority: P2)

When the API reports a figure as partial, the notice that says so offers the
screen where the gap is fixed.

**Why this priority**: the app already surfaces the gap honestly; the missing
half is the remedy.

**Independent Test**: make a period partial and read the notice.

**Acceptance Scenarios**:

1. **Given** a period whose cost or revenue is partial, **When** the notice
   renders, **Then** it carries an action leading to Uploads.

---

### User Story 5 - The application paints before the network answers (Priority: P2)

The sidebar, navigation and header appear immediately; only the figures wait.

**Why this priority**: the shell is public and data-free, and it is the largest
paint on the screen.

**Independent Test**: throttle the network and load any screen.

**Acceptance Scenarios**:

1. **Given** a slow session check, **When** the app loads, **Then** the brand,
   navigation and header are painted while the session resolves.
2. **Given** a signed-out visitor, **When** the check resolves, **Then** the
   redirect to `/login` is unchanged.

---

### User Story 6 - Changing the period does not blank the screen (Priority: P2)

**Independent Test**: switch month on a populated screen.

**Acceptance Scenarios**:

1. **Given** a table on screen, **When** the period changes, **Then** the
   previous figures remain visible while the new ones load.

---

## Requirements *(mandatory)*

### Functional

- **FR-001** No control may display a period other than the one the figures
  describe.
- **FR-002** A staged import is cleared on success only.
- **FR-003** The first-run empty state offers the sample import in place.
- **FR-004** A partial-completeness notice carries an action to Uploads.
- **FR-005** The application chrome renders without waiting on `/auth/me`;
  `AuthGate` continues to gate the page body, and its redirect behaviour is
  unchanged.
- **FR-006** Reporting queries keep the previous period's data visible while the
  next loads.

### Non-functional / constraints

- **NFR-001** No new runtime dependency.
- **NFR-002** The approved visual design does not change, except where this spec
  moves toward it (the period chip) or adds an affordance the design already has
  (the notice action, the sample button).
- **NFR-003** No calculation may be performed in the browser that `apps/api`
  already reports.
- **NFR-004** `lib/analytics.ts` uses one shape for one job.
- **NFR-005** Nothing is declared in a response type that the frontend does not
  render.
- **NFR-006** `lib/api.ts`, `lib/session.ts`, `lib/auth.ts`, `app/providers.tsx`
  and the login/logout/expiry behaviour are preserved.

## Out of Scope

- The three request-waterfall options (`review.md` §C1), including server-side
  prefetch.
- `/projects/[refCode]` static rendering — shown in `review.md` §D1 to be
  impossible as described.
- Bundle configuration and table virtualization — `review.md` §D2, §D4.
- `VerdictBanner`'s prop surface (`review.md` §B10) — cosmetic, and it touches
  approved copy.
