# Implementation Plan: Cost Model Verification Suite

**Branch**: `009-cost-model-tests` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-cost-model-tests/spec.md`

## Summary

Make the assessment's own self-check executable. `apps/api/src/analytics/cost-model.ts` already
implements the brief's cost model as pure functions over plain arrays, but nothing proves the
arithmetic holds — the reconciliation can only be confirmed today by loading data and reading a
figure off the dashboard.

The approach: one new `devDependency` (Vitest 5.0.0, verified against Node 26.4.0 and TypeScript 6
in [research.md](./research.md) R1), one `test` script, and one spec file beside the source it
covers, holding nine cases with hand-derived expected figures. No config file, no fixture directory,
no test helper module, no change to the build. Scope is the calculation layer only; the parsers,
the Prisma-backed service, the HTTP layer and the frontend are excluded by FR-013 and that exclusion
is recorded in the README rather than left silent.

## Technical Context

**Language/Version**: TypeScript 6.0.2 on Node.js 26.4.0 (repository `engines`: `>=24.15.0`), ESM
throughout — `apps/api/package.json` declares `"type": "module"` and `tsconfig.json` sets
`"module": "nodenext"`.

**Primary Dependencies**: Vitest 5.0.0 as the single new `devDependency` in `apps/api`. No runtime
dependency is added or changed. The subject under test, `cost-model.ts`, imports nothing at all.

**Storage**: Not applicable. The suite constructs its inputs in memory; it opens no SQLite file and
reads no workbook (SC-005).

**Testing**: Vitest, run with `pnpm test` from `apps/api`. Zero-config: the default `include` glob
picks up `src/**/*.spec.ts`.

**Target Platform**: A developer machine, macOS or Linux, from a clean checkout with no cloud
account, API key, or paid service — the constraint the assessment states and the constitution's
Repository Boundaries repeat.

**Project Type**: pnpm workspace monorepo (`apps/*`). This feature is confined to `apps/api`.

**Performance Goals**: Whole suite under 5 seconds (SC-004). The R1 probe ran a comparable file in
131 ms, so the target has substantial headroom.

**Constraints**: Must not alter `nest build` output — satisfied without changes, because
`tsconfig.build.json` already excludes `**/*spec.ts` (research R3). Must not modify any file under
`apps/web` (Principle V). Must not modify `cost-model.ts` itself: this feature verifies the existing
calculation layer, it does not reshape it.

**Scale/Scope**: One new file (~120 lines), two edited lines in `apps/api/package.json`, one README
section. Nine test cases across six exported functions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — result unchanged.*

| Principle | Status | Basis |
|---|---|---|
| I. Simple, Conventional Code | PASS | Vitest's documented default layout: `*.spec.ts` beside the source, discovered by the default glob, no config file. The `.spec.ts` suffix is already the repository's convention — `tsconfig.build.json` has excluded `**/*spec.ts` since before this feature. |
| II. No Speculative Structure | PASS | No `test/` directory, no fixture factory module, no `vitest.config.ts`, no base class. Two fixture helpers live inside the one spec file, which is the whole of the need (research R4). |
| III. Comments Explain the Non-Obvious | PASS | Test names state the rule being pinned. Comments appear only where an expected figure's derivation is not visible from the numbers — e.g. why 125 is `20000 / 160` and not `20000 / 100`. |
| IV. HTTP-Only Boundary | PASS | Nothing is shared with `apps/web`; no file outside `apps/api` is touched. |
| V. One Side Per Spec | PASS | `apps/api` exclusively, recorded in the spec's final assumption. |
| VI. One Spec Per Side At A Time | PASS | No `apps/api` spec is mid-implementation; the most recent work is the frontend's FE-04 (research R7). Implementation proceeds in its own worktree on branch `009-cost-model-tests`. |
| VII. Libraries That Remove Complexity | PASS | One dependency, chosen only after the zero-dependency alternative was probed and failed for a recorded reason (research R1). Installed clean with no peer-dependency warning and no `--force` or `--legacy-peer-deps`. |
| VIII. Verified Results Only | PASS | Every research finding cites the command that produced it. The outstanding verifications — `pnpm test`, `pnpm build`, `pnpm lint` — are explicit tasks, and their real output will be reported. |

No violations. Complexity Tracking is therefore not applicable and is omitted.

## Project Structure

### Documentation (this feature)

```text
specs/009-cost-model-tests/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output — runner choice, import specifier, build effect, fixtures
├── data-model.md        # Phase 1 output — the shapes the suite constructs and asserts on
├── quickstart.md        # Phase 1 output — how to run and validate the suite
├── checklists/
│   └── requirements.md  # Spec quality checklist (passed)
└── tasks.md             # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

`contracts/` is **not applicable**. The plan template asks for interface contracts when a feature
exposes something to users or other systems; this one exposes no HTTP endpoint, no CLI surface and
no public module. Its only external surface is the `pnpm test` command, which
[quickstart.md](./quickstart.md) documents.

### Source Code (repository root)

```text
apps/api/
├── package.json                        # EDIT: add vitest devDependency + "test" script
├── tsconfig.build.json                 # unchanged — already excludes **/*spec.ts
├── README.md                           # EDIT: how to run the suite, and the scope decision
└── src/
    └── analytics/
        ├── cost-model.ts               # unchanged — the subject under test
        └── cost-model.spec.ts          # NEW: the nine cases

