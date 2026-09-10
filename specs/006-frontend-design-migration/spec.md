# Feature Specification: Frontend Design Migration (FE-03)

**Feature Branch**: `006-frontend-design-migration`

**Created**: 2026-09-10

**Status**: Implemented

**Input**: Adapt the approved Margin Dashboard design bundle
(`~/Downloads/design-system/project/`) across the existing Next.js frontend, preserving the
architecture, authentication and API conventions established by FE-01 (003) and FE-02 (005).

## Context

The design bundle is a browser-Babel React 18 prototype. It carries a `window.MD` calculation
engine, `useState` fake authentication, a route-state switch, simulated uploads and artificial
delays. **None of that is production behaviour.** Only its visual and interaction language —
typography, colour, spacing, hierarchy, card and banner shapes, state copy — is adopted.

`apps/api` on `main` serves `GET /health` and `/auth/*` only. The assessment endpoints
(`/dashboard`, `/periods`, `/projects`, `/departments`, `/productivity`, `/categories`,
`/settings`, `/imports`) live on the unlanded branch `004-assessment-backend`. Constitution VI
forbids this spec from depending on that contract, so **every figure-bearing screen stays
unintegrated and says so**, and integration is deferred to a later frontend spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The signed-in shell looks and behaves like the approved design (Priority: P1)

A signed-in user sees the agency's product, not a scaffold: a branded sidebar on desktop that
collapses to a scrollable section bar on mobile, a sticky page header carrying the screen title
and the period the figures describe, and their identity with a sign-out control that is reachable
at every width.

**Why this priority**: every other screen renders inside it, and it is the only part of the design
that has no backend dependency at all.

**Independent Test**: sign in and move between the four sections at 1440px and at 390px.

**Acceptance Scenarios**:

1. **Given** a signed-in user at 1440px, **When** the app loads, **Then** a sidebar shows the
   brand, the section list with the current section marked, and the user's email with a sign-out
   button.
2. **Given** a signed-in user at 390px, **When** the app loads, **Then** the sections render as a
   horizontally scrollable bar and the sign-out control remains visible without scrolling
   horizontally. *(The prototype hides sign-out below 880px; that is a defect and is not copied.)*
3. **Given** any width, **When** the user tabs from the top of the page, **Then** a "Skip to
   content" link is the first focusable element and moves focus to the main region.
4. **Given** the keyboard only, **When** the user tabs through the sidebar, **Then** every control
   shows a visible focus ring.

---

### User Story 2 - The Dashboard shows the approved profit/loss banner and five metrics (Priority: P1)

The Dashboard leads with the large purple banner answering "did we make money?", followed by the
five metrics — total hours, billable hours, cost, revenue, margin — and the period filter.

**Why this priority**: it is the screen the design was approved on.

**Independent Test**: load `/` and compare against the prototype's Dashboard at matching widths.

**Acceptance Scenarios**:

1. **Given** the Dashboard, **When** it renders figures, **Then** a persistent, prominent notice
   states that the figures are sample data and that no spreadsheet has been ingested.
2. **Given** a profit, **When** the banner renders, **Then** it is purple; **Given** a loss, it is
   red; **Given** an unknown result, it is ink-dark and says the answer is unknown.
3. **Given** the period filter, **When** the user selects a period the sample does not cover,
   **Then** an empty state explains which period is covered and offers a control to return to it.
4. **Given** a metric whose value is absent, **When** it renders, **Then** it shows an em dash with
   an accessible "missing" label, never a zero.
5. **Given** the Dashboard, **When** it renders, **Then** it contains no table and no chart.

---

### User Story 3 - Every other screen states honestly that it has no data yet (Priority: P2)

Projects, Productivity and Categories carry the design's language and each explains, in the
design's empty-state form, that the screen is waiting on ingested spreadsheets.

**Why this priority**: an honest empty screen in the right visual language is deliverable now; a
populated one is not.

**Independent Test**: visit each section and confirm the empty state and that no request is made
to an endpoint that does not exist.

**Acceptance Scenarios**:

1. **Given** any of the three screens, **When** it loads, **Then** it shows the design's empty
   state naming what will appear once data is ingested.
2. **Given** any of the three screens, **When** it loads, **Then** the browser makes no request to
   an assessment endpoint.

---

### User Story 4 - Sign-in matches the design without changing how authentication works (Priority: P2)

The sign-in screen adopts the design's split layout and form styling. Its behaviour — the login
mutation, the inline error, the expiry notice, the return destination — is unchanged.

**Why this priority**: it is the first screen anyone sees, and its behaviour is already correct and
must not regress.

**Independent Test**: sign in, sign out, and force an expiry.

**Acceptance Scenarios**:

1. **Given** wrong credentials, **When** the form is submitted, **Then** an inline error appears
   and no navigation occurs.
2. **Given** a deliberate sign-out, **When** it succeeds, **Then** the user reaches a plain
   `/login` with no expiry notice.
3. **Given** an expired session inside the app, **When** the next request answers 401, **Then** the
   user reaches `/login?reason=expired` with the notice shown once.
4. **Given** the prototype's demo-credentials hint, **When** the screen renders, **Then** it is
   absent — no hardcoded identity appears anywhere.

---

## Requirements *(mandatory)*

### Functional

- **FR-001** The design's colour, type, spacing, radius and shadow values MUST be expressed as
  tokens in the existing `globals.css` theme, not as per-component literals.
- **FR-002** The application MUST render in the design's typefaces (DM Sans, DM Mono) loaded
  through the framework's font mechanism.
- **FR-003** Numeric figures MUST render in the mono face with tabular figures.
- **FR-004** A value absent from the source MUST render as an em dash carrying an accessible
  "missing value" label. A genuine zero MUST render as a formatted zero.
- **FR-005** Percentage-shaped values MUST distinguish a *share* (unsigned, e.g. productivity)
  from a *signed result* (e.g. margin).
- **FR-006** The selected period MUST live in the URL query string.
- **FR-007** Sample data MUST be confined to one clearly named module, MUST be labelled as sample
  wherever it is shown, and MUST NOT be reachable through `apiFetch`.
- **FR-008** No screen may present a figure as an API integration while the backend contract it
  needs is unlanded.

### Non-functional / constraints

- **NFR-001** No new runtime dependency.
- **NFR-002** No second QueryClient, API transport, authentication mechanism, or design system.
- **NFR-003** No prototype runtime behaviour: no `window.MD`, no browser calculation, no fake auth,
  no simulated upload, no artificial delay, no route-state switch, no CDN React/Babel.
- **NFR-004** No HTML injection: no `dangerouslySetInnerHTML`, no iframe, no copied HTML document.
- **NFR-005** `lib/api.ts`, `lib/session.ts`, `lib/auth.ts`, `app/providers.tsx`, `AuthGate` and
  the login mutation's behaviour MUST be preserved. Restyling `LoginForm`/`UserMenu` markup is
  allowed; changing their session behaviour is not.
- **NFR-006** Nothing private may be server-rendered behind only the client `AuthGate`.
- **NFR-007** Motion MUST honour `prefers-reduced-motion`.

## Out of Scope

- Integrating `/dashboard`, `/periods`, `/projects`, `/departments`, `/productivity`,
  `/categories`, `/settings` or `/imports` — deferred to a later frontend spec, blocked on
  `004-assessment-backend` landing on `main`.
- The prototype's Departments, Uploads, Assumptions and Project-detail screens. Each exists only
  to display backend data that has no landed contract; adding the routes now would create
  navigation that leads nowhere.
- Charts, dashboard tables, and any new dashboard feature.
- Automated tests and test tooling.
