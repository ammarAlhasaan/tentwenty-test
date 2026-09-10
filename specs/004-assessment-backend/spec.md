# Feature Specification: BE-03 — Complete Assessment Backend

**Feature Branch**: `004-assessment-backend`

**Created**: 2026-09-10

**Status**: Draft — awaiting review

**Scope**: `apps/api` only (per Constitution Principle V)

**Input**: User description: "BE-03 Complete Assessment Backend. Ingest the three supplied spreadsheets through authenticated upload endpoints with messy-header tolerance, row-level errors and warnings, and transactional per-period replacement. Implement the assessment's exact cost model in the backend, reconciling to the stated self-check. Expose every read API the frontend screens need, plus configurable assumptions. Reuse the existing configuration, validation, error, database and authentication building blocks. No frontend changes, no automated tests, no Swagger."

## Overview

BE-03 is the **final backend spec** for the Margin Dashboard. BE-01 delivered configuration,
validation, the error shape and the SQLite connection; BE-02 delivered cookie-based
authentication. BE-03 delivers everything the assessment actually asks a backend to do:

1. **Ingestion** — take the three `.xlsx` files, validate them, and persist them.
2. **Calculation** — the assessment's cost model, in full, in one place.
3. **Read APIs** — every figure the five required pages need, calculated and ready to display.
4. **Assumptions** — billable categories and monthly overhead, changeable without editing code.

After BE-03 no further backend feature spec is needed. The remaining frontend specs consume the
HTTP contracts published here; automated testing is a separate, later, cross-cutting spec.

Its users are the finance and leadership readers of the dashboard (indirectly, through the
frontend), the reviewer running the project from a clean checkout, and the developer building the
data-backed frontend screens.

### Source of truth

Every requirement below traces to *Margin Dashboard Exercise* (the assessment PDF) and to the
three supplied workbooks, both read directly during specification. Column names, category names,
month formats and formulas in this document are the ones actually present in those files, not
inferred from the brief's prose.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load the year and get numbers that reconcile (Priority: P1)

A signed-in reviewer uploads the timesheet, the salary overview and the project prices. The API
accepts all three, reports what it loaded, and from then on answers every figure the dashboard
needs for any month or for the whole year — with a company-wide total cost that equals total
salaries to the dirham when overhead is zero.

**Why this priority**: Correctness carries the single largest weight in the assessment (30%), and
the reconciliation self-check is the assessment's own definition of correct. Nothing else in
BE-03 is worth having if the numbers do not tie out.

**Independent Test**: Sign in, POST the three supplied files, GET the year-level dashboard with
overhead at zero, and compare total cost against the sum of all salary cells in the salary
workbook.

**Acceptance Scenarios**:

1. **Given** an empty database and a signed-in session, **When** the reviewer uploads
   `timesheet-2025.xlsx`, `salaries-2025.xlsx` and `project-prices-2025.xlsx`, **Then** each
   upload returns the number of rows accepted, the periods it wrote, and any warnings, and none
   returns an error.
2. **Given** the three files are loaded and monthly overhead is `0`, **When** the reviewer
   requests the dashboard for the full year 2025, **Then** total cost equals AED 2,400,000 — the
   sum of every salary cell in the workbook — within half a dirham.
3. **Given** the same state, **When** the reviewer requests the dashboard for the full year,
   **Then** total hours equal 19,815.20 and billable hours equal 15,265.60.
4. **Given** the same state, **When** the reviewer sets monthly overhead to a non-zero figure,
   **Then** total cost for the year increases by exactly twelve times that figure and the
   reconciliation reports both that it balances and that the salaries behind it are complete.
5. **Given** the same state, **When** the reviewer requests any single month, **Then** that
   month's total cost equals that month's total salaries plus that month's overhead.

---

### User Story 2 - Re-upload a corrected month without damaging the year (Priority: P1)

Someone spots a mistake in March, fixes the March rows in the spreadsheet, and uploads it again.
March is replaced; January, February and April to December are untouched; nothing is duplicated.

