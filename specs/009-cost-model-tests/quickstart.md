# Quickstart: Cost Model Verification Suite

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-10

How to run the suite and confirm it actually proves what it claims. Everything here is runnable from
a clean checkout — no database, no network, no spreadsheet loaded (SC-005).

## Prerequisites

- Node.js ≥ 24.15.0 (repository `engines`; verified on 26.4.0)
- pnpm 11.9.0 (`packageManager` in the root `package.json`)
- `pnpm install` completed at the repository root

## Run it

```bash
cd apps/api && pnpm test
```

Expected: `Test Files 1 passed (1)`, `Tests 9 passed (9)`, finishing in well under five seconds
(SC-004). No SQLite file is opened and no request is made.

## Validation scenarios

These are the checks a reviewer runs to confirm the suite is worth trusting. Each one should be
performed once, at implementation time, and its real output recorded (Principle VIII).

### V1 — The suite passes from a clean checkout (SC-001, SC-005)

```bash
git clean -n apps/api/data && cd apps/api && pnpm test
```

The first command lists any local database file without deleting it; the point is to confirm the
suite's result does not depend on one. `pnpm test` passes either way.

### V2 — The reconciliation check actually catches a double count (SC-003)

The single most important property: a suite that cannot fail is not evidence. Temporarily break the
cost model in `apps/api/src/analytics/cost-model.ts` by adding the indirect rate into the pool —
the exact double count the assessment warns about:

```ts
// in buildMonthModels, replace:
pool += hours.nonBillable * rate;
// with (TEMPORARY — revert immediately):
pool += hours.nonBillable * rate * 2;
```

Run `pnpm test`. Cases 1, 2 and 3 must fail, reporting a total cost above total salaries. **Revert
the edit** and confirm the suite passes again. Record both outputs.

### V3 — Unknown is not confused with zero (FR-007, FR-010)

Temporarily change `directRates.set(employeeNo, null)` to `directRates.set(employeeNo, 0)` in the
missing-salary branch of `buildMonthModels`. Case 6 must fail. Revert.

This confirms the suite's assertions use `toBeNull()` rather than `toBeFalsy()` — a distinction that
looks pedantic until a missing salary starts rendering as "AED 0" on the dashboard.

### V4 — The production build is unaffected (research R3)

```bash
cd apps/api && pnpm build && ls dist/analytics/
```

`dist/analytics/` must contain `cost-model.js` and must **not** contain `cost-model.spec.js`.
`tsconfig.build.json` already excludes `**/*spec.ts`, so this confirms an existing provision rather
than a new one.

### V5 — The lint pass still succeeds

```bash
cd apps/api && pnpm lint
```

`oxlint` runs over `src/`, which now includes the spec file. Any complaint is addressed before the
feature is reported complete.

### V6 — Expected figures are independently checkable (SC-002)

Not a command — a read. Open `apps/api/src/analytics/cost-model.spec.ts` alongside
[data-model.md](./data-model.md) §3–§7 and confirm that every asserted number appears in a
derivation there, computed from the assessment's formulas. Any figure in the spec file that cannot
be traced to a derivation is a figure copied from the code's own output, and proves nothing.

## What this suite does not cover

Stated here as well as in the README (FR-015), because a scope boundary is only honest if it is
visible: spreadsheet parsing, the Prisma-backed analytics service, HTTP endpoints, authentication,
and the whole of `apps/web` are outside this feature. The reasoning is recorded in
[research.md](./research.md) R6.
