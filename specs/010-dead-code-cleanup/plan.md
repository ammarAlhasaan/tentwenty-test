# Implementation Plan: Dead Code and Cruft Cleanup

**Branch**: `010-dead-code-cleanup` | **Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-dead-code-cleanup/spec.md`

## Summary

Remove code, dependencies, stylesheet tokens and configuration that nothing references, and
correct three places where two parts of the system disagree. Every removal was confirmed by
searching the whole repository; each is re-verified immediately before it is made.

The approach is deletion-first and mechanical. Work proceeds in five passes — backend, frontend
components, frontend stylesheet, frontend library modules, repository configuration — each ending
with the same verification command set, so a regression is attributed to the pass that caused it
rather than discovered at the end.

No dependency is added. Three are removed.

## Technical Context

**Language/Version**: TypeScript 5.9 (`apps/web`), TypeScript 6.0 (`apps/api`), Node 24.21.0

**Primary Dependencies**: Next.js 16.3.4, React 19.2.8, Tailwind CSS 4, TanStack Query 5 in
`apps/web`; NestJS 12, Prisma 7 with better-sqlite3, Zod 4 in `apps/api`. No dependency is added
by this change.

**Storage**: SQLite via Prisma. Untouched — no schema change, no migration.

**Testing**: Vitest 5 in `apps/api`. Nine existing cases on the cost model, unmodified by this
change and used as the regression gate. `apps/web` has no test suite by decision.

**Target Platform**: Local development on macOS, two processes on ports 3000 and 4000.

**Project Type**: Two independent applications in one pnpm workspace, communicating over HTTP.

**Performance Goals**: Not applicable — no runtime path changes. Two incidental improvements
follow from removing unused stylesheet imports and dependencies, and are not measured or claimed.

**Constraints**: No user-visible behaviour change, with the single exception of FR-011. No new
comments (constitution Principle III, and the spec's FR-021). No new dependency.

**Scale/Scope**: 25 changes across roughly 20 files in both applications and the repository root.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated after Phase 1.*

| Principle | Status | Notes |
|---|---|---|
| I. Simple, Conventional Code | **Pass** | Every change removes a construct or replaces a duplicate with an existing shared helper. Nothing new is introduced. |
| II. No Speculative Structure | **Pass** | This principle is the reason for the spec. Unused props, variants, tokens and dependencies are exactly the speculative structure it forbids. |
| III. Comments Explain the Non-Obvious | **Pass** | No comment is written. Comments describing removed code are removed with it; one comment that misstates the code is corrected. |
| IV. HTTP-Only Boundary | **Pass** | No shared code is introduced. FR-010 aligns a duplicated frontend type with the backend's actual response; the duplication itself is preserved, as the principle requires. |
| V. One Side Per Spec | **Deviation** | Recorded in Complexity Tracking below. |
| VI. One Spec Per Side At A Time | **Pass** | No other spec is in implementation. Feature 009 is merged. Work happens in its own worktree on its own branch, as required. |
| VII. Libraries That Remove Complexity | **Pass** | No dependency added. Three removed, each verified to have zero import sites. |
| VIII. Verified Results Only | **Pass** | Every pass ends with lint, typecheck, test and build actually executed. Reported output is real. |
| Repository Boundaries — root scripts minimal | **Pass** | The audit's recommendation to add root `lint` and `test` scripts is dropped for this reason and recorded in the spec's Out of Scope. |

**Post-Phase 1 re-evaluation**: unchanged. The design phase produced no new structure — there is
no data model, and the one contract artifact documents an existing endpoint rather than
introducing one.

## Project Structure

### Documentation (this feature)

```text
specs/010-dead-code-cleanup/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output — Not applicable, with reason
├── quickstart.md        # Phase 1 output — verification guide
├── contracts/
│   └── import-history.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── analytics/
│   │   ├── analytics.service.ts     # revenueComplete field; rounding comment
│   │   ├── cost-model.ts            # monthKey and isBillable are the adoption targets
│   │   └── cost-model.spec.ts       # unmodified; the regression gate
│   ├── imports/
│   │   ├── imports.service.ts       # unpriced predicate; billable Set
│   │   ├── parse-timesheet.ts       # unpadded month key
│   │   ├── parse-salaries.ts        # duplicate monthName
│   │   └── parse-workbook.ts        # export narrowing
│   ├── settings/settings.service.ts # billable Set
│   └── config.ts                    # Env type
└── package.json                     # source-map-support, start:dev

apps/web/
├── app/globals.css                  # two imports, five token groups
├── components/
│   ├── ui/{button,card,table}.tsx   # variants, sub-components, props
│   ├── period-filter.tsx            # disabled prop
│   ├── period-scope.tsx             # duplicated query string
│   ├── stat-card.tsx                # duplicated share bar
│   └── pill.tsx                     # ShareBar, the adoption target
├── lib/
│   ├── analytics.ts                 # Completeness, periodQuery
│   ├── imports.ts                   # history response type
│   └── utils.ts                     # deleted
├── components.json                  # utils alias repointed
├── tsconfig.json                    # allowJs, *.mts
├── eslint.config.mjs                # no-op globalIgnores
├── next.config.ts                   # placeholder comment
└── package.json                     # zustand, tw-animate-css