**Why this priority**: The assessment names this behaviour explicitly under Must Have
("Re-uploading a corrected month must not duplicate or destroy the rest of the year") and again
under Data handling in the scoring table. It is a correctness requirement, not a convenience.

**Independent Test**: Load the full year, note the year total, upload a workbook containing only
March with one hours figure changed, and confirm the year total moves by exactly the difference
and every other month is byte-identical.

**Acceptance Scenarios**:

1. **Given** a fully loaded year, **When** the reviewer uploads a timesheet containing only
   March rows, **Then** the March figures reflect the new file, every other month is unchanged,
   and the response names March as the only period replaced.
2. **Given** a fully loaded year, **When** the reviewer uploads the identical original timesheet a
   second time, **Then** every figure in the dashboard is unchanged — no total doubles.
3. **Given** a fully loaded year, **When** the reviewer uploads a workbook whose rows fail
   validation, **Then** the API rejects the file, changes no stored data, and the dashboard still
   reports the same figures as before the attempt.
4. **Given** a loaded year, **When** the reviewer uploads a project-price workbook that omits a
   previously loaded project, **Then** that project's price is retained and the response says the
   file added or updated prices rather than replacing the catalogue.

---

### User Story 3 - Answer "did we make money on that project?" (Priority: P1)

A reader opens one project and sees its price, its hours split by department, what it cost, what
it made, its margin, and what each person on it contributed and earned.

**Why this priority**: It is the question the assessment opens with and the Project page is a Must
Have. It is also where per-employee profitability (Should Have) lands.

**Independent Test**: With the year loaded, request one project by its ref code and check price,
hours, cost, profit and margin against a hand-worked example.

**Acceptance Scenarios**:

1. **Given** the year is loaded, **When** the reviewer requests project `Q2025001a`, **Then** the
   response carries its price (AED 560,000), its total hours (3,025.20), its cost, its profit,
   its margin, its department split and a row per contributing employee.
2. **Given** the same project, **When** the reviewer reads an employee row, **Then** it carries
   that person's hours, cost, revenue share and profitability, computed by the assessment's
   formulas.
3. **Given** the same project, **When** the reviewer sums the per-employee costs, **Then** the sum
   equals the project's total cost, and the per-employee revenue shares sum to the project price.
4. **Given** a project with hours logged but no price row, **When** the reviewer requests it,
   **Then** cost and hours are reported, revenue, profit and margin are reported as unknown rather
   than zero, and a warning names the missing price.

---

### User Story 4 - Filter the dashboard, productivity and categories by period (Priority: P2)

A reader picks a year and optionally a month, and every headline figure, productivity number and
category total follows the filter consistently.

**Why this priority**: The year and month filter is named on three of the five Must Have pages.
It is separable from P1 — the year-level figures are useful on their own — but the pages are
incomplete without it.

**Independent Test**: Request the same endpoint with and without a month and confirm the twelve
monthly responses aggregate to the year response for every additive figure.

**Acceptance Scenarios**:

1. **Given** the year is loaded, **When** the reviewer requests hours, billable hours and cost for
   each of the twelve months and sums them, **Then** each sum equals the year figure.
2. **Given** the year is loaded, **When** the reviewer requests productivity for March, **Then**
   each employee's productivity is that employee's March billable hours divided by their March
   total hours.
3. **Given** the year is loaded, **When** the reviewer requests categories for a month, **Then**
   the category hours sum to that month's total hours and the billable subtotal matches the
   dashboard's billable hours for the same month.
4. **Given** a period in which a project logged no hours, **When** the reviewer requests the
   project list for that period, **Then** that project either does not appear or appears with
   zero period hours — and never with its full price shown as that period's revenue.

---

### User Story 5 - See where a bad file went wrong (Priority: P2)

Someone uploads the wrong file, a file with a renamed column, or a file with a broken row. The
API says what is wrong, where, and changes nothing.

**Why this priority**: "Honest empty and error states" is a Should Have and Data handling is 20%
of the score. It is separable from P1 because the happy path is independently valuable.

