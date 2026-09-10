# Tasks: Dead Code and Cruft Cleanup

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Branch**: `010-dead-code-cleanup`

**Worktree**: `/Users/ammaralhasan/Documents/claude-worktree/tentwenty-test/dead-code-cleanup`

All paths below are relative to the worktree root. All commands run there.

**Tests**: no new tests. The nine existing cost-model cases are the regression gate and are not
modified. Test tasks below run the existing suite; they do not write one.

**Comment discipline**: no task adds an explanatory comment. Comments describing removed code are
removed with it (FR-021). One comment that misstates the code is corrected (FR-022).

---

## Phase 1: Setup

- [X] T001 Confirm the worktree is on `010-dead-code-cleanup` with a clean tree, and that
  `.specify/feature.json` points at `specs/010-dead-code-cleanup`
- [X] T002 Install dependencies with `pnpm install --frozen-lockfile` and record that the lockfile
  is unchanged before any work begins
- [X] T003 Capture the baseline: run `pnpm --filter api test`, both typechecks, both linters, and
  `npx knip@latest --no-progress`, and save the output for comparison at the end

---

## Phase 2: Foundational

**Blocking**: every removal below depends on T004. The audit was produced at `53d6327`; the test
suite landed in that range and changed which exports are reachable.

- [X] T004 Re-verify each removal candidate against the current tree. For every symbol named in
  Phase 3–5, search `apps/` excluding `node_modules`, `.next`, `dist` and
  `apps/api/src/generated`, and confirm the only hits are its own declaration. Search
  `apps/api/src/analytics/cost-model.spec.ts` separately. Record any candidate the suite reaches —
  `entryCost` is known to be one and MUST stay exported

---

## Phase 3: User Story 1 — A reviewer reads only live code (P1)

**Goal**: no symbol, dependency, prop, variant or token remains that nothing reaches.

**Independent test**: `npx knip@latest --no-progress` reports no unused file and no unused
dependency other than the two documented false positives; both typechecks and both linters pass.

### Pass 1 — Backend logic

- [X] T005 [P] [US1] Delete `export type Env` from `apps/api/src/config.ts`
- [X] T006 [US1] Remove the `revenueComplete` field from the object returned by `totalsFor()` in
  `apps/api/src/analytics/analytics.service.ts`, keeping the local variable that feeds `whole`
- [X] T007 [US1] Replace the local lowercase billable-category `Set` in
  `apps/api/src/settings/settings.service.ts` with a call to the exported `isBillable` helper from
  `apps/api/src/analytics/cost-model.ts`
- [X] T008 [US1] Replace the local lowercase billable-category `Set` in `timesheetWarnings()` in
  `apps/api/src/imports/imports.service.ts` with a call to the same `isBillable` helper
- [X] T009 [US1] Replace the unpadded month key in `apps/api/src/imports/parse-timesheet.ts` with
  the exported `monthKey` helper from `apps/api/src/analytics/cost-model.ts`
- [X] T010 [US1] Delete the duplicate `monthName()` in `apps/api/src/imports/parse-salaries.ts` and
  call `monthKey` instead
- [X] T011 [US1] Narrow the `export` keyword on backend symbols confirmed module-private by T004,
  in `apps/api/src/imports/parse-workbook.ts`, `parse-projects.ts`, `parse-salaries.ts`,
  `parse-timesheet.ts` and `apps/api/src/analytics/cost-model.ts`. Leave `entryCost` exported
- [X] T012 [US1] Correct the comment above `round2` in
  `apps/api/src/analytics/analytics.service.ts` so it no longer claims to be the only rounding
  site; `hours2` and `round4` sit beside it
- [X] T013 [US1] **Gate**: run `pnpm --filter api test` (expect 9 passed),
  `pnpm --filter api exec tsc --noEmit`, and `pnpm --filter api lint`

### Pass 2 — Frontend components