.gitignore                           # .claude entry; Yarn PnP block
AGENTS.md                            # Zustand rule reworded
package.json                         # unchanged — see Constitution Check
```

**Structure Decision**: The existing two-application workspace is unchanged. No directory is
added or removed; one file (`apps/web/lib/utils.ts`) is deleted.

## Implementation Approach

Five passes, ordered so that the highest-risk work runs first while attention is freshest, and so
that each pass is independently revertible.

| Pass | Scope | Risk | Gate |
|---|---|---|---|
| 1 | Backend logic — the unpriced predicate, the billable helper, the month key, `revenueComplete`, the `Env` type, export narrowing, the rounding comment | Highest — the only behavioural change is here | `pnpm --filter api test`, typecheck, lint |
| 2 | Frontend components — card sub-components, button variants and sizes, the two dead props, the share-bar consolidation | Medium — stranded style rules are easy to miss | typecheck, lint |
| 3 | Frontend stylesheet — two imports, five token groups | Medium — a token removed from `:root` must also leave `.dark` | typecheck, lint, build |
| 4 | Frontend library modules — the deleted `utils` module, the history type, `Completeness`, the query-string consolidation | Low | typecheck, lint |
| 5 | Configuration — dependencies, ignore rules, compiler and linter options, `AGENTS.md` | Low | install, full verification set |

**Ordering constraint**: dependency removal (pass 5) must follow the source changes that make
those dependencies unused, or the intermediate tree will not build.

**Verification between passes**: typecheck and lint after every pass; the test suite after pass 1
and again at the end; both builds only at the end, since a build is slow and nothing before pass 3
can break one without also breaking the typecheck.

### Method for each removal

1. Search the whole repository for the symbol, excluding `node_modules`, `.next`, `dist` and the
   generated Prisma client, and confirm the only hits are its own declaration.
2. Search the test suite separately. `entryCost` is on the audit's export-narrowing list and is
   imported by the suite; it stays exported. Every other candidate gets the same check.
3. Remove the symbol and everything that exists only to serve it — the branch, the attribute, the
   style rule, the comment.
4. Re-run the pass gate.

### Notes on individual items

- **Stranded style rules.** Deleting `CardFooter`, `CardAction` and `CardDescription` strands
  matching rules on `Card` and `CardHeader` (`has-data-[slot=card-footer]`,
  `has-data-[slot=card-action]`, `has-data-[slot=card-description]`). These go with the
  components. Deleting the `size` prop additionally strands the two `data-[size=sm]` rules on
  `Card` and the `group-data-[size=sm]/card` rule on `CardTitle`.
- **Token removal spans three blocks.** Each token group is declared in `@theme`, in `:root`, and
  again in `.dark`. All three must be removed together. The dark theme is out of scope as a
  feature; keeping its palette consistent with the light one is not.
- **`--radius-md` stays.** The button size variants reference it. Only `--radius-sm`, `--radius-3xl`
  and `--radius-4xl` are unreferenced.
- **`--muted` stays, `--muted-foreground` goes with `CardDescription`.** `--muted` is used by the
  skeleton, the root loading state and the ghost button.
- **`--destructive` stays.** It is referenced by the always-applied `aria-invalid` rules in the
  button base string, which survive the removal of the `destructive` variant.
- **The utils alias.** `components.json` points `aliases.utils` at the deleted module. It is
  repointed at `cn`, the package every call site already imports, so regenerating a component does
  not recreate the file.
- **The Zustand rule.** The dependency is removed; the rule in `AGENTS.md` is reworded as
  conditional guidance rather than deleted. The equivalent clause in the constitution is left
  untouched — changing it requires an amendment in its own change, per Governance.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Principle V — One Side Per Spec.** This spec changes both `apps/web` and `apps/api`. | The cleanup is one coherent unit of work driven by a single audit. Its two halves share no code and no contract; they share only a reason. | **Splitting into a backend spec and a frontend spec was rejected.** Principle V exists to keep the HTTP contract explicit when a feature spans both sides. This spec introduces no contract and no coupling — it removes both. Splitting would produce two changes that must land together anyway, because the frontend half removes a dependency and the backend half removes a devDependency from the same lockfile, and a lockfile written by one half and not the other leaves the tree unbuildable between merges. The split would add a second review cycle and a merge-ordering constraint while removing nothing from the change's real complexity. |
| **Repository Boundaries — root scripts.** The audit recommended adding root `lint` and `test` scripts; this plan does not add them. | Recorded here as a deliberate omission rather than an oversight, so the audit's recommendation is not silently lost. | Not a deviation — this is the constitution being followed. Adding them requires an amendment in its own change. Noted so a reviewer comparing the audit with this plan sees why one item is missing. |