**Independent Test**: Upload a PDF renamed to `.xlsx`, a workbook missing the `Hours` column, and
a workbook with a negative hours value, and read the three different responses.

**Acceptance Scenarios**:

1. **Given** a signed-in session, **When** the reviewer uploads a file that is not a valid
   workbook, **Then** the API rejects it with a message saying so, and stores nothing.
2. **Given** a signed-in session, **When** the reviewer uploads a workbook whose header row is
   missing a required column, **Then** the response names the missing column and the columns it
   did find.
3. **Given** a signed-in session, **When** the reviewer uploads a workbook with invalid values in
   three rows, **Then** the response identifies each offending row by its spreadsheet row number
   and the reason, and no part of the file is stored.
4. **Given** a signed-in session, **When** the reviewer uploads a workbook larger than the
   permitted size, **Then** the API rejects it before parsing.

---

### User Story 6 - Change the assumptions without touching code (Priority: P3)

A reader decides that a category should or should not count as billable, or enters a monthly
overhead figure, and every figure in the product updates consistently.

**Why this priority**: "Configurable assumptions" is a Should Have. The defaults taken from the
assessment are correct out of the box, so the product is complete without it — but the
reconciliation self-check itself requires overhead to be settable to zero, so the setting must
exist.

**Independent Test**: Read the settings, change the overhead, re-request the dashboard, and
confirm cost moved by the expected amount and nothing else did.

**Acceptance Scenarios**:

1. **Given** a loaded year, **When** the reviewer reads the assumptions, **Then** the billable
   categories are `Projects`, `Enhancements` and `Hosting` and the monthly overhead is `0`.
2. **Given** a loaded year, **When** the reviewer marks an internal category as billable, **Then**
   billable hours rise by that category's hours, the indirect pool falls by that category's cost,
   and total cost is unchanged.
3. **Given** a loaded year, **When** the reviewer sets a monthly overhead, **Then** total cost
   rises by that figure times the number of months in the selected period, and revenue is
   unaffected.
4. **Given** any state, **When** the reviewer submits an assumption value that is not permitted,
   **Then** the API rejects it and the stored assumptions are unchanged.

---

### User Story 7 - Know what is loaded, and what is missing from it (Priority: P3)

Before trusting a number, a reader can see which periods have data, when each file was loaded,
and which gaps exist — people without salaries, projects without prices, months without billable
hours.

**Why this priority**: It makes the empty and partial states honest rather than blank, which the
assessment asks for, but the calculated figures are correct without it.

**Independent Test**: Load only the timesheet, then read the periods and import endpoints and
confirm they report the missing salary and price data rather than showing zeroes.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** the reviewer requests available periods, **Then** the
   response is an explicit "nothing loaded" answer rather than an error.
2. **Given** only the timesheet is loaded, **When** the reviewer requests the dashboard, **Then**
   cost is reported as unknown or zero with a warning naming the missing salary data, and hours
   are reported normally.
3. **Given** all three files are loaded, **When** the reviewer requests the import history,
   **Then** each upload is listed with its file name, its time, its row count, the periods it
   wrote, and its warning count.
4. **Given** a month whose data contains an employee with hours but no salary, **When** the
   reviewer requests any figure for that month, **Then** a warning names that employee and the
   month.

### Edge Cases

- **An employee logs no hours in a month.** Their whole salary enters the indirect cost pool for
  that month — this is the assessment's "support staff" rule and it is not an error.
- **A month has no billable hours at all.** The indirect cost rate is undefined. The indirect pool
  for that month cannot be attached to any project; it is reported as unallocated cost and named
  in a warning, so total cost still equals salaries plus overhead.
- **A person has timesheet hours but no salary row.** Their direct cost rate is **unknown**. Their
  hours still count toward hours and productivity figures, but their cost is reported as `null`,
  not `0`; the month's indirect cost pool is incomplete, so every allocated project cost in that
  month is marked partial; and profit and margin for any period covering that month are withheld
  rather than shown as trustworthy figures.