- [X] T014 [US1] In `apps/web/components/ui/card.tsx`, delete `CardFooter`, `CardAction` and
  `CardDescription`, their entries in the export list, and the style rules that target only them:
  `has-data-[slot=card-footer]:pb-0` on `Card`, and `has-data-[slot=card-action]:grid-cols-[1fr_auto]`
  plus `has-data-[slot=card-description]:grid-rows-[auto_auto]` on `CardHeader`
- [X] T015 [US1] In the same file, delete the `size` prop from `Card`, its `data-size` attribute,
  both `data-[size=sm]` rules on `Card`, and `group-data-[size=sm]/card:text-sm` on `CardTitle`
- [X] T016 [US1] In `apps/web/components/ui/button.tsx`, delete the `secondary`, `destructive` and
  `link` variants, the `xs`, `icon`, `icon-xs` and `icon-sm` sizes, and every
  `in-data-[slot=button-group]:rounded-lg` rule. Keep `default`, `outline`, `ghost`, `sm`, `lg`
  and `icon-lg`, and keep the `aria-invalid` rules in the base string
- [X] T017 [P] [US1] Delete the `className` prop from `TableScroller` in
  `apps/web/components/ui/table.tsx` and collapse the `cn()` call to the literal class string
- [X] T018 [P] [US1] Delete the `disabled` prop from `PeriodFilter` in
  `apps/web/components/period-filter.tsx` and simplify the year select's guard to
  `years.length === 0`
- [X] T019 [US1] Add `role="presentation"` to the outer element of `ShareBar` in
  `apps/web/components/pill.tsx`, then have `StatCard` in `apps/web/components/stat-card.tsx`
  render `<ShareBar value={share} />` instead of its own copy of the bar
- [X] T020 [US1] **Gate**: run `pnpm --filter web exec tsc --noEmit` and `pnpm --filter web lint`

### Pass 3 — Frontend stylesheet

- [X] T021 [US1] Delete the `@import "tw-animate-css"` and `@import "shadcn/tailwind.css"` lines
  from `apps/web/app/globals.css`, keeping `@import "tailwindcss"`
- [X] T022 [US1] Delete the chart tokens from all three blocks in the same file: the five
  `--color-chart-*` mappings in `@theme`, the five `--chart-*` values in `:root`, and the five in
  `.dark`
- [X] T023 [US1] Delete the sidebar tokens from all three blocks: the eight `--color-sidebar-*`
  mappings in `@theme`, the eight `--sidebar-*` values in `:root`, and the eight in `.dark`
- [X] T024 [US1] Delete the popover and accent tokens from all three blocks:
  `--color-popover`, `--color-popover-foreground`, `--color-accent`, `--color-accent-foreground`
  in `@theme`, and the matching `--popover*` and `--accent*` values in `:root` and `.dark`
- [X] T025 [US1] Delete `--radius-sm`, `--radius-3xl` and `--radius-4xl` from `@theme`. Keep
  `--radius-md`, which the button size variants reference, and `--radius-lg`, `--radius-xl`,
  `--radius-2xl`
- [X] T026 [US1] Delete the `--secondary` and `--secondary-foreground` tokens from all three
  blocks, now stranded by the removed button variant, and `--muted-foreground` likewise, stranded
  by the removed `CardDescription`. Keep `--muted`, used by the skeleton, the root loading state
  and the ghost button. Keep `--destructive`, referenced by the surviving `aria-invalid` rules
- [X] T027 [US1] **Gate**: run `pnpm --filter web exec tsc --noEmit`, `pnpm --filter web lint`,
  and `pnpm --filter web build` — the build is the only check that compiles the stylesheet

### Pass 4 — Frontend library modules

- [X] T028 [US1] Delete `apps/web/lib/utils.ts` and repoint `aliases.utils` in
  `apps/web/components.json` from `@/lib/utils` to `cn`
- [X] T029 [P] [US1] Replace the inline completeness shape inside `DashboardResponse` in
  `apps/web/lib/analytics.ts` with the named `Completeness` type declared below it
- [X] T030 [US1] Consolidate the duplicated period query-string construction: export the existing
  builder from `apps/web/lib/analytics.ts` and have the `go` helper in
  `apps/web/components/period-scope.tsx` use it, so the address bar and the data request cannot
  disagree
