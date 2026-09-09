# Feature Specification: FE-01 — Frontend Foundation

**Feature Branch**: `003-frontend-foundation`

**Created**: 2026-09-09

**Status**: Draft — awaiting review

**Scope**: `apps/web` only (per Constitution Principle V)

**Input**: User description: "FE-01 Frontend Foundation. Application layout and navigation; typography, colours, spacing and responsive behaviour; only the UI components the upcoming assessment screens need; visual loading, empty and error states; a small conventional Next.js folder structure. No backend changes, no shared code, no automated tests, no authentication integration."

## Overview

FE-01 is the first of the frontend specs for the Margin Dashboard:

1. **FE-01 — Foundation** (this spec)
2. **FE-02+** — the data-backed screens (dashboard figures, project detail, productivity,
   categories, upload), each consuming HTTP contracts delivered by the backend specs.

It delivers the shell the later screens are hung on: one application layout, one navigation, one
set of design tokens, four UI primitives, and the three states every data screen will need
(loading, empty, error). It deliberately delivers **no real figures** — every number on screen is
clearly labelled sample data until ingestion exists.

Its users are the reviewer opening the app for the first time, and the developer building FE-02.

**Runs entirely without the API.** Nothing in this spec issues an HTTP request, so it neither
blocks on nor is blocked by the parallel backend work (Constitution Principle VI).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the app and see something a director would keep open (Priority: P1)

A reviewer runs the documented command, opens `http://localhost:3000`, and lands on a dashboard
that looks like a finished product: a titled application frame, legible typography, aligned
numeric columns, and a clear notice that the figures shown are sample layout data.

**Why this priority**: The brief weights Craft at 15% on exactly this — "it looks like something a
director would open willingly. Legible tables, sane typography, no broken layouts." Nothing else
in FE-01 is worth building if the first screen does not clear that bar.

**Independent Test**: Start the dev server, open the root URL, and observe the framed dashboard
with its sample-data notice. No API, no database, no uploaded file required.

**Acceptance Scenarios**:

1. **Given** a clean checkout with dependencies installed, **When** the reviewer runs the
   documented dev command and opens `/`, **Then** a dashboard page renders inside the application
   shell with no console errors and no unstyled flash of the default Next.js starter.
2. **Given** the dashboard page, **When** the reviewer reads it, **Then** the five headline
   figures the brief names — total hours, billable hours, cost, revenue, margin — are each
   presented as a labelled figure.
3. **Given** the dashboard page, **When** the reviewer reads any figure or table cell containing a
   number, **Then** digits are aligned in a monospaced-width column, currency is shown in AED and
   percentages carry a `%` sign.
4. **Given** the dashboard page, **When** the reviewer looks for provenance of the numbers,
   **Then** a persistent, plainly worded notice states that the figures are placeholder layout
   data and no spreadsheets have been ingested yet.
5. **Given** the browser tab, **When** the reviewer looks at it, **Then** the title names the
   application rather than "Create Next App".

---

### User Story 2 - Move between the sections of the tool (Priority: P1)

A reviewer moves between Dashboard, Projects, Productivity and Categories and always knows which
section they are in.

**Why this priority**: Navigation is the part of the shell every later spec depends on. A screen
added in FE-02 must need no layout work to become reachable.

**Independent Test**: Click each navigation item in turn and confirm the URL, the page heading and
the highlighted navigation item agree.

**Acceptance Scenarios**:

1. **Given** any page, **When** the reviewer activates a navigation item, **Then** the matching
   route renders inside the same shell and the shell itself does not re-render or flicker.
2. **Given** the current route, **When** the reviewer inspects the navigation, **Then** exactly one
   item is visually marked as current and is programmatically marked as current for assistive
   technology.
3. **Given** a keyboard only, **When** the reviewer presses Tab from the top of the page, **Then**
   every navigation item is reachable in reading order and each shows a clearly visible focus
   indicator when focused.
4. **Given** a navigation item is focused, **When** the reviewer presses Enter, **Then** the
   corresponding route is navigated to.
5. **Given** a URL that matches no route, **When** it is requested, **Then** a not-found page
   renders inside the application shell offering a way back to the dashboard, rather than an
   unstyled framework error page.

---

### User Story 3 - Use the tool at the width you happen to have (Priority: P2)

A reviewer opens the app on a laptop, resizes to a tablet width, and checks it on a phone.

**Why this priority**: "No broken layouts" is explicit in the brief's Craft criterion, and a
leadership dashboard is opened on whatever is to hand. It is P2 rather than P1 because the desktop
experience is the one being assessed first.

**Independent Test**: Load the same page at three viewport widths and confirm the layout adapts
without horizontal page scrolling or clipped content.

**Acceptance Scenarios**:

1. **Given** a viewport of 1280px or wider, **When** any page renders, **Then** navigation is
   presented as a persistent side rail alongside the content.
2. **Given** a viewport narrower than the desktop breakpoint, **When** any page renders, **Then**
   navigation is presented within the header without obscuring the content, and remains fully
   operable.
3. **Given** a viewport of 375px, **When** any page renders, **Then** the document does not scroll
   horizontally and no text or figure is clipped.
