# Feature Specification: Cost Model Verification Suite

**Feature Branch**: `009-cost-model-tests`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Unit tests for the cost model calculation layer in apps/api — nine deliberately minimal cases covering the assessment's reconciliation self-check, the rate formulas, and the missing-data behaviour. No parser, controller, service, or frontend tests."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The reconciliation guarantee is proven, not asserted (Priority: P1)

A reviewer opening the repository wants to know whether the margin figures can be trusted. The
assessment states one check that settles it: run a full period with the overhead figure set to
zero, and the company-wide total cost must equal total salaries to the dirham. Today that check
exists only as arithmetic inside the calculation layer and as a figure rendered on the dashboard —
nobody can confirm it holds without loading data and reading a screen.

This story makes the guarantee executable: a single command proves the reconciliation holds, and
fails loudly the moment a change to the calculation layer breaks it.

**Why this priority**: Correctness carries the most weight of any evaluation area, and double
counting is the specific failure it names. Every other check in this feature is secondary to this
one. If only this story ships, the repository still gains its single most valuable guarantee.

**Independent Test**: Run the verification command against a period containing billable hours,
non-billable hours, and a support employee who logged no hours at all, with the overhead figure at
zero. The reported total cost equals the sum of the salaries exactly. Deliberately introducing a
double count into the calculation layer makes the command fail.

**Acceptance Scenarios**:

1. **Given** one month holding billable hours, non-billable hours, and a support employee with a
   salary but no logged hours, **When** the total cost of every row in that month is computed with
   the overhead figure at zero, **Then** the result equals the sum of that month's salaries to
   within one hundredth of a dirham.
2. **Given** two consecutive months in which the same people are paid different salaries and log
   different hours, **When** the total cost across both months is computed with the overhead figure
   at zero, **Then** the result equals the sum of both months' salaries — confirming each month is
   costed at its own rates rather than at a blended rate.
3. **Given** the same data with a non-zero monthly overhead figure, **When** the total cost is
   computed, **Then** the result equals the sum of salaries plus that overhead figure counted once
   for the month — not once per employee and not once per row.

---

### User Story 2 - Each formula in the brief is pinned to its stated definition (Priority: P2)

The assessment hands over the cost model as fixed domain knowledge and asks for it to be
implemented exactly. Several of its definitions have a plausible-looking wrong version that would
still produce numbers a reader could not tell apart from the right ones — most notably dividing a
salary by billable hours instead of by all logged hours.

This story pins each definition individually, so a future change that quietly substitutes the wrong
denominator is caught at the formula rather than only at the aggregate.

**Why this priority**: The reconciliation in Story 1 can hold even when an individual rate is
defined wrongly, because the errors cancel across the period. Pinning the formulas separately
closes that gap. It depends on nothing from Story 1 and can ship on its own.

**Independent Test**: Run the verification command against a single employee whose billable and
total hours differ, and against a period whose indirect pool has all three of its stated
components. The reported per-hour rates match the definitions in the assessment, computed by hand.

**Acceptance Scenarios**:

1. **Given** an employee paid a known salary who logged a known number of hours, only some of them
   billable, **When** that employee's direct cost rate for the month is read, **Then** it equals the
   salary divided by the employee's **total** logged hours for that month.
2. **Given** a month containing a support employee who logged no hours, an employee with
   non-billable time, and a stated monthly overhead figure, **When** the month's indirect cost pool
   is read, **Then** it equals the support employee's salary, plus the non-billable time valued at
   its owner's direct rate, plus the overhead figure — and nothing else.
3. **Given** that same month, **When** the indirect cost rate per hour is read, **Then** it equals
   the indirect cost pool divided by that month's billable hours.
4. **Given** a category list that names the billable categories, **When** a timesheet row's category
   is tested against it, **Then** the match ignores differences in letter case, and a category
   absent from the list is treated as internal time.
5. **Given** a revenue figure and a cost figure that together produce a loss, **When** the resulting
   margin is computed, **Then** it is reported as a negative value rather than clamped to zero, and a
   margin whose denominator is zero or unknown is reported as unknown rather than as zero.

---

### User Story 3 - Missing data degrades honestly instead of silently (Priority: P3)

The assessment states outright that the data is imperfect: some people have logged hours with no
salary row, and some months may hold no billable work at all. It asks for those gaps to be
surfaced. The calculation layer already answers these cases in a specific way — an unknown rate is
unknown rather than zero, a figure that covers only part of the work is flagged as partial rather
than presented as final, and cost that belongs to nobody nameable is reported rather than pushed
onto the colleagues whose salaries happen to be on record.

This story fixes that behaviour in place so a later change cannot quietly turn a gap into a
confident wrong number.

**Why this priority**: These paths are less likely to be disturbed than the core formulas, and a
regression here produces a misleading figure rather than a wrong headline total. Valuable, but
after the two above. It can ship on its own.

**Independent Test**: Run the verification command against a month where one person logged hours
with no salary row, and against a month where every logged category is internal. The results
distinguish "unknown" from "zero" in every case, and the reconciliation still balances.

**Acceptance Scenarios**:

1. **Given** an employee who logged hours in a month with no salary on record, **When** that
   month's figures are read, **Then** the employee's direct cost rate is reported as unknown rather
   than as zero, the month is flagged as having an incomplete cost pool, and the employee is named
   among those missing a salary.
2. **Given** that same month, **When** the cost of its rows is requested, **Then** a numeric cost
   covering the rows that could be costed is returned together with a flag stating the figure is
   partial — a single gap must not blank the whole period.
3. **Given** that same month, **When** the allocated cost is added to the share of the pool that
   fell on hours with no known rate, **Then** the sum still equals the known salaries plus the
   overhead figure — confirming the unattributable cost is reported rather than absorbed by other
   employees.