- [X] T031 [US1] Narrow the `export` keyword on frontend symbols confirmed module-private by T004
  in `apps/web/lib/api.ts`, `auth.ts`, `session.ts`, `settings.ts`, `imports.ts` and
  `apps/web/components/period-filter.tsx`. Keep the response types exported — they document the
  API contract — and keep anything T030 newly requires to be exported
- [X] T032 [US1] **Gate**: run `pnpm --filter web exec tsc --noEmit` and `pnpm --filter web lint`

---

## Phase 4: User Story 2 — The declared API shape matches what the API sends (P1)

**Goal**: the frontend's import-history type matches the endpoint field for field.

**Independent test**: compare the type against
[contracts/import-history.md](contracts/import-history.md); every field agrees in name and
optionality.

- [X] T033 [US2] Delete `rowsSkipped?: number` and `warnings?: { code: string; message: string }[]`
  from `ImportHistoryResponse` in `apps/web/lib/imports.ts`. Do not add `warningCount` or
  `loaded` — nothing reads them. Leave `ImportResult` alone; its `rowsSkipped` and `warnings` are
  real and rendered
- [X] T034 [US2] Confirm no component reads either removed field. `rowsSkipped` is read in
  `apps/web/components/data/upload-card.tsx`, but from `ImportResult`, not from a history row —
  verify that distinction before and after the change
- [X] T035 [US2] **Gate**: run `pnpm --filter web exec tsc --noEmit` and `pnpm --filter web lint`

---

## Phase 5: User Story 3 — One rule for an unpriced project (P2)

**Goal**: the same warning code is produced by the same predicate everywhere.

**Independent test**: a project row with a null or zero price and billable timesheet hours is
reported at import time, matching what the dashboard already reports.

- [X] T036 [US3] In `timesheetWarnings()` in `apps/api/src/imports/imports.service.ts`, select
  `price` alongside `refCode` and treat a project as priced only when its price is non-null and
  above zero, matching `analytics.service.ts`. Rename the local so it no longer says `priced`
  while holding every known ref code
- [X] T037 [US3] **Gate**: run `pnpm --filter api test` (expect 9 passed),
  `pnpm --filter api exec tsc --noEmit`, and `pnpm --filter api lint`

---

## Phase 6: Polish and configuration

**Ordering constraint**: dependency removal must follow every source change above, or the
intermediate tree will not build.

- [X] T038 [P] Remove `zustand` and `tw-animate-css` from `apps/web/package.json`
- [X] T039 [P] Remove `source-map-support` from `apps/api/package.json`, and remove the
  `start:dev` script, which is byte-identical to `dev`
- [X] T040 Run `pnpm install` and confirm the lockfile change is limited to the three removed
  packages
- [X] T041 [P] Remove `allowJs` and the `"**/*.mts"` include from `apps/web/tsconfig.json`
- [X] T042 [P] Remove the no-op `globalIgnores` block from `apps/web/eslint.config.mjs`, which
  re-lists the defaults it claims to override
- [X] T043 [P] Remove the `create-next-app` placeholder comment from `apps/web/next.config.ts`
- [X] T044 Add `.claude/settings.local.json` to `.gitignore`, and remove the Yarn PnP block and
  the `coverage` pattern — neither package manager nor coverage tooling is used here
- [X] T045 Reword the Zustand paragraph in `AGENTS.md` as conditional guidance, since the
  dependency is gone. Leave the equivalent clause in `.specify/memory/constitution.md` untouched —
  amending it requires its own change, per Governance
- [X] T046 Do **not** add root `lint` or `test` scripts. Repository Boundaries fixes root scripts
  at `dev` and `build`; this is recorded in the spec's Out of Scope and the plan's Complexity
  Tracking

---

## Phase 7: Final verification

Every gate below must be executed and its real output reported (Principle VIII). A gate that was
skipped or failed is reported as such.

