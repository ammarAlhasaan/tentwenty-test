# Phase 0 Research: Dead Code and Cruft Cleanup

## Dependency research

**Not applicable.** This change adds no dependency. Constitution Principle VII requires official
documentation to be checked before a dependency is added; nothing is added, so there is nothing to
check. Three dependencies are removed, and the evidence for each removal is recorded below.

## Findings

### Decision: remove `zustand`, `tw-animate-css` and `source-map-support`

**Rationale**: none has an import site.

- `zustand` — a repository-wide search for the package name returns no hit in any source file. The
  two components holding shared UI state use React's own state hook. The governing rule about it
  is kept as forward-looking guidance.
- `tw-animate-css` — imported by the stylesheet, but none of its utilities appear in any
  component. The only animation in the application is Tailwind's own pulse utility, used by the
  skeleton and the root loading state.
- `source-map-support` — no import, no `--require` flag in any script, no entry in the Nest CLI
  configuration. Node 24 resolves source maps natively.

**Alternatives considered**: keeping `zustand` on the grounds that the governing rule names it.
Rejected — the rule describes how the library must be used *if* introduced; it does not require it
to be installed, and an installed-but-unused dependency is exactly what Principle II forbids.

---

### Decision: keep `@prisma/client`, `rxjs`, `reflect-metadata` and `prisma7.config.ts`

**Rationale**: unused-code analysis flags all four, and all four are load-bearing.

- `@prisma/client` has no direct import in application code, but the generated client imports its
  runtime. Removing it breaks every query.
- `rxjs` and `reflect-metadata` are declared peer dependencies of the NestJS packages. The
  compiler options that make constructor injection work depend on the latter.
- `prisma7.config.ts` looks orphaned but is genuinely loaded. Running the migration status command
  prints `Loaded Prisma config from prisma7.config.ts`.

**Alternatives considered**: trusting the analysis output. Rejected — the tool has no model of
peer dependencies, runtime-only imports, or CLI config discovery. Each flagged item was checked by
hand and two of the six turned out to be false positives.

---

### Decision: align the frontend import-history type with what the endpoint returns

**Rationale**: the type declares two fields the endpoint never sends and omits two it does. Both
declared fields are optional, so the compiler accepts the mismatch silently and the page renders
`undefined` for them.

Aligning means removing the two phantom fields. The two real fields the endpoint sends but nothing
reads are *not* added — adding them would declare surface with no consumer, which is the same
defect in the other direction. Whether the endpoint should keep sending them is a separate
decision, recorded in the spec's Out of Scope.

**Alternatives considered**: changing the endpoint to send what the type declares. Rejected — the
endpoint's shape is what the page actually renders today; the type is the side that is wrong.

---

### Decision: make the import-time unpriced check use the report-time predicate

**Rationale**: the same warning code is currently produced by two different rules. At import time
a project counts as priced if a row exists for its ref code; on reports it counts as priced only
if its price is above zero. A project loaded with a null or zero price — a case the parser
deliberately accepts rather than rejects — therefore passes the import check and then shows a
standing gap on every report.

The report-time predicate is the correct one, because it is the one that decides whether revenue
can be computed. The import-time check is brought into line with it.

**Alternatives considered**:

- Loosening the report-time check to match import time. Rejected — it would report revenue as
  complete for projects whose revenue is genuinely unknown, which is the opposite of the
  application's stated position on incomplete data.
- Leaving both and documenting the difference. Rejected — two rules behind one warning code is a
  defect, not a documented behaviour.

The blast radius is smaller than it first appears: project upload already emits a separate
non-positive-price warning, so the user is not currently left with no signal at all. This change
makes the timesheet-side warning agree with the dashboard.

---

### Decision: verify every export candidate against the test suite before narrowing it

**Rationale**: the audit's export-narrowing list was produced against a tree that had no tests.
The suite landed afterwards and imports `entryCost`, which appears on that list. Narrowing it
would break the build.

Every remaining candidate is re-checked against the suite immediately before it is touched, rather
than trusted from the report.

**Alternatives considered**: narrowing the whole list and letting the typecheck catch the
breakage. Rejected — it works, but it produces a failing intermediate state and teaches nothing
about which other symbols the suite reaches.

---

### Decision: remove each dead token from all three blocks that declare it

**Rationale**: every token in the stylesheet is declared in the theme block, in the light palette,
and again in the dark palette. Removing it from one leaves the others defining a token nothing
maps, which is worse than leaving all three.

The dark theme is out of scope as a feature — whether to wire it up or delete it is an owner
decision. Keeping its palette in step with the light one is not the same question and is in scope.

**Alternatives considered**: removing only the theme-block mapping and leaving the raw values.
Rejected — the raw values are the larger part of the dead weight and would be left orphaned.