- **A person has a salary recorded as `0`.** That is a genuine zero, not a gap. Their direct rate
  is `0`, their cost contribution is `0`, and nothing is marked partial.
- **A ref code has billable hours but no price row.** Cost is still allocated to it. Its allocated
  revenue, profit and margin are `null` — never `0` — and every period containing those hours has
  its revenue marked partial, so a missing price cannot quietly depress a margin.
- **A project's price is zero.** Profitability is `null` — undefined, not −100%.
- **A project costs more than its price.** Profitability is negative, and may be below `-1`. It is
  reported as it falls out of the formula and is never clamped.
- **A salary workbook contains a month column whose cells are all blank.** That month's stored
  salaries are cleared and left unknown — a correction that removes salaries must be possible.
- **A project spans several months.** Its price is never reported as any single month's revenue —
  see Assumptions.
- **The same person, month, ref code and description appear on more than one row.** Both rows are
  stored, exactly as supplied. Nothing is merged: rows that look alike may differ in a dimension a
  drilldown needs, and identical rows are normally two real entries of work.
- **A blank row sits between data rows.** It is skipped, not treated as an error.
- **The header row is not row 1.** It is located by its column names, not by position.
- **A month is written `May '25`, `January 2026`, or just `January`.** All are understood; a bare
  month name is resolved against the year the workbook itself states, and rejected with a clear
  message if no year can be determined.
- **A workbook contains a year that has never been loaded before.** It is added alongside the
  existing years; no previously loaded year is touched.
- **Two uploads arrive at once.** Each is applied as a whole or not at all; neither leaves
  half-written data.
- **An unauthenticated caller requests any figure or upload.** The request is refused before any
  file is read or any figure computed.

## Requirements *(mandatory)*

### Functional Requirements

#### Access control

- **FR-001**: Every ingestion and business endpoint MUST require a valid signed-in session and
  MUST refuse an anonymous caller with the same rejection the rest of the application uses.
- **FR-002**: The health endpoint and all authentication behaviour MUST be unchanged by this
  feature.

#### Ingestion — file acceptance

- **FR-003**: The system MUST accept one workbook per request for each of three kinds: timesheet,
  salary overview, and project prices.
- **FR-004**: The system MUST reject a request whose upload is not a readable `.xlsx` workbook,
  naming that as the reason.
- **FR-005**: The system MUST reject an upload above a documented maximum size before parsing it.
- **FR-006**: The system MUST locate the header row by matching required column names rather than
  assuming a fixed row, and MUST match column names case-insensitively and ignoring surrounding
  whitespace and punctuation differences.
- **FR-007**: The system MUST reject a workbook in which a required column cannot be found,
  naming the missing column and listing the columns it did find.
- **FR-008**: The system MUST understand month values written as a month name with a full year, a
  month name with a two-digit year, a bare month name resolved against a year stated elsewhere in
  the workbook, and a date cell.
- **FR-009**: The system MUST treat `-`, an empty cell and a whitespace-only cell as "no value".
- **FR-010**: The system MUST skip entirely blank rows without reporting them as errors.

#### Ingestion — validation, errors and warnings

- **FR-011**: The system MUST validate every row before writing anything, and MUST reject the
  whole file if any row fails, identifying each failing row by its spreadsheet row number and the
  reason.
- **FR-012**: A rejected upload MUST leave every previously stored figure exactly as it was.
- **FR-013**: The system MUST report warnings that do not block acceptance, covering at least: a
  billable ref code with no price row, an employee with hours but no salary for that month, a
  salary row for an employee with no hours that month, a price that is missing or not positive,
  and a month with no billable hours.
- **FR-013a**: The system MUST store every accepted timesheet row as supplied. It MUST NOT merge,
  deduplicate or otherwise collapse rows, and MUST NOT discard any dimension a calculation or a
  drilldown depends on — year, month, employee, department, designation, category, ref code or
  expense type.