- [X] T047 Run `pnpm --filter api test` — expect `Test Files 1 passed (1)`, `Tests 9 passed (9)`
- [X] T048 [P] Run `pnpm --filter api exec tsc --noEmit` and `pnpm --filter web exec tsc --noEmit`
  — expect no output from either
- [X] T049 [P] Run `pnpm --filter api lint` and `pnpm --filter web lint` — expect no findings
- [X] T050 Run `pnpm --filter api build` and `pnpm --filter web build` — expect both to succeed
- [X] T051 Run `npx knip@latest --no-progress` and compare against the T003 baseline. Expect every
  previously reported entry to be gone except `@prisma/client` and `prisma7.config.ts`, both
  documented in [research.md](research.md) as verified false positives
- [X] T052 Start both applications with `pnpm dev`, sign in, and confirm every page renders as
  before: Dashboard, Projects, a project detail page, Departments, Productivity, Categories,
  Assumptions, Uploads. Check the three places the change touches directly — the import history
  table, the dashboard statistic cards' share bars, and the period filter with a single year
- [X] T053 Verify FR-011 per [quickstart.md](quickstart.md) Gate 7. If the sample data holds no
  ref code with billable hours and a null or zero price, verify by reading both predicates and
  report it as a read rather than a run
- [X] T054 Review the full diff for any comment that describes removed code, and for any comment
  added by this change. There should be none of either, beyond the correction in T012

---

## Dependencies

```text
Phase 1 (Setup)
  └─> Phase 2 (T004 re-verification) ── blocks everything
        ├─> Phase 3 Pass 1 (T005–T013)  backend logic
        │     └─> Phase 5 (T036–T037)   same file as T008; sequential
        ├─> Phase 3 Pass 2 (T014–T020)  components
        │     └─> Phase 3 Pass 3 (T021–T027)  stylesheet — tokens stranded by Pass 2
        ├─> Phase 3 Pass 4 (T028–T032)  lib modules
        └─> Phase 4 (T033–T035)         contract — same file as T031
              └─> Phase 6 (T038–T046)   config and dependencies, last
                    └─> Phase 7 (T047–T054)  final verification
```

**Hard ordering**:

- T004 before every removal. The audit predates the test suite.
- Pass 2 before Pass 3. `--secondary` and `--muted-foreground` only become dead once the button
  variant and `CardDescription` are gone.
- T008 before T036. Both edit `timesheetWarnings()`.
- T031 before T033. Both edit `apps/web/lib/imports.ts`.
- Phase 6 after all source changes. Removing a dependency still imported leaves the tree broken.
- T040 after T038 and T039.

## Parallel opportunities

Within a pass, tasks marked `[P]` touch different files and can run together:

- **Pass 1**: T005 (`config.ts`) is independent of T006–T012.
- **Pass 2**: T017 (`table.tsx`) and T018 (`period-filter.tsx`) are independent of each other and
  of the card and button work.
- **Pass 4**: T029 (`analytics.ts` type) is independent of T028.
- **Phase 6**: T038, T039, T041, T042, T043 all touch different files.
- **Phase 7**: T048 and T049 each run two independent commands.

Passes themselves are deliberately **not** parallel. Each ends with a gate so a regression is
attributed to the pass that caused it.

## Implementation strategy

**MVP scope**: Phase 3 Pass 1 alone is a coherent, shippable increment — it closes the backend half
of User Story 1 and leaves the tree green. Every later pass is additive.

**Incremental delivery**: each pass ends green. If work stops after any gate, the branch is
mergeable and the remaining passes are recorded here as unstarted.

**Highest risk first**: Pass 1 carries the only behavioural change in the spec and the only code
covered by tests, so it runs while the tree is otherwise untouched and a failure is
unambiguous.

## Task count

| Phase | Tasks | Story |
|---|---|---|
| 1 Setup | 3 | — |
| 2 Foundational | 1 | — |
| 3 Dead code removal | 28 | US1 |
| 4 Contract alignment | 3 | US2 |
| 5 Unpriced predicate | 2 | US3 |
| 6 Polish and configuration | 9 | — |
| 7 Final verification | 8 | — |
| **Total** | **54** | |

