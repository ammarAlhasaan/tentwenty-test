# Phase 0 Research: Cost Model Verification Suite

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-10

Every finding below was produced by a command actually run on this machine, as Principle VIII
requires. The commands and their real output are recorded with each decision.

---

## R1. Test runner

**Decision**: Vitest 5.0.0, added as a single `devDependency` in `apps/api`, with no configuration
file.

**Rationale**: It is the only candidate that satisfies all four hard constraints at once — it runs
TypeScript ESM on Node 26 with no build step, it resolves the `.js` import specifier the codebase
already uses, it needs no config file, and it costs one dependency. Verified in an isolated scratch
project so the repository was not modified during research:

```
pnpm add -D vitest   →  + vitest 5.0.0   (Done in 1.4s, no peer-dependency warnings)
npx vitest run       →  Test Files 1 passed (1) / Tests 1 passed (1) / Duration 131ms
```

The scratch project reproduced the exact conditions of `apps/api`: `"type": "module"`, a `.ts`
source file, and a spec importing it as `./lib.js`. The test passed, which is the specific
behaviour R2 turns on.

**Alternatives considered**:

- **`node:test` — the Node 26 built-in runner, zero dependencies.** Rejected, and it was the
  preferred option going in, because Principle VII favours adding nothing at all. Node 26 does strip
  TypeScript types natively, and the probe passed:

  ```
  node --test src/analytics/__probe.spec.ts  →  ✔ probe / pass 1 / fail 0
  ```

  But only after the import was rewritten from `./cost-model.js` to `./cost-model.ts`. With the
  original specifier it fails outright:

  ```
  ERR_MODULE_NOT_FOUND
  url: '.../apps/api/src/analytics/cost-model.js'
  ```

  Node's type stripping does not remap a `.js` specifier to its `.ts` source. Adopting it would mean
  the one spec file imports differently from every other file in `apps/api`, and a `.ts` import
  specifier under `"moduleResolution": "nodenext"` requires `allowImportingTsExtensions`, which in
  turn requires `noEmit` — incompatible with the `nest build` this project depends on. Zero
  dependencies is not worth a build-config exception and an import convention that contradicts the
  rest of the codebase.

- **Jest.** Rejected without probing. It is the NestJS default, but in an ESM package with
  TypeScript it requires a transformer, an `extensionsToTreatAsEsm` entry, a module-name mapper to
  strip `.js` specifiers, and `--experimental-vm-modules`. That is four pieces of configuration and
  at least three dependencies to reach what Vitest does with one dependency and none. Principle VII
  asks whether a library removes complexity; Jest here adds it.

---

## R2. Import specifier for the spec file

**Decision**: The spec imports `./cost-model.js`, identical to every other import in `apps/api`.

**Rationale**: `apps/api` compiles under `"module": "nodenext"` / `"moduleResolution": "nodenext"`
(verified in `apps/api/tsconfig.json`), which requires the emitted `.js` extension on relative
imports. Vitest resolves that specifier back to the `.ts` source, verified in R1. The spec therefore
needs no exception, and a reader moving between the spec and the source sees one convention.

**Alternatives considered**: `./cost-model.ts` — required by `node:test`, rejected with that option
in R1.

---

## R3. Effect on the production build

**Decision**: No build configuration change is required.

**Rationale**: `apps/api/tsconfig.build.json` already carries the exclusion:

```json
"exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
```

`nest build` compiles through that file, so a new `src/analytics/cost-model.spec.ts` is excluded
from `dist/` automatically. This was a pre-existing provision, not something this feature adds — it
is recorded here so the plan does not create a task to solve a problem that does not exist.

**Verification owed at implementation**: run `pnpm build` in `apps/api` after the spec file lands
and confirm no `cost-model.spec.js` appears under `dist/`.

---

## R4. Fixture strategy

**Decision**: Inline fixtures built by two small local helpers in the spec file. No shared factory
module, no fixture directory, no reading of the workbooks under `apps/api/sample-data`.

**Rationale**: The value of every case in this suite is that its expected figure was derived by hand
from the assessment's formulas. A fixture of three employees and a handful of rows can be checked
against those formulas by a reader; a year of real data cannot, and a test whose expected value was
copied from the code's own output proves only that the code still agrees with itself. Inline data
also delivers SC-005 (no database, no network, no spreadsheet) for free. Principle II forbids adding
a helper module before a requirement calls for one — two local functions inside the single spec file
are the whole need.

**Alternatives considered**: Loading `sample-data/salaries-2025.xlsx` and friends. Rejected: it
would drag the parsers, `read-excel-file`, and file I/O into a suite whose scope (FR-013) explicitly
excludes them, and it would make every expected figure unverifiable by eye.

---

## R5. Floating-point comparison

**Decision**: Compare the reconciliation with `toBeCloseTo(expected, 2)`.

**Rationale**: The two sides of the reconciliation are accumulated in different orders — one sums
salaries directly, the other sums `hours × (directRate + indirectRate)` across rows — so binary
floating point makes exact equality the wrong assertion. `toBeCloseTo(x, 2)` requires agreement to
within 0.005, which is precisely the tolerance the application itself already uses:

```
apps/api/src/analytics/analytics.service.ts:20
const BALANCE_TOLERANCE = 0.005;   /** "Equal to the dirham" -- the assessment's own tolerance. */
```

Using the same tolerance in the suite as in the shipped reconciliation keeps one definition of "to
the dirham" rather than two.

**Alternatives considered**: `toBe` / exact equality. Rejected — it would produce failures that
signal nothing about the cost model.

---

## R6. Which functions the suite exercises

**Decision**: The four exported functions of `apps/api/src/analytics/cost-model.ts` —
`buildMonthModels`, `entryCost`, `costOf`, `uncostedIndirect` — plus the two predicates `isBillable`
and `ratio`. Nothing else.

**Rationale**: These are already pure functions over plain arrays with no imports at all (verified
by reading the file: `cost-model.ts` imports nothing), which is the precondition the spec's first
assumption records. Every one of FR-002 through FR-012 maps onto one or more of them.

**Explicitly not covered, and why** — this restates FR-013 in terms of the code:

| Not covered | Reason |
|---|---|
| `imports/parse-*.ts` | Spreadsheet parsing; out of scope by FR-013. |
| `analytics.service.ts` | Depends on Prisma; testing it means a database, which SC-005 rules out. |
| `allocate()` (revenue share, employee profitability) | Lives in `analytics.service.ts` and is not exported. Moving it to the cost model purely to make it testable would be a change to working code made to suit a test — recorded as a deliberate omission in the spec's assumptions. |
| Controllers, guards, `apps/web` | Out of scope by FR-013 and by Principle V. |

---

## R7. Concurrency check (Principle VI)

**Decision**: This spec may proceed on the `apps/api` side now.

**Rationale**: The most recent work in the repository is `224bd33 feat(web): FE-04 …`, a frontend
change, and the only spec directory after `008-frontend-simplification` is this one. No `apps/api`
spec is mid-implementation, so the one-spec-per-side rule is satisfied. Implementation must still
happen in its own git worktree on branch `009-cost-model-tests`, per Principle VI.
