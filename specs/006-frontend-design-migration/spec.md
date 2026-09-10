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

**Backend availability changed mid-implementation.** When this spec was written, `apps/api` on
`main` served `GET /health` and `/auth/*` only, and the Dashboard was built against an isolated,
clearly-labelled sample module with integration deferred (Constitution VI). During implementation
`004-assessment-backend` was merged to `main` (PR #4, `5e4fd9a`), landing `/periods`, `/dashboard`,
`/projects`, `/departments`, `/productivity`, `/categories`, `/settings` and `/imports`.

The branch was rebased onto that `main` and **every screen was integrated against the real
endpoints**: `lib/analytics.ts` replaced the sample module, which was deleted, and the reporting,
upload and assumptions screens were built out. No preview data and no permanently-empty screen
remains.

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

1. **Given** ingested spreadsheets, **When** the Dashboard renders, **Then** every figure comes
   from `GET /dashboard` for the selected period; nothing is calculated in the browser.
2. **Given** a profit, **When** the banner renders, **Then** it is purple; **Given** a loss, it is
   red; **Given** an unknown result, it is ink-dark and says the answer is unknown.
3. **Given** the period filter, **When** a period outside the loaded data is reached by URL,
   **Then** an empty state says so and **no** `/dashboard` request is made for it.
4. **Given** a metric whose value is absent, **When** it renders, **Then** it shows an em dash with
   an accessible "missing" label, never a zero.
5. **Given** the Dashboard, **When** it renders, **Then** it contains no table and no chart.

---

### User Story 3 - Every reporting screen shows the loaded data (Priority: P2)

Projects (with a per-project page), Departments, Productivity and Categories each read their own
endpoint for the selected period, in the design's language.

**Why this priority**: the Dashboard answers "did we make money"; these answer "where did it come
from", which is the rest of the assessment.

**Independent Test**: load the workbooks, then visit each section.

**Acceptance Scenarios**:

1. **Given** ingested data, **When** a reporting screen loads, **Then** its figures come from its
   own endpoint for the period in the URL.
2. **Given** a period with no rows, **When** the screen loads, **Then** it shows an empty state
   naming the period rather than a table of zeroes.
3. **Given** a project row, **When** it is opened, **Then** its own page shows the price, the
   month-by-month split, the departments and the per-employee contribution.
4. **Given** a value the API reports as `null`, **When** it renders, **Then** it is an em dash with
   an accessible label — never a zero.

---

### User Story 5 - A new user can load data without leaving the app (Priority: P1)

Somebody signing in to an empty instance is told what is missing, sent to an uploads screen, and
can either drop the three spreadsheets in or load the supplied sample workbooks with one button.

**Why this priority**: without it the first-run empty state names a fix the product does not offer,
and the whole application is unreachable without a terminal.

**Independent Test**: empty the database, sign in, and reach a populated dashboard using only the
UI.

**Acceptance Scenarios**:

1. **Given** an empty instance, **When** the Dashboard loads, **Then** the empty state links to the
   uploads screen.
2. **Given** the uploads screen, **When** "Load the sample workbooks" is pressed, **Then** the
   three workbooks are imported and every reporting screen fills in without a reload.
3. **Given** a chosen or dropped file, **When** it is selected, **Then** nothing is sent: the
   screen shows the file's name and size and waits for an explicit "Upload and replace".
4. **Given** a confirmed valid workbook, **When** it uploads, **Then** the screen reports the rows
   accepted and the periods the API says it replaced.
5. **Given** an unreadable file, **When** it uploads, **Then** the screen shows the API's own
   message and states that nothing was changed.
6. **Given** the service is unreachable, **When** an upload is attempted, **Then** the screen says
   the result could not be confirmed — never that nothing changed — and offers to refresh the
   history.

---

### User Story 6 - The assumptions behind every figure can be changed (Priority: P2)

Which categories count as billable, and the monthly overhead, are editable, and saving them
recalculates every screen.

**Why this priority**: the assessment asks for both to be configurable without editing code.

**Independent Test**: change the overhead, save, and read the Dashboard's cost.

**Acceptance Scenarios**:

1. **Given** a changed overhead, **When** it is saved, **Then** the API recalculates and the
   reporting screens show the new figures with no reload.
2. **Given** no category ticked, or a negative overhead, **When** the form is reviewed, **Then**
   saving is blocked with the reason shown inline.
3. **Given** an overhead the API accepts, such as `1234.50`, **When** it is entered, **Then** the
   field accepts it — the form does not narrow what the backend allows.

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
- **FR-007** Any preview data MUST be confined to one clearly named module, MUST be labelled as
  sample wherever it is shown, and MUST NOT be reachable through `apiFetch`. *(Satisfied while it
  existed; the module was deleted once the endpoints landed, so no preview data remains.)*
- **FR-008** No screen may present a figure as an API integration while the backend contract it
  needs is unlanded. The Projects, Productivity and Categories screens therefore stay on their
  empty states and issue no request.
- **FR-009** Every query MUST follow `apps/web/README.md` section 10: keys outside the `"auth"`
  namespace, `signal` forwarded, and `enabled` set from the resolved authenticated state. Every
  mutation MUST stamp the session in `onMutate` and check it before writing to the cache.
- **FR-010** Changing the year in the period filter MUST NOT leave a month selected that the new
  year does not hold. Where the month cannot be kept, the selection falls back to the whole year.
- **FR-011** A destructive import MUST be confirmed after the file is chosen, not started by the
  act of choosing it.
- **FR-012** A failure message MUST NOT claim more than this side can know. An HTTP rejection is
  the API's own answer and may be reported as "nothing was changed"; a network failure leaves the
  outcome unknown and MUST be reported as unconfirmed.
- **FR-013** A form MUST NOT reject a value the API accepts.
- **FR-014** A data-quality warning MUST be shown in the scope it describes. The period's own
  `completeness.issues` belong on the period's screen; the standing warnings `GET /periods`
  reports for the dataset belong with the files that produced them.

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

- Charts. The design has none and the brief asks for none.
- Editing or deleting an import after the fact; the API offers no endpoint for it.
- A department's own page. The drill-down is nested inside the departments response, so opening a
  department costs no request and needs no route.
- A month-by-month table on the project page, and a second rendering of the department split as
  bars. Neither is in the reference design or asked for by the brief; the project page carries the
  project's own figures, its departments and its people.
- A preview of which periods an import will replace. The API only knows once it has read the file,
  so the screen states the rule and reports the actual periods afterwards.
- The prototype's Departments, Uploads, Assumptions and Project-detail screens. Each exists only
  to display backend data that has no landed contract; adding the routes now would create
  navigation that leads nowhere.
- Charts, dashboard tables, and any new dashboard feature.
- Automated tests and test tooling.
