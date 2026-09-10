---

description: "Task list for the Cost Model Verification Suite"
---

# Tasks: Cost Model Verification Suite

**Input**: Design documents from `/specs/009-cost-model-tests/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: This feature *is* a test suite. The usual "tests are optional" note is inverted here —
the test cases are the deliverable, so they appear as implementation tasks in their story phases,
not as a separate optional block. The verification tasks that prove the suite works (running it,
and deliberately breaking the cost model to confirm it fails) are the checkpoints.

**Organization**: Grouped by the three user stories in [spec.md](./spec.md), in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

**A note on `[P]` in this feature**: all nine cases live in the single file
`apps/api/src/analytics/cost-model.spec.ts`, so they are **not** parallelisable with each other —
two agents editing one file conflict. `[P]` appears only where tasks genuinely touch different
files. This is a real constraint of the chosen structure, not an oversight; the alternative (one
file per case) would be the speculative structure Principle II forbids.

## Path Conventions

pnpm workspace monorepo. This feature is confined to `apps/api/` (Principle V). Paths below are
relative to the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get the branch, the dependency, and the command in place.

- [X] T001 Create the implementation worktree on branch `009-cost-model-tests` at `/Users/ammaralhasan/Documents/claude-worktree/tentwenty-test/cost-model-tests`, branched from `main`, per Principle VI (each spec implemented in its own worktree on its own branch). All later tasks operate inside that worktree.
- [X] T002 Add `vitest` at version `5.0.0` to `devDependencies` in `apps/api/package.json` via `pnpm add -D vitest` run from `apps/api`. Do not add a `vitest.config.ts` — research R1 verified the zero-config default works. Do not pass `--force` or `--legacy-peer-deps`; if a peer conflict appears, stop and report it (Principle VII).
- [X] T003 Add `"test": "vitest run"` to the `scripts` block in `apps/api/package.json`, placed after `"start:prod"` to keep run-commands grouped. This delivers FR-001. Same file as T002, so not parallel with it.

**Checkpoint**: `cd apps/api && pnpm test` runs and reports "No test files found" — the command exists and the runner starts.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one file and the two fixture helpers every case builds on.

**⚠️ CRITICAL**: No case can be written until T004 is complete.

- [X] T004 Create `apps/api/src/analytics/cost-model.spec.ts` with: the `describe`/`it`/`expect` import from `vitest`; the imports of `buildMonthModels`, `costOf`, `entryCost`, `uncostedIndirect`, `isBillable`, `ratio` and the `Assumptions`/`Entry`/`SalaryRecord` types from `./cost-model.js` (the `.js` specifier is required — see research R2); and the two local fixture helpers described in [data-model.md](./data-model.md) §1: `entry(employeeNo, category, hours, month = 1)` returning a complete `Entry` with fixed filler values for `employeeName`, `department` and `refCode`, and `salary(employeeNo, amount, month = 1)` returning a complete `SalaryRecord` with `year: 2025`. Both helpers stay local to this file — no shared factory module (Principle II, research R4).

**Checkpoint**: The file compiles and `pnpm test` reports zero tests in one file.

---

## Phase 3: User Story 1 - The reconciliation guarantee is proven, not asserted (Priority: P1) 🎯 MVP

**Goal**: Make the assessment's own self-check executable — total cost equals total salaries when
overhead is zero, and the overhead is counted exactly once when it is not.

**Independent Test**: Run `cd apps/api && pnpm test`. Three cases pass. Then apply the deliberate
double-count from [quickstart.md](./quickstart.md) V2 and confirm all three fail.

### Implementation for User Story 1

- [X] T005 [US1] Add Fixture A to `apps/api/src/analytics/cost-model.spec.ts` exactly as derived in [data-model.md](./data-model.md) §3: month `2025-01`, `billableCategories: ['Projects']`, employee `E1` (salary 18,000; 100 h `Projects` + 60 h `FC - Meetings`), `E2` (salary 12,000; 100 h `Projects`), `E3` (salary 20,000; no entries). Then write case 1 — with `monthlyOverhead: 0`, `costOf(entries, buildMonthModels(entries, salaries, assumptions), assumptions).cost` equals **50000** via `toBeCloseTo(50000, 2)`, and that figure equals the sum of the three salaries. Delivers FR-002.
- [X] T006 [US1] Add Fixture B and case 2 to the same file, per [data-model.md](./data-model.md) §4: reuse Fixture A as month 1 and add month `2025-02` with salaries 18,500 / 12,500 / 20,500 and hours `E1` 80 billable + 40 non-billable, `E2` 150 billable, `E3` none. Assert total cost across both months is **101500** via `toBeCloseTo(101500, 2)`. Name the case so it states what it pins: each month is costed at its own rates, not a blend. Delivers FR-003.
- [X] T007 [US1] Add case 3 to the same file: Fixture A with `monthlyOverhead: 12000`, asserting total cost is **62000** via `toBeCloseTo(62000, 2)` — exactly 50,000 + 12,000. Add a one-line comment recording that a per-employee or per-row overhead would give 74,000, since that is the failure mode the case exists to catch and it is not visible from the numbers alone (Principle III). Delivers FR-004.
- [X] T008 [US1] Run `cd apps/api && pnpm test` and confirm 3 passing tests in 1 file. Record the real output (Principle VIII).
- [X] T009 [US1] Perform validation V2 from [quickstart.md](./quickstart.md): temporarily change `pool += hours.nonBillable * rate` to `pool += hours.nonBillable * rate * 2` in `apps/api/src/analytics/cost-model.ts`, run `pnpm test`, confirm cases 1–3 **fail**, then revert the edit and confirm they pass again. Record both outputs. A suite that cannot fail is not evidence (SC-003).

**Checkpoint**: The single highest-weighted guarantee in the assessment is now executable and proven to be load-bearing. This is a complete, shippable MVP on its own.

---

## Phase 4: User Story 2 - Each formula is pinned to its stated definition (Priority: P2)

**Goal**: Pin the individual formulas, so a wrong denominator is caught at the formula rather than
only when the aggregate happens to disagree.

**Independent Test**: Run `cd apps/api && pnpm test`. The four cases pass, and each asserted figure
can be traced to a hand derivation in [data-model.md](./data-model.md).

### Implementation for User Story 2

- [X] T010 [US2] Add case 4 to `apps/api/src/analytics/cost-model.spec.ts` reusing Fixture A: assert `buildMonthModels(...).get('2025-01').directRates.get('E1')` is **112.5**. Comment that this is 18000 ÷ 160 (total logged hours), and that the wrong implementation — salary ÷ billable hours — would give 180; `E1` is the only employee in the fixture whose two denominators differ, which is what makes the case discriminating. Delivers FR-005.
- [X] T011 [US2] Add case 5 to the same file, reusing Fixture A at `monthlyOverhead: 0`: assert `pool` is **26750**, `billableHours` is **200**, and `indirectRate` is **133.75**. Assert the three pool components add up as stated in [data-model.md](./data-model.md) §3 — 20,000 support salary + 6,750 non-billable time at 112.50 + 0 overhead — so that dropping any one component breaks the case. Delivers FR-006.
- [X] T012 [US2] Add case 8 to the same file: `isBillable` against the real default assumption set `['Projects', 'Enhancements', 'Hosting']` (the value of `DEFAULT_BILLABLE_CATEGORIES` in `apps/api/src/settings/settings.schema.ts`), asserting `true` for `'Projects'`, `'projects'` and `'HOSTING'`, and `false` for `'FC - Meetings'` and `'FC - Idle'`. Needs no fixture. Delivers FR-011.
- [X] T013 [US2] Add case 9 to the same file: `ratio(50, 200)` is `0.25`; `ratio(50, 0)` and `ratio(50, null)` are both `null` asserted with `toBeNull()`; `ratio(-100, 200)` is `-0.5`, confirming a loss is not clamped to zero; `ratio(0, 200)` is `0`, confirming a genuine zero is not turned into `null`. Do not use `toBeFalsy()` anywhere — it accepts both `0` and `null` and would defeat the distinction. Delivers FR-012.
- [X] T014 [US2] Run `cd apps/api && pnpm test` and confirm 7 passing tests. Record the real output.

**Checkpoint**: Stories 1 and 2 both hold. The aggregate is proven *and* each formula that feeds it is pinned individually.

---

## Phase 5: User Story 3 - Missing data degrades honestly (Priority: P3)

**Goal**: Fix in place the behaviour the brief asks for — unknown stays unknown, a partial figure is
flagged rather than presented as final, and unattributable cost is reported rather than absorbed.

**Independent Test**: Run `cd apps/api && pnpm test`. Both cases pass. Then apply the
unknown-becomes-zero mutation from [quickstart.md](./quickstart.md) V3 and confirm case 6 fails.

### Implementation for User Story 3

- [X] T015 [US3] Add Fixture C and case 6 to `apps/api/src/analytics/cost-model.spec.ts` per [data-model.md](./data-model.md) §5: month `2025-01`, `monthlyOverhead: 0`, `E1` (salary 18,000; 100 h billable + 60 h non-billable), `E3` (salary 20,000; no entries), `E4` (**no salary record**; 50 h billable). Assert, in this order: `directRates.get('E4')` is `null` via `toBeNull()`; `poolComplete` is `false`; `missingSalaryEmployees` contains `'E4'`; `costOf(...)` returns `cost` ≈ **29083.33** *and* `complete: false` — a number with a flag, never `null`, because one gap must not blank the period (FR-008); and `cost + uncostedIndirect(model)` ≈ **38000**, equal to known salaries plus overhead (FR-009). Comment why `E4`'s 50 hours remain in the billable denominator: narrowing it would make `E1` absorb a missing colleague's share to force the books to balance, which is a different cost model from the brief's. Delivers FR-007, FR-008, FR-009.
- [X] T016 [US3] Add Fixture D and case 7 to the same file per [data-model.md](./data-model.md) §6: month `2025-01`, `monthlyOverhead: 0`, `E1` (salary 18,000; 160 h **all** `FC - Meetings`), `E3` (salary 20,000; no entries). Assert `indirectRate` is `null` via `toBeNull()` (not `0`, not `Infinity`, and no thrown error), `entryCost(row, model)` is `null`, and `pool` is **38000** — the cost is real but cannot be allocated to any project. Delivers FR-010.
- [X] T017 [US3] Perform validation V3 from [quickstart.md](./quickstart.md): temporarily change `directRates.set(employeeNo, null)` to `directRates.set(employeeNo, 0)` in the missing-salary branch of `buildMonthModels` in `apps/api/src/analytics/cost-model.ts`, run `pnpm test`, confirm case 6 **fails**, then revert and confirm it passes. Record both outputs.

**Checkpoint**: All nine cases present and each proven load-bearing by a mutation check or by its derivation.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T018 [P] Add a "Tests" section to `apps/api/README.md` stating the command (`pnpm test`), what the suite covers (the cost model in `src/analytics/cost-model.ts`), and — explicitly — what it does not cover and why: spreadsheet parsing, the Prisma-backed analytics service, HTTP endpoints and `apps/web` are out of scope, because the assessment asks for tests "where they earn their keep" and the calculation layer is where they do. Delivers FR-015; a scope boundary is only honest if it is visible.
- [X] T019 [P] Perform validation V4: run `cd apps/api && pnpm build`, then `ls dist/analytics/`. Confirm `cost-model.js` is present and `cost-model.spec.js` is **absent** — `tsconfig.build.json` already excludes `**/*spec.ts` (research R3), so this confirms an existing provision rather than a new one. Record the output.
- [X] T020 [P] Perform validation V5: run `cd apps/api && pnpm lint` and confirm `oxlint` reports no new complaint about the spec file. Fix anything it raises before reporting completion.
- [X] T021 Perform validation V6: read `apps/api/src/analytics/cost-model.spec.ts` alongside [data-model.md](./data-model.md) §3–§7 and confirm every asserted number appears in a derivation there. Any figure that cannot be traced was copied from the code's own output and must be replaced with a hand-derived one (SC-002).
- [X] T022 Run the full suite one final time with timing (`cd apps/api && pnpm test`), confirm **9 passing tests in 1 file** and a duration under five seconds (SC-004), and report the real output together with the results of T009, T017, T019 and T020 (Principle VIII).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → T003, strictly sequential (T002 and T003 edit the same file).
- **Foundational (Phase 2)**: Depends on Phase 1. **Blocks all three stories.**
- **User Stories (Phases 3–5)**: All depend on T004. In priority order P1 → P2 → P3.
- **Polish (Phase 6)**: Depends on all stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on T004. No dependency on US2 or US3.
- **US2 (P2)**: Depends only on T004. Reuses Fixture A from T005 — if US2 were ever built before US1, T010 would carry the fixture instead.
- **US3 (P3)**: Depends only on T004. Brings its own fixtures (C and D).

Every story is independently testable and independently shippable, as the spec requires.

### Parallel Opportunities

Deliberately narrow, and the reason is structural:

- **T018, T019, T020** are genuinely parallel — a README, a build, and a lint run, three different targets.
- **T005–T007, T010–T013, T015–T016 are NOT parallel with one another.** They all edit `apps/api/src/analytics/cost-model.spec.ts`. Running them concurrently produces edit conflicts, not speed.
- **Stories cannot be split across people** for the same reason. With one file and nine cases, this is a single-developer feature; pretending otherwise would invent coordination cost for a ~120-line file.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup — branch, dependency, script.
2. Phase 2: Foundational — the file and its two fixture helpers.
3. Phase 3: User Story 1 — the three reconciliation cases plus the V2 mutation check.
4. **STOP and VALIDATE**: `pnpm test` passes, and the deliberate double-count makes it fail.

At that point the repository already carries the assessment's own self-check as an executable
guarantee — the highest-value outcome in this feature. Stories 2 and 3 add precision; Story 1 adds
the thing that is actually being graded.

### Incremental Delivery

1. Setup + Foundational → the command exists.
2. + US1 → the reconciliation is proven (MVP, 3 tests).
3. + US2 → each formula is pinned (7 tests).
4. + US3 → missing data is proven to degrade honestly (9 tests).
5. + Polish → README, build, lint, and the traceability read.

---

## Notes

- **Do not modify `cost-model.ts`** except for the two temporary mutations in T009 and T017, both of which are reverted within their own task. This feature verifies the calculation layer; it does not reshape it.
- **`null` is asserted with `toBeNull()`, never `toBeFalsy()`.** Unknown and zero must stay distinguishable — that distinction is what stops a missing salary from rendering as "AED 0" on the dashboard.
- **Every expected figure comes from [data-model.md](./data-model.md), not from running the code.** A test whose expectation was pasted from current output proves only that the code still agrees with itself.
- Commit after each task or logical group. Stop at any checkpoint to validate independently.
