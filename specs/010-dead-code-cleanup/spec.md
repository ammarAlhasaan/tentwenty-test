# Feature Specification: Dead Code and Cruft Cleanup

**Feature Branch**: `010-dead-code-cleanup`

**Created**: 2026-09-10

**Status**: Draft

**Input**: A verified dead-code and cruft audit of the repository at `53d6327`, covering both
applications and the repository root. Every item below was confirmed by searching the whole
repository rather than inferred.

## Overview

This is a maintenance specification. It removes code, configuration, dependencies and stylesheet
tokens that nothing references, and corrects three places where two parts of the system disagree.
It adds no capability and changes no user-visible behaviour.

The repository is about to be delivered for review. Dead code costs a reviewer time and invites
questions the author cannot answer — an unused dependency reads as an abandoned approach, a prop
no caller passes reads as an unfinished feature, and a type describing an endpoint that does not
exist reads as a defect even when the running code is correct.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reviewer reads only live code (Priority: P1)

A reviewer opens the repository to evaluate it. Every symbol they encounter is reachable from
something that runs. Nothing they read turns out to be a dead branch, an unused prop, or a
dependency that was never adopted.

**Why this priority**: This is the bulk of the change and the reason for the spec. Dead code is
the single largest source of misleading signal in the current tree.

**Independent Test**: Run the unused-code analysis and the two linters against the tree. No
unused file, unused dependency, or unreachable export is reported except those explicitly
recorded as out of scope.

**Acceptance Scenarios**:

1. **Given** the cleaned tree, **When** an unused-code analysis is run across both applications,
   **Then** it reports no unused files and no unused dependencies other than the ones recorded in
   Out of Scope as verified load-bearing.
2. **Given** the cleaned tree, **When** both applications are type-checked and linted,
   **Then** both pass with no errors and no warnings.
3. **Given** the cleaned tree, **When** the cost-model test suite is run,
   **Then** all nine existing cases still pass without modification to the suite.

---

### User Story 2 - The declared API shape matches what the API sends (Priority: P1)

A developer reads the frontend's description of an endpoint's response and can trust it. The
fields it declares are the fields that arrive.

**Why this priority**: The import-history type currently declares two fields the endpoint never
sends and omits two it does. Both declared fields are optional, so the compiler cannot catch it.
This is the one item in the spec where the current code actively misleads.

**Independent Test**: Compare the frontend's import-history type against the endpoint's actual
return shape field by field; they match exactly.

**Acceptance Scenarios**:

1. **Given** the import-history endpoint, **When** its response shape is compared with the
   frontend type that describes it, **Then** every field matches in name and optionality.
2. **Given** the uploads page, **When** import history is displayed after the change,
   **Then** it renders the same information as before.

---

### User Story 3 - One rule for an unpriced project (Priority: P2)

A user uploads a timesheet for a project whose price is missing or zero. The warning they see at
upload time agrees with what the dashboard reports for the same project.

**Why this priority**: Real inconsistency, but narrow in effect — project upload already emits a
separate warning for a non-positive price, so the user is not left with no signal at all.

**Independent Test**: Import a timesheet with billable hours against a project recorded with a
zero price; the import warns about it, matching what the dashboard reports.

**Acceptance Scenarios**:

1. **Given** a project recorded with a price of zero or no price, **When** a timesheet carrying
   billable hours for that ref code is imported, **Then** the import reports the ref code as
   having billable hours and no price.
2. **Given** a project recorded with a positive price, **When** a timesheet for it is imported,
   **Then** no unpriced warning is reported for that ref code.

---

### Edge Cases

- A symbol that appears unused but is reached only by the test suite. `entryCost` is imported by
  the cost-model suite and MUST stay exported; every export considered for removal is checked
  against the suite before it is touched.
- A dependency that is never imported directly but is required at runtime. The Prisma client, the
  NestJS peer dependencies, and the Prisma CLI config are all in this category and are out of
  scope.
- A stylesheet token defined only inside the dark-theme block. The dark theme is out of scope, so
  a token removed from the light palette MUST also be removed from the dark block or the two
  blocks fall out of step.
- A shared helper adopted at one call site but not another, leaving two behaviours where there
  was one. Each consolidation MUST replace every duplicate, not just the most obvious one.

## Requirements *(mandatory)*

### Functional Requirements

**Removal of unreferenced code**

- **FR-001**: The repository MUST NOT contain source files that nothing imports. The `cn`
  re-export module is removed and the component generator's utility alias is repointed at the
  package it re-exported, so regenerating a component does not recreate the file.
- **FR-002**: The repository MUST NOT declare dependencies that no source file uses. The state
  management library and the animation stylesheet package are removed from the frontend, and the
  source-map shim is removed from the backend.
- **FR-003**: Stylesheet imports that contribute no used rule MUST be removed. Both the animation
  package's import and the component library's stylesheet import are removed; neither defines a
  base layer or root token the application depends on.
- **FR-004**: Component exports that nothing renders MUST be removed, together with any style
  rule that targets only the removed component.
- **FR-005**: Component props that no caller passes MUST be removed, together with any branch,
  attribute, or style rule that exists only to serve them. Where removing a prop makes a
  conditional trivially true or false, the conditional is simplified rather than left in place.