4. **Given** a viewport of 375px and a table wider than the screen, **When** the reviewer scrolls
   the table, **Then** the table scrolls horizontally within its own bounds while the page does
   not.

---

### User Story 4 - Be told honestly when there is nothing to show (Priority: P2)

A reviewer opens Projects, Productivity or Categories before any spreadsheet has been ingested and
is told plainly that there is no data yet and what would change that.

**Why this priority**: The brief calls out "honest empty states" under Product judgement, and every
data screen FE-02 adds will reuse this exact component. Building it once, now, is what stops four
different improvised empty states appearing later.

**Independent Test**: Visit each of the three routes and confirm each renders the same empty-state
treatment with wording specific to that section.

**Acceptance Scenarios**:

1. **Given** no ingested data, **When** the reviewer opens Projects, Productivity or Categories,
   **Then** each page renders inside the shell with a heading, an empty state explaining that no
   spreadsheet data has been ingested, and wording naming what that section will show once it has.
2. **Given** an empty state, **When** the reviewer reads it, **Then** it does not present itself as
   an error, and it does not show a control that cannot yet do anything.
3. **Given** a screen reader, **When** an empty state is reached, **Then** its heading is part of
   the document heading outline rather than styled text alone.

---

### User Story 5 - See a considered response when something is slow or broken (Priority: P3)

A reviewer navigating to a page that is still rendering sees a skeleton in the shape of the page;
a reviewer hitting an unexpected failure sees a recoverable error panel rather than a blank screen.

**Why this priority**: Neither state is reachable through normal use until FE-02 introduces real
requests, so it is P3 — but the boundaries must exist before the first request is written, or the
first failure will be a white screen.

**Independent Test**: Verify the loading state by throttling or by temporarily delaying a segment;
verify the error state by temporarily throwing from a page and confirming recovery works.

**Acceptance Scenarios**:

1. **Given** a route segment that has not finished rendering, **When** the reviewer navigates to
   it, **Then** a skeleton placeholder in roughly the shape of the destination page is shown inside
   the shell, and the navigation remains visible and usable.
2. **Given** an uncaught rendering failure in a page, **When** it occurs, **Then** an error panel
   renders inside the shell stating that something went wrong, without exposing a raw stack trace
   to the reader.
3. **Given** the error panel, **When** the reviewer activates its retry control, **Then** the
   failed segment is re-rendered without a full page reload.
4. **Given** the error panel, **When** the failure was transient, **Then** retrying restores the
   normal page.

### Edge Cases

- **A route exists in navigation but its screen is not built yet.** Every navigation destination in
  this spec resolves to a real page. No navigation item points at a route that does not exist, and
  no page advertises a control that does nothing.
- **A table has more columns than the viewport is wide.** The table scrolls within its own
  container; the page does not.
- **The reader has reduced-motion enabled.** Any transition or skeleton animation respects the
  operating-system reduced-motion preference.
- **The reader is using a keyboard only.** Every interactive element is reachable and shows a
  visible focus indicator; focus is never trapped and never invisible.
- **JavaScript is slow to hydrate.** The shell, the navigation links and the page content are
  server-rendered and readable before hydration; only the current-item highlight and the retry
  control require client JavaScript.
- **A number is unknown rather than zero.** The formatting rules distinguish an absent value from a
  zero value, so a missing salary in a later spec cannot render as `AED 0`.

## Requirements *(mandatory)*

### Functional Requirements

**Application shell and navigation**

- **FR-001**: The application MUST present every page inside a single shared shell comprising a
  header identifying the product and a navigation region.
- **FR-002**: The shell MUST offer navigation to exactly four sections — Dashboard, Projects,
  Productivity and Categories — each resolving to an existing route.
- **FR-003**: The navigation MUST mark the section matching the current route as current, both
  visually and programmatically, and MUST mark exactly one item as current at a time.
- **FR-004**: Navigation between sections MUST preserve the shell without a full document reload.
- **FR-005**: The browser tab title MUST name the application, and each section MUST contribute its
  own section name to the title.
- **FR-006**: The application MUST render a styled not-found page inside the shell for any
  unmatched URL, offering a route back to the dashboard.

**Presentation system**

- **FR-007**: The application MUST define its typography, colour, spacing and radius values as a
  single named set of design tokens, and components MUST consume those tokens rather than
  hard-coded values.
- **FR-008**: The token set MUST include a distinct positive and a distinct negative accent for
  signed financial figures, usable in both the light and dark colour schemes.
- **FR-009**: Numeric values MUST render with fixed-width digits so that figures in a column align.
- **FR-010**: The application MUST provide one formatting rule each for currency (AED), hours,
  and percentages, and MUST render an absent value distinguishably from a zero value.
- **FR-011**: Every interactive element MUST show a visible focus indicator meeting a minimum
  contrast against its background, and MUST NOT rely on colour alone to convey state.
- **FR-012**: Text and interactive controls MUST meet WCAG 2.1 AA contrast in both colour schemes.
- **FR-013**: Motion MUST be suppressed when the reader has expressed a reduced-motion preference.

**UI components**