4. **Given** a month in which every logged category is internal time, **When** the month's figures
   are read, **Then** the indirect cost rate is reported as unknown rather than as zero or as an
   error, the cost of any individual row is unknown, and the indirect cost pool is greater than
   zero — the cost exists but cannot be allocated to any project.

---

### Edge Cases

- **A rate that is genuinely zero.** An employee on a zero salary has a direct rate of zero, which
  is a real rate and must not be confused with an unknown one. The suite must confirm that unknown
  and zero remain distinguishable.
- **A month with salaries but no timesheet rows.** The whole salary bill is indirect and cannot be
  allocated; the reconciliation must still balance.
- **A denominator of zero.** Productivity for someone with no logged hours, or a margin against zero
  revenue, must be reported as unknown rather than producing an error or a misleading zero.
- **Floating-point accumulation.** The reconciliation compares two sums built by different routes,
  so the comparison must allow the sub-hundredth-of-a-dirham difference that binary floating point
  produces, while still failing on a real discrepancy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a single documented command that runs the verification
  suite and reports a pass or fail result.
- **FR-002**: The suite MUST verify that, with the overhead figure at zero, total cost equals total
  salaries for a period containing billable hours, non-billable hours, and a support employee who
  logged no hours.
- **FR-003**: The suite MUST verify that the same equality holds across two months whose salaries
  and hours differ, confirming that each month is costed at its own rates.
- **FR-004**: The suite MUST verify that a non-zero monthly overhead figure raises total cost by
  exactly that figure per month.
- **FR-005**: The suite MUST verify that an employee's direct cost rate is that month's salary
  divided by that month's total logged hours, using data where total and billable hours differ.
- **FR-006**: The suite MUST verify the composition of the indirect cost pool — support-staff
  salaries, non-billable time at its owner's direct rate, and the overhead figure — and that the
  indirect cost rate is that pool divided by the month's billable hours.
- **FR-007**: The suite MUST verify that an employee who logged hours with no salary row produces
  an unknown direct rate, an incomplete-pool flag, and a named entry in the missing-salary list.
- **FR-008**: The suite MUST verify that a cost figure covering an incomplete period is returned as
  a number accompanied by a partial flag, rather than as an absent value.
- **FR-009**: The suite MUST verify that allocated cost plus unattributable indirect cost equals
  known salaries plus overhead even when a salary is missing.
- **FR-010**: The suite MUST verify that a month with no billable hours yields an unknown indirect
  rate and an unknown per-row cost, while still holding a non-zero indirect pool.
- **FR-011**: The suite MUST verify that billable-category matching ignores letter case and treats
  an unlisted category as internal time.
- **FR-012**: The suite MUST verify that a ratio against a zero or unknown denominator is reported
  as unknown, and that a negative result is preserved rather than clamped.
- **FR-013**: The suite MUST cover the calculation layer only. Spreadsheet parsing, HTTP endpoints,
  persistence, and the frontend are explicitly out of scope for this feature.
- **FR-014**: The suite MUST run without a database, without network access, and without loading any
  spreadsheet file, so that it passes from a clean checkout.
- **FR-015**: The README MUST state how to run the suite and MUST record the decision to limit
  coverage to the calculation layer, so the scope is a stated choice rather than an omission.

### Key Entities

- **Timesheet row**: One person's logged hours for one task in one month, carrying the category that
  decides whether the time is billable and the reference code that joins it to a project.
- **Salary record**: One person's pay for one calendar month. Its absence means "unknown", which is
  distinct from a recorded pay of zero.
- **Assumption set**: The list of categories that count as billable, plus the monthly overhead
  figure — the two inputs the operator can change without editing code.
- **Month model**: Everything derived for one calendar month — each person's direct cost rate, the
  indirect cost pool and rate, and the flags saying whether those figures are complete.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can confirm the reconciliation guarantee in under one minute from a clean
  checkout, using one documented command and reading only its pass/fail output.
- **SC-002**: The suite covers all nine behaviours named in the functional requirements, with every
  expected figure derived from the assessment's stated formulas rather than from the current
  output of the code.
- **SC-003**: Introducing a double count into the cost calculation causes at least one check to
  fail; the suite never reports success on a calculation layer that fails the assessment's own
  self-check.
- **SC-004**: The suite completes in under five seconds, so it can be run on every change without
  becoming something a developer skips.
- **SC-005**: The suite passes on a machine with no database file, no network connection, and no
  spreadsheet data loaded.
- **SC-006**: The whole feature adds no more than one new development dependency to the repository.

## Assumptions

- The calculation layer is already written as functions over plain data, with no framework or
  database dependency, so it can be exercised directly with inline fixtures. This is the current
  state of the code and is a precondition for the five-second and no-database criteria.
- Test data is written inline in the suite rather than read from the supplied workbooks. Fixtures
  small enough to check by hand are what make an expected figure independently verifiable; the real
  workbooks would only prove the code agrees with itself.
- Nine cases is the intended ceiling, not a starting point. The assessment asks for tests "where
  they earn their keep", and the calculation layer is where they do; broader coverage is a
  deliberate omission recorded in the README, not an unfinished task.
- The reconciliation comparison uses a tolerance below one hundredth of a dirham. The assessment's
  "to the dirham" standard is met by any tolerance at or under that, and a tolerance is required
  because the two sides of the comparison are accumulated in different orders.
- Revenue allocation and employee profitability are not covered by this feature. Those formulas
  currently live outside the calculation layer, and moving them would be a change to working code
  made solely to suit a test — which this feature does not undertake.
- This is an `apps/api` feature exclusively. No file in `apps/web` is touched, satisfying the
  one-side-per-spec principle.