- **FR-006**: Style variants that no caller selects MUST be removed, together with rules
  targeting a component grouping that does not exist in this application.
- **FR-007**: Design tokens that no utility class references MUST be removed from every block
  that defines them, so the light and dark palettes stay in step.
- **FR-008**: Type declarations that nothing references MUST be removed.
- **FR-009**: A field computed for internal use only MUST NOT be returned to callers that never
  read it. The value stays as a local; the field leaves the returned object.

**Correctness of declared contracts**

- **FR-010**: The frontend's description of the import-history response MUST match what that
  endpoint returns, field for field. Fields the endpoint does not send are removed; fields it
  sends that nothing reads are not added.
- **FR-011**: The same warning code MUST be produced by the same rule everywhere it is raised. A
  project counts as priced only when it has a positive price, both at import time and on reports.
- **FR-012**: Local editor and tool settings MUST be excluded by the repository's own ignore
  rules rather than by a contributor's personal global configuration.

**Reduction of duplicated logic**

- **FR-013**: A period key MUST have one representation. The three month-key spellings collapse
  onto the existing shared helper, including the unpadded one.
- **FR-014**: Whether a category is billable MUST be decided by one helper. The two hand-built
  lookup sets are replaced by calls to it.
- **FR-015**: The period query string MUST be constructed in one place and reused, so the address
  bar and the data request cannot disagree.
- **FR-016**: A repeated shape MUST be declared once. The inline completeness shape is replaced
  by the named type declared alongside it.
- **FR-017**: A repeated visual element MUST have one implementation. The statistic card renders
  the existing share bar rather than a second copy of it.

**Configuration hygiene**

- **FR-018**: Compiler and linter configuration MUST NOT carry options for file kinds or tooling
  the repository does not use.
- **FR-019**: Scripts that duplicate another script exactly MUST be removed.
- **FR-020**: Ignore rules MUST NOT carry patterns for package managers and tooling this
  repository does not use.

**Comment discipline**

- **FR-021**: Comments describing removed code MUST be removed with it. No new explanatory
  comment is written for a deletion — the change is a removal and needs no narration.
- **FR-022**: A comment that misstates what the code does MUST be corrected. The rounding comment
  claiming a single rounding site is corrected to describe the three that exist.

**Preservation**

- **FR-023**: No user-visible behaviour may change, with the single exception of FR-011, which
  makes an existing warning fire in a case it currently misses.
- **FR-024**: Every export considered for removal MUST be checked against the test suite before
  it is removed.

### Key Entities

Not applicable — this specification removes code and changes no data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Unused-code analysis reports zero unused files and zero unused dependencies across
  both applications, other than the items listed in Out of Scope.
- **SC-002**: Both applications type-check with no errors, and both linters report no findings.
- **SC-003**: All nine cost-model test cases pass, with the test suite unmodified.
- **SC-004**: Both applications build successfully from the cleaned tree.
- **SC-005**: Every page the application serves renders the same content as before the change,
  with the exception of the import warning covered by FR-011.
- **SC-006**: The number of dependencies declared across both applications decreases by three,
  and no dependency is added.
- **SC-007**: A reviewer searching for any symbol that remains in the tree finds at least one
  place that reaches it.

## Out of Scope

Each item below was examined during the audit and deliberately excluded.

**Pending an owner decision** — these are judgement calls, not cleanup:

- The dark theme. It is fully written and currently unreachable, because the variant it depends on
  keys off a class nothing sets. Wiring it up or removing it is a design decision.
- The vendored agent-tooling directories. Roughly forty percent of tracked files, and whether they
  belong in the delivered repository is the owner's call.
- Nine backend response fields that no frontend code reads. Removing them is defensible, but they
  are a contract decision rather than dead code.
- The spec numbering gap at 007 and the default application icon.

**Verified load-bearing despite appearing unused** — these MUST NOT be removed:

- The reactive-extensions and metadata-reflection packages, both declared peer dependencies of the
  backend framework; removing either breaks dependency injection at runtime.
- The database client package, which has no direct import but supplies the runtime the generated
  client loads.
- The `Employee` model, written and never read, but required for foreign-key integrity.
- The health endpoint, an intentional public liveness probe with no frontend caller.
- The database CLI configuration file, confirmed loaded by running the migration status command.

**Excluded by the constitution**:

- Adding repository-root `lint` and `test` scripts. The audit recommended both, but Repository
  Boundaries states that root scripts stay minimal (`dev`, `build`). Adding them requires a
  constitution amendment in its own change, which is outside this spec.

## Assumptions

- The audit's findings remain accurate at `53d6327`; each is re-verified at implementation time
  rather than trusted from the report.
- Removing the state-management dependency does not invalidate the governing rule about it. The
  rule in `AGENTS.md` is reworded as forward-looking guidance rather than deleted, and the
  constitution's equivalent clause is left untouched — amending it requires its own change.
- The component generator is expected to keep working after the utility alias is repointed; this
  is verified by inspection of the generator's configuration, not by running it.
- No consumer outside this repository imports any symbol removed here. Both applications are
  private and have no published package.