apps/web/                               # untouched (Principle V)
```

**Structure Decision**: The spec file sits beside the module it covers, in
`apps/api/src/analytics/`, rather than in a parallel `test/` tree. That is Vitest's documented
default, it is what `tsconfig.build.json`'s existing `**/*spec.ts` exclusion already anticipates,
and it keeps a reader's eye on the formula and its proof at the same time. A separate tree would be
the speculative structure Principle II forbids: there is one file to place.

## Phase 1 Design Notes

The nine cases map onto the requirements as follows. This mapping is what `/speckit-tasks` turns
into tasks, and what a reviewer checks coverage against.

| # | Case | Requirements | Functions exercised |
|---|---|---|---|
| 1 | Self-check: overhead 0, one month, total cost = total salaries | FR-002 | `buildMonthModels`, `costOf` |
| 2 | Same equality across two months at different salaries | FR-003 | `buildMonthModels`, `costOf` |
| 3 | Overhead counted once per month | FR-004 | `buildMonthModels`, `costOf` |
| 4 | Direct rate = salary ÷ **total** logged hours | FR-005 | `buildMonthModels` |
| 5 | Indirect pool composition, and rate = pool ÷ billable hours | FR-006 | `buildMonthModels` |
| 6 | Missing salary: unknown rate, partial flag, reconciliation still balances | FR-007, FR-008, FR-009 | `buildMonthModels`, `costOf`, `uncostedIndirect` |
| 7 | Month with no billable hours: unknown indirect rate, unknown row cost, non-zero pool | FR-010 | `buildMonthModels`, `entryCost` |
| 8 | Billable-category matching ignores case; unlisted category is internal | FR-011 | `isBillable` |
| 9 | Ratio against zero/unknown denominator is unknown; negatives survive | FR-012 | `ratio` |

FR-001 is delivered by the `test` script, FR-014 by the inline-fixture decision (research R4), and
FR-015 by the README edit.

Two properties the suite must hold to, because they are the ones a careless test would erode:

- **Expected figures are derived from the brief, not from the code.** Every number in an assertion
  is computed by hand from the formulas the assessment states, and where the derivation is not
  self-evident it is written next to the assertion. A test whose expectation was pasted from the
  current output proves nothing about correctness.
- **Unknown and zero stay distinguishable.** `null` means "we do not know", `0` means "it is zero".
  Cases 6, 7 and 9 exist to hold that line, and none of them may assert `toBeFalsy()`, which would
  accept either.