---

## Implementation results

All 54 tasks completed on `010-dead-code-cleanup`. Every gate below was executed; the output
quoted is real (Principle VIII).

### Gate results

| Gate | Command | Result |
|---|---|---|
| Tests | `vitest run` | `Test Files 1 passed (1)` · `Tests 9 passed (9)` |
| Typecheck (api) | `tsc --noEmit` | exit 0, no output |
| Typecheck (web) | `tsc --noEmit` | exit 0, no output |
| Lint (api) | `oxlint src/` | exit 0, no findings |
| Lint (web) | `eslint .` | exit 0, no findings |
| Build (api) | `nest build` | exit 0 |
| Build (web) | `next build` | exit 0, 11 routes |
| Unused code | `knip` | 32 findings → 6, all documented keeps |

### Deviations from the task list

Four corrections were made during T004 re-verification, all recorded rather than silently applied:

1. **`SalaryRecord` also stays exported.** The task list named only `entryCost` as reached by the
   test suite. `SalaryRecord` is imported by it too and was excluded from narrowing.
2. **The api's `ProjectRow` was narrowable after all.** Its apparent external references are the
   frontend's own separate `ProjectRow`, which is correct duplication under Principle IV.
3. **T036's rename was unnecessary.** Once the predicate was corrected, the local named `priced`
   genuinely holds priced ref codes, so the name became accurate on its own.
4. **`allowJs` was left in place.** Removing it produces permanent diff noise: `next build`
   rewrites `tsconfig.json` and re-adds it, the same way `next dev` maintains
   `apps/web/AGENTS.md`. Only the `**/*.mts` include was removed. Recorded here rather than
   dropped from T041 without explanation.

Six further exports were narrowed beyond the task list, all confirmed module-private by the same
method: `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`, `DEVELOPMENT_SESSION_SECRET`, the api's
`ImportKind`, `importKeys`, and the unused `authKeys` / `AuthUser` re-exports in `lib/auth.ts`.

### Remaining knip output, all deliberate

- `prisma7.config.ts` and `@prisma/client` — verified false positives, see [research.md](research.md).
- `shadcn` — newly surfaced by removing its stylesheet import. It is the CLI, still needed for
  `shadcn add`, and `components.json` exists for it. Keep.
- `PeriodDescriptor`, `ProjectRow`, `DepartmentEmployee` — response contract types, deliberately
  left exported per [plan.md](plan.md).

### FR-011 verified end to end

Sample data holds no project with a null or zero price, so the case was constructed rather than
falling back to reading the predicates:

1. Set `Q2025001a` to `price = 0`, re-imported the timesheet →
   `project_without_price - Ref code Q2025001a has 3025.20 billable hours and no price on record.`
   Before this change the import was silent, because a project row existed.
2. The dashboard reported the same ref code in the same state →
   `Q2025001a has billable hours in this period and no usable price, so its revenue is unknown.`
3. Restored the price and re-imported → no warning. The two predicates now agree in both
   directions.

### T052 — every page rendered

Signed in and walked all eight pages against the branch: Dashboard, Projects, project detail,
Departments, Productivity, Categories, Assumptions, Uploads. Figures match `main` exactly
(profit AED 2,612,000, margin +52.1%, 19,815.2 total hours, 15,265.6 billable).

Three checks on what the change touched directly:

- **Import history** renders `File · Uploaded · Accepted · Periods replaced` — exactly the fields
  the endpoint sends. The removed type fields were never rendered.
- **Statistic card share bars** render correctly at 77.0%, now via the shared `ShareBar`.
- **Period filter** behaves as before with the `disabled` prop gone.

One observation worth recording: a full page load of a deep route while a second API instance was
running on the same host intermittently left the auth gate pending. This was reproduced on
unmodified `main` and is a session-cookie collision between two stacks on `localhost` — cookies
are not port-scoped. It is **not** caused by this change, and does not occur with one stack
running.