- **FR-014**: The system MUST cap the number of individual row errors returned in one response and
  state the total count when it caps.

#### Ingestion — persistence and replacement

- **FR-015**: The system MUST persist accepted data in the existing SQLite database, alongside the
  existing users and sessions, without requiring the database file to be deleted.
- **FR-016**: For a timesheet upload, the system MUST replace all stored timesheet data for each
  calendar month present in the file and MUST leave every other month untouched.
- **FR-017**: For a salary upload, the system MUST determine its replacement scope from the month
  **columns present in the workbook**, whether or not those columns hold values. It MUST replace
  all stored salary data for each such month and MUST leave every month with no column untouched.
- **FR-017a**: A month column whose cells are all blank MUST clear that month's stored salaries and
  leave them unknown, so that a correction can remove a salary as well as change one.
- **FR-018**: For a project-price upload, the system MUST insert or update each project by its ref
  code and MUST NOT delete a project that the file omits.
- **FR-019**: Each upload MUST be applied as a single all-or-nothing unit.
- **FR-020**: Uploading the same file twice MUST produce the same stored data as uploading it
  once.
- **FR-021**: The system MUST record each accepted upload — its kind, file name, time, row count,
  the periods it wrote, and its warnings — and MUST expose that history.
- **FR-022**: The system MUST NOT retain the uploaded file itself; the assessment requires no
  re-download or re-parse of an original, and the parsed rows are the record.
- **FR-022a**: The three supplied sample workbooks MUST be present in a clean checkout at a
  documented, version-tracked location, and MUST NOT be modified. They MUST NOT depend on an
  ignored directory or on an absolute path specific to one machine.
- **FR-022b**: The system MUST provide the backend support for loading that sample data in a single
  action, reusing the same parsing, validation and persistence path as an ordinary upload. It MUST
  NOT introduce a second ingestion pipeline. The one-click user interface itself belongs to the
  later frontend upload spec.

#### Calculations

- **FR-023**: All business calculation MUST happen in the backend. Responses MUST carry finished
  figures; no formula from this section may be left for the frontend to reproduce.
- **FR-024**: The system MUST compute, per person per month, a direct cost rate equal to that
  month's salary divided by that month's total logged hours.
- **FR-025**: The system MUST compute, per month, an indirect cost pool equal to the salaries of
  people who logged no hours, plus everyone else's non-billable hours valued at their own direct
  rate, plus the configured monthly overhead.
- **FR-026**: The system MUST compute, per month, an indirect cost rate equal to the indirect cost
  pool divided by that month's billable hours.
- **FR-027**: The system MUST compute an employee's cost on a project as their hours on it times
  the sum of their direct rate and that month's indirect rate.
- **FR-028**: The system MUST compute an employee's revenue share on a project as the project
  price times their share of the project's total hours across every loaded period.
- **FR-028a**: The system MUST allocate a project's price to a period as
  `price x (the period's hours on that project / the project's hours across every loaded period)`.
  The denominator MUST be the lifetime total and MUST NOT be narrowed by the requested period
  filter. The same rule MUST be used by the dashboard, the project list, project detail,
  department figures and employee revenue shares.
- **FR-028b**: The system MUST name this figure `allocatedRevenue` and MUST document that it is an
  hour-based reporting assumption, not a revenue-recognition rule prescribed by the assessment,
  and that loading further hours for a project revises the allocated revenue previously reported
  for earlier periods.
- **FR-029**: The system MUST compute employee profitability on a project as revenue share minus
  employee cost, divided by revenue share.
- **FR-030**: The system MUST compute project profitability as price minus total project cost,
  divided by price.
- **FR-031**: The system MUST compute productivity as billable hours divided by total hours
  logged.
- **FR-032**: The system MUST report, for any period, total hours, billable hours, non-billable
  hours, total cost, revenue, profit and margin.
- **FR-033**: The system MUST report hours and cost per department, and per employee within each
  department.
- **FR-034**: The system MUST report hours per category and the split between billable and
  internal time.