- **FR-014**: The application MUST provide a button, a card, a table and a skeleton component, each
  built on the project's existing UI library and style, and MUST NOT introduce a component that no
  page in this spec renders.
- **FR-015**: The table component MUST use semantic table markup with a header row, MUST support
  right-aligned numeric columns, and MUST scroll horizontally within its own bounds.
- **FR-016**: The application MUST provide one empty-state component and one error-state component,
  each accepting the wording of the section that renders it.

**Page states**

- **FR-017**: The application MUST render a loading skeleton, shaped like the destination page,
  while a route segment is pending, with the shell and navigation remaining visible.
- **FR-018**: The application MUST catch uncaught rendering failures below the shell and render a
  recoverable error panel, without exposing a raw stack trace to the reader.
- **FR-019**: The error panel MUST offer a retry control that re-renders the failed segment without
  a full page reload.

**Pages**

- **FR-020**: The dashboard page MUST present the five headline figures named in the assessment —
  total hours, billable hours, cost, revenue, margin — and one project-level table.
- **FR-021**: The dashboard page MUST state plainly and persistently that its figures are
  placeholder layout data and that no spreadsheets have been ingested.
- **FR-022**: The Projects, Productivity and Categories pages MUST each render a section heading
  and the shared empty state, worded for that section.

**Boundaries**

- **FR-023**: The application MUST NOT issue any HTTP request to the API, MUST NOT implement any
  calculation from the assessment's maths section, and MUST NOT implement authentication behaviour.
  This extends to placeholder content: a derived figure — a ratio, a profit, a margin — MUST be
  carried as a value in the sample data and merely formatted for display. The page MUST NOT
  compute one, even from literals, because a formula written here is a second implementation of a
  rule the API owns, and the two will drift.
- **FR-024**: The change MUST be confined to `apps/web`, MUST NOT add shared code, types or schemas
  between the applications, and MUST NOT modify root configuration or the lockfile.
- **FR-025**: No Zustand store may be introduced by this spec, because no shared UI state outlives
  a single component in it. React Query's provider is reused unchanged and no query is written.
- **FR-026**: No automated test, testing dependency, test file, mock, fixture, test configuration
  or test script may be added. Verification is by lint, type check, build, and the documented
  manual browser checks.

### Key Entities

Not applicable. This spec renders no persisted or fetched data; the sample figures on the dashboard
are literal values inside the page that renders them and model nothing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a clean checkout, a reviewer reaches a styled dashboard in two documented
  commands and under five minutes, with no cloud account, API key or paid service.
- **SC-002**: All four navigation sections are reachable, and 0 of them resolve to a missing route,
  an unstyled page or a console error.
- **SC-003**: At viewport widths of 375px, 768px and 1280px, 0 pages scroll the document
  horizontally and 0 pages clip content.
- **SC-004**: Every interactive element on every page is reachable by keyboard alone and shows a
  visible focus indicator — 0 exceptions.
- **SC-005**: Text and control contrast meets WCAG 2.1 AA in both the light and dark colour
  schemes, on every page delivered by this spec.
- **SC-006**: Lint, type check and production build each complete with 0 errors and 0 warnings.
- **SC-007**: The diff touches 0 files outside `apps/web/`, other than this spec's own artifacts
  and the constitution amendment that permits it.
- **SC-008**: The repository contains 0 test files, 0 testing dependencies and 0 test scripts after
  this spec is implemented.
- **SC-009**: A reviewer who has not read this spec can state, from the dashboard alone, that the
  figures shown are not real.

## Assumptions

- **No design files were supplied.** The assessment PDF is the only visual reference. Its
  restrained editorial character — generous whitespace, a strong heading scale, quiet rules
  between rows — is taken as the direction, expressed through the neutral token palette already
  configured in `apps/web`. No new palette is invented.
- **The existing frontend scaffold is the starting point and is kept.** Next.js App Router, React,
  Tailwind v4, the configured shadcn style over Base UI, the React Query provider, and the
  configured fonts are all reused. The default starter page content is replaced.
- **AED is the currency.** The brief's self-check is stated "to the dirham".
- **Four sections, not five.** Upload is a real screen in the assessment, but it is meaningless
  without an ingestion endpoint, and a navigation item leading to a page that cannot accept a file
  would violate FR-002's intent. Upload arrives with the spec that delivers ingestion.
- **Project detail is deferred.** `/projects/[refCode]` needs a project to detail; it arrives with
  the spec that lists real projects.
- **Filter controls are deferred.** Year and month filters are required by several later screens,
  but a filter with nothing to filter is a decorative control, which FR-022 forbids. The filter
  component arrives with the first screen that has data.
- **No new dependency is expected.** The button, card, table and skeleton components are expected
  to build on packages already installed in `apps/web`. If one genuinely requires a package that is
  not installed, it is recorded for coordination rather than installed, because adding it would
  change the shared lockfile while backend work is in flight (FR-024).
- **Authentication is not considered.** BE-02 is being planned in parallel; no route guard, session
  read, login affordance or protected-layout scaffolding is introduced here, and none is designed
  around. Integrating it later is expected to add a layout, not to rework this shell.