- **FR-035**: Where a formula's denominator is zero or an input is absent, the system MUST report
  the result as `null` and MUST NOT report it as zero, `NaN` or `Infinity`.
- **FR-035a**: The system MUST distinguish a salary recorded as `0` from a salary that is absent. A
  recorded `0` is a genuine zero and yields a direct cost rate of `0`; an absent salary yields an
  unknown direct cost rate.
- **FR-035b**: An employee whose direct cost rate is unknown MUST have their cost reported as
  `null`, and MUST NOT be counted as costing zero.
- **FR-035c**: A month in which any employee with logged hours has an unknown salary MUST be
  treated as having an incomplete indirect cost pool, and every allocated project cost in that
  month MUST be marked partial — a single missing salary affects the whole month's allocation, not
  only that person's rows.
- **FR-035h**: The indirect cost rate's denominator MUST be **all** billable hours in the month, as
  the assessment specifies. It MUST NOT be narrowed to the hours of employees whose salary is
  known: that would make colleagues absorb a missing person's share of the pool in order to force
  the reconciliation to balance. The pool that falls on hours with an unknown direct rate MUST be
  reported as uncosted rather than redistributed.
- **FR-035i**: Partial cost MUST propagate to every reported grouping — month, department, employee
  and project — and each MUST expose its own completeness, so that a gap in one month does not
  discredit figures from other months. Any profitability or margin derived from a partial cost MUST
  be withheld, including for an employee whose own salary is known.
- **FR-035d**: The system MUST report, separately from any figure, whether the cost inputs and the
  revenue inputs for the requested scope are complete or partial, and MUST name the reasons.
- **FR-035e**: Where cost or revenue is partial, the system MUST withhold profit and margin —
  reporting them as `null` — rather than presenting a figure derived from incomplete inputs as
  though it were complete.
- **FR-035f**: A project without a price MUST report `null` allocated revenue, profit and margin,
  and MUST mark the revenue of every period containing its hours as partial. It MUST NOT report
  zero revenue.
- **FR-035g**: Margins and profitability MUST NOT be clamped to any range. Values below `-1` are
  reported as they arise.
- **FR-036**: The system MUST carry full precision through every intermediate step and round only
  the values it returns.
- **FR-037**: The system MUST expose, for any period, the reconciliation between total cost and
  known salaries plus overhead, including any cost that could not be allocated.
- **FR-037a**: The reconciliation MUST report arithmetic balance and dataset completeness as two
  separate facts. A balanced reconciliation over known inputs MUST NOT be presented as evidence
  that the dataset is complete, and the response MUST state how many employee-months have no
  salary on record.

#### Assumptions

Recorded because the assessment leaves them open. Each states the reading taken and why.

- **A-001 — Period revenue is *allocated* by hour share. This is a reporting assumption, not an
  accounting rule.** A project has one price and 2–5 months of hours, and the assessment does not
  say how to split a price across periods. Reporting the full price as the sales month's revenue
  would put AED 560,000 of January revenue against AED 197,000 of January cost. So a period is
  credited `price x (that period's hours on the project / the project's hours across every loaded
  period)`. The field is named **`allocatedRevenue`**, never `revenue`, because nothing in the
  assessment prescribes revenue recognition — the brief only supplies an hour-share formula for
  *employee* revenue share, and this extends the same idea to periods. **This materially changes
  monthly revenue, profit and margin, and is the one assumption worth confirming with the
  assessor.** The sales-month view is kept separately as `bookedRevenue`.
- **A-002 — The allocation denominator is lifetime, never the filtered period.** The denominator is
  the project's total hours across **all loaded periods**, read separately from the period-filtered
  numerator. Using the period's own hours as the denominator would credit every period with the
  entire price. A consequence, stated in the contracts and the README: **importing more hours for a
  project revises the allocated revenue already reported for earlier periods.** The same denominator
  is used by the dashboard, the project list, project detail, department figures and employee
  revenue shares — there is one rule, applied everywhere.
- **A-003 — Project lifetime profitability keeps the assessment's exact formula**,
  `(price - total project cost) / price`, unaffected by A-001. Allocation splits a price across
  periods; it never changes the project's own arithmetic.
- **A-004 — A missing salary is unknown, and unknown is not zero.** A salary that is absent makes
  that person's direct cost rate unknown, which makes their cost unknown *and* leaves that month's
  indirect cost pool incomplete — which in turn makes every allocated project cost in that month
  partial. A salary recorded as `0` is a genuine zero and is treated as one. See FR-035a to FR-035f.
- **A-005 — Arithmetic balance and dataset completeness are reported separately.** The
  reconciliation balances over the inputs that are actually present; a separate completeness flag
  says whether those inputs are all of them. A balanced reconciliation never implies a complete
  dataset.
- **A-006 — Billable means the category, not the ref code.** `Projects`, `Enhancements` and
  `Hosting` are billable by default, as the assessment names them. `Tentwenty` — internal product
  work with hours and a ref code but no price — is internal time, which is why it has no price row.
  Changeable at runtime.
- **A-007 — Project prices are upserted, never replaced wholesale.** A catalogue upload that omits
  a project is far more likely to be partial than to be a deletion, so omission does not delete.
- **A-008 — Timesheet rows are stored exactly as supplied.** No row is merged with another. Two
  rows that look alike may differ in department, category or metadata that a drilldown depends on,
  and identical rows are usually two real entries of work. Repeat-upload idempotence comes from
  transactional period replacement, not from deduplication.
- **A-009 — A salary upload's replacement scope is the month columns present in the workbook,
  whether or not their cells hold values.** A corrected month whose cells are all blank clears that
  month's stored salaries and leaves them unknown; a month with no column is untouched.
- **A-010 — Overhead is one figure applied to every month.** The assessment says "a monthly overhead
  figure entered by the user", singular. Per-month overrides are not built.
- **A-011 — The uploaded files are not retained.** Nothing re-reads an original. The tracked sample
  workbooks under `apps/api/sample-data/` are a separate, read-only fixture, not retained uploads.
- **A-012 — Multi-year support is a stretch goal and is not built, but nothing prevents it.** Data
  is keyed by year and month, so loading 2024 alongside 2025 works; no comparison endpoint exists.
- **A-013 — Existing building blocks are reused as-is.** Configuration, request validation, the
  error response shape, the database connection, the origin guard and the session guard come from
  BE-01 and BE-02 unchanged.

## Number contracts

- **Hours** are `>= 0`.
- **Shares** — `productivity`, `shareOfHours`, `shareOfTotal` — are fractions in `0..1`, because
  their numerator is a subset of their denominator.
- **Margins and profitability are unbounded and frequently negative.** `margin`,
  `profitability` and per-employee profitability may be less than `-1` — a project that costs
  three times its price has a profitability of `-2`. These values **MUST NOT be clamped** to any
  range.
- **Undefined is `null`.** A zero or unknown denominator yields `null`, never `0`, `NaN` or
  `Infinity`. No response field may serialise as `NaN` or `Infinity`.

## Out of Scope

Named explicitly so nothing is silently dropped.

- **Frontend work of any kind.** `apps/web` is untouched. In particular the **one-click
  sample-data button belongs to the later frontend upload spec**; BE-03 delivers only the endpoint
  it calls, so the requirement is assigned rather than dropped.
- **Automated tests and testing infrastructure.** Deferred to a later cross-cutting spec.
- **CSV export** (assessment stretch goal) — a frontend concern once the tables exist.
- **Employee x category matrix** (stretch goal) — the category and productivity endpoints carry
  the underlying figures; the pivot itself is not built.
- **Cost-rate audit view** (stretch goal) — the per-month rates are exposed on the reconciliation
  figures, but no dedicated audit endpoint is built.
- **Multi-year side-by-side comparison** (stretch goal) — see A-009.
- **Swagger / OpenAPI.** Markdown contracts are published instead.
