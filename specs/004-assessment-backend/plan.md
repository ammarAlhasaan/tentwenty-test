# Implementation Plan: BE-03 — Complete Assessment Backend

**Branch**: `004-assessment-backend` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Worktree**: `/Users/ammaralhasan/Documents/claude-worktree/tentwenty-test/assessment-backend`

**Base commit**: `12c5014` (`main`) — `apps/api` at this commit is byte-identical to `68e76ce`,
the reviewed BE-02 head, verified with `git diff --stat 68e76ce main -- apps/api` (empty).

## Summary

Add three feature modules to `apps/api`: ingestion of the three supplied workbooks, the
assessment's cost model, and the read endpoints every required frontend screen needs — reusing
BE-01's configuration, validation pipe, error filter and database service, and BE-02's session
guard, with **no new dependencies**.

The cost model was implemented against the real data during research and reconciles exactly:
total cost = total salaries = **AED 2,400,000** at zero overhead, and it balances per month as
well as per year (`research.md` §2).

## Technical Context

| | |
| --- | --- |
| **Language** | TypeScript 6.0.2, ESM, Node 24.21.0 |
| **Framework** | NestJS 12.0.1 on `@nestjs/platform-express` 12.0.1 (Express 5.2.1) |
| **Storage** | `better-sqlite3` 13.0.3, through the existing `DatabaseService` |
| **Parsing** | `read-excel-file` 9.3.10 — `readSheet` named export, `Buffer` input |
| **Upload** | `FileInterceptor` from `@nestjs/platform-express`; `multer@2.2.0` is already a direct dependency of it |
| **Validation** | `zod` 4.5.4 via the existing global `StandardSchemaValidationPipe` |
| **Auth** | `SessionAuthGuard` from BE-02, route-scoped |
| **New dependencies** | **none** |
| **Testing** | none — automated testing is deferred to a later cross-cutting spec (spec, Out of Scope) |
| **Scale** | 562 timesheet rows, 144 salary cells, 11 projects, 12 employees. Everything computes in memory per request |

## Constitution Check

| Principle | Status | Evidence |
| --- | --- | --- |
| I — Simple, conventional code | Pass | Nest modules, controllers, providers, `FileInterceptor`, the global pipe and filter. No custom mechanism replaces a documented feature |
| II — No speculative structure | Pass | Three modules, no base classes, no repositories, no interfaces with one implementation, no barrel files. Each index and each table is justified by a query that exists (`data-model.md`) |
| III — Comments explain the non-obvious | Pass | Comments are reserved for the two things a reader cannot infer: why non-billable time is valued at the direct rate only, and why `read-excel-file` v9's default export is not used |
| IV — HTTP-only boundary | Pass | No shared package, type or schema. `apps/web` is untouched |
| V — One side per spec | Pass | `apps/api` only |
| VI — One spec per side at a time | Pass | BE-02 is complete, reviewed and merged (`adb0d50`). This is the only open `apps/api` spec. FE-01 is a separate side and shares no files |
| VII — Libraries that remove complexity | Pass | Nothing is added. Every library used is already installed, and its installed version's API was verified by running it (`research.md` §4, §5) |
| VIII — Verified results only | Pass | The reconciliation figures in `research.md` and `quickstart.md` were computed from the supplied workbooks, not asserted. Implementation reports real command output |

No deviations. Complexity Tracking is empty.

## Requirements coverage

The assessment, mapped end to end. **M** = Must Have, **S** = Should Have, **X** = stretch, out
of scope.

| # | Assessment requirement | Backend behaviour | Endpoint / data / calculation | Manual acceptance check |
| --- | --- | --- | --- | --- |
| M1 | Upload — take the three spreadsheets through the UI and persist them | Parse, validate, persist per kind | `POST /imports/{timesheet,salaries,projects}`; `timesheet_entries`, `salaries`, `projects` | Q1 — all three files accepted, row counts match |
| M2 | Re-uploading a corrected month must not duplicate or destroy the rest of the year | Delete-then-insert by `(year, month)`; projects upsert by ref code | `data-model.md` → Import replacement rules | Q6, Q7, Q8 |
| M3 | Dashboard — total hours, billable hours, cost, revenue, margin for a selected period | Cost model summed over the period | `GET /dashboard?year=&month=` | Q3, Q4, Q5 |
| M4 | Dashboard — year and month filter | `year` required, `month` optional on every period endpoint | all period endpoints | Q10 — twelve months sum to the year |
| M5 | Project page — price, hours by department, cost, profit, margin, per-employee contribution | Lifetime project figures with department and employee splits | `GET /projects/:refCode` | Q11, Q12 |
| M6 | Productivity page — billable ÷ total hours per employee, filterable | Per-employee ratio over the period | `GET /productivity?year=&month=` | Q13 |
| M7 | Category page — hours per category, filterable | Category totals and the billable/internal split | `GET /categories?year=&month=` | Q14 |
| S1 | Department drill-down — hours and cost of every person in a department | Departments with employees nested | `GET /departments?year=&month=` | Q15 |
| S2 | Per-employee profitability on each project | `(revenueShare - cost) / revenueShare` | `GET /projects/:refCode` → `employees[]` | Q12 |
| S3 | Configurable assumptions — billable categories and monthly overhead, without editing code | Persisted settings read on every calculation | `GET /settings`, `PUT /settings`; `settings` table | Q16, Q17 |
| S4 | Honest empty and error states — missing salary, missing price, a file that isn't what it claims | Warnings and `null`-not-zero throughout; content-based file-type check | warning objects; `GET /periods`; 422 responses | Q9, Q18, Q19 |
| — | Self-check: a full year at zero overhead, total cost = total salaries | Reconciliation computed and exposed | `GET /dashboard` → `reconciliation` | Q3 |
| — | Runs locally from a clean checkout with a documented command or two | No new dependency, no cloud account, existing `.env.example` | `quickstart.md` | Q0 |
| X | CSV export | Not built — a frontend concern once the tables exist | — | — |
| X | Employee × category matrix | Not built — the underlying figures are in `/categories` and `/productivity` | — | — |
| X | Cost-rate audit view | Not built — the per-month rates are visible in `reconciliation` | — | — |
| X | Multi-year side-by-side comparison | Not built — data is keyed by year, so loading 2024 works; no comparison endpoint | — | — |

Every **M** and every **S** is covered. The four **X** items are the assessment's own stretch
goals and are named in the spec's Out of Scope.

### Mandatory vs optional vs assumption

- **Mandatory** (assessment Must Have): M1–M7, plus the self-check and the clean-checkout rule.
- **Optional** (assessment Should Have): S1–S4 — all four are built, because each is cheap once
  the cost model exists and S3 is required by the self-check anyway.
- **Assumptions**: A-001 to A-010 in `spec.md`. Only **A-001** (revenue earned by hour share
  rather than booked in the sales month) materially changes a financial result; it is analysed in
  `research.md` §3 and is the one item worth confirming with the assessor.

## Project Structure

### Documentation (this feature)

```
specs/004-assessment-backend/
├── spec.md              # what and why
├── research.md          # the data, the verified cost model, version traps
├── plan.md              # this file
├── data-model.md        # tables, indexes, replacement rules, transaction boundaries
├── contracts/
│   ├── README.md        # rules common to every endpoint
│   ├── imports.md       # ingestion
│   ├── analytics.md     # reporting
│   └── settings.md      # assumptions
├── tasks.md             # ordered implementation tasks, four checkpoints
├── quickstart.md        # the manual verification guide
└── checklists/
    └── requirements.md
```

### Source code

Only `apps/api/src` changes. `apps/web` is untouched.

```
apps/api/src/
├── app.module.ts                 # MODIFIED: import the three new modules
├── config.ts                     # MODIFIED: MAX_UPLOAD_BYTES
├── app.controller.ts             # unchanged
├── auth/                         # unchanged
├── common/                       # unchanged
├── database/                     # unchanged
├── imports/
│   ├── imports.module.ts         # owns the five data tables; imports AuthModule
│   ├── imports.controller.ts     # 3 uploads + history
│   ├── imports.service.ts        # transaction, replacement, audit row
│   ├── imports.schema.ts         # Zod: upload fields, row shapes
│   ├── parse-workbook.ts         # header location, month parsing, cell coercion, issue types
│   ├── parse-timesheet.ts
│   ├── parse-salaries.ts
│   └── parse-projects.ts
├── analytics/
│   ├── analytics.module.ts       # imports AuthModule
│   ├── analytics.controller.ts   # /periods /dashboard /departments /productivity /categories
│   ├── projects.controller.ts    # /projects, /projects/:refCode
│   ├── analytics.service.ts      # reads, shapes responses
│   ├── analytics.schema.ts       # Zod: period query
│   └── cost-model.ts             # pure functions — no Nest, no SQL
│   └── analytics.repository.ts   # every SQL read, incl. the un-filtered lifetime aggregate
└── settings/
    ├── settings.module.ts        # owns the settings table; imports AuthModule
    ├── settings.controller.ts
    ├── settings.service.ts
    └── settings.schema.ts
```

Three feature modules, sixteen new files, no folder deeper than one level. `cost-model.ts` is
deliberately free of framework and database code: it is the part of the system that has to be read
and checked by hand against the brief's formulas.

**Nest DI note** (`research.md` §8): `AuthModule` is not `@Global()`, so all three new modules must
list it in `imports` for `@UseGuards(SessionAuthGuard)` to resolve. `DatabaseModule` is global and
needs no import.

## Implementation checkpoints

Four reviewable stops, in order. Each is independently verifiable.

| # | Checkpoint | Delivers | Verified by |
| --- | --- | --- | --- |
| 1 | **Schema and ingestion** | Tables, parsers, validation, transactional replacement, upload and history endpoints | All three files import; a bad file is rejected and changes nothing; a March-only re-upload replaces only March |
| 2 | **Calculations and reconciliation** | `cost-model.ts` and the service that feeds it | The year and each of the twelve months reconcile to the dirham at zero overhead |
| 3 | **Read and settings APIs** | Every reporting endpoint and the assumptions endpoints | Each contract in `contracts/` answers with real figures; monthly answers sum to the year |
| 4 | **End-to-end verification and audit** | `quickstart.md` run in full, the coverage audit, the API contract documented in `apps/api/README.md` | Every check in `quickstart.md` passes and is reported with real output |

## Verification approach

No automated tests (spec FR-050). Verification is:

- `pnpm --filter api lint` (oxlint) and `pnpm --filter api build` (`nest build`, which type-checks).
- `quickstart.md`, run by hand against a running API with `curl`.
- An **isolated database**: verification runs with `DATABASE_PATH` pointed at a temporary file, so
  the development database and every sibling worktree's database are untouched.
- The supplied workbooks in `temp/` are **read only** — never modified, never moved. Malformed
  test files are generated into a scratch directory, not into `temp/`.

## Risks

| Risk | Mitigation |
| --- | --- |
| `read-excel-file` v9's default export returns `Sheet[]`, not rows — a silent wrong-shape bug | Use the `readSheet` named export; recorded in `research.md` §4 and pinned in the first parsing task |
| Double-counting the indirect pool breaks the self-check | The identity in `research.md` §2 shows exactly where; non-billable time is valued at the direct rate only, and Checkpoint 2 does not close until the twelve monthly reconciliations balance |
| Rounding intermediates loses the dirham | Full precision throughout; rounding happens only in the response shaper |
| `SessionAuthGuard` fails to resolve in a new module | `AuthModule` in each module's `imports`; caught immediately at startup |
| A root manifest or lockfile change collides with parallel frontend work | No dependency is added, so `pnpm-lock.yaml` and the root `package.json` are not touched at all |

## Complexity Tracking

No constitutional deviations. Table intentionally empty.

## As built

Implemented 2026-09-10. Differences from the plan above, both found while building:

| Planned | Built | Why |
| --- | --- | --- |
| 13 endpoints | **14** — `POST /imports/sample` added | Backend support for the assessment's "sample data loadable in one click", reusing the same import service methods (FR-022b) |
| Upload size checked in the controller | `MulterModule.registerAsync` limit | Rejects before buffering, and Nest maps the error to `413` itself |
| 3 analytics files | 4 — `analytics.repository.ts` split out | Keeps the SQL in one place and the shaping readable; one provider, one implementation, no interface |

`pnpm --filter api lint` and `pnpm --filter api build` exit 0. Verification results:
[`quickstart.md`](./quickstart.md).

### Migrated to Prisma ORM (after the corrections landed)

Database access moved from handwritten `better-sqlite3` SQL to **Prisma 7.10.0** with the official
`@prisma/adapter-better-sqlite3` adapter, to make the backend easier to read on a
frontend-focused assessment. Behaviour and API contracts are unchanged — every endpoint was
diffed byte-for-byte against its pre-migration response.

| Removed | Replaced by |
| --- | --- |
| `src/database/database.service.ts`, `database.module.ts` | `src/prisma/prisma.service.ts`, `prisma.module.ts` |
| `src/analytics/analytics.repository.ts` (9 raw-SQL methods) | Prisma calls inline in `analytics.service.ts` |
| Three runtime `CREATE TABLE` blocks in module `onModuleInit` | `prisma/schema.prisma` + `prisma/migrations` |
| `SqliteSessionStore` | `PrismaSessionStore` |
| ~25 `prepare(...)` call sites and every `as Row[]` cast | generated Prisma types |
| `better-sqlite3` + `@types/better-sqlite3` as direct dependencies | the adapter's own dependency |

Structure is unchanged otherwise: the same three feature modules, `cost-model.ts` untouched, no
new abstraction layer. Details and the version traps are in [`research.md`](./research.md) §11.

### Reporting scope cut and cost calculation unified

A review found three implementations of "sum cost, track completeness" — `totalsFor`, `costOf`, and
a third inlined in `categories()`. The inlined one had a real defect: a category whose cost was
partial became `null`, and the response total then added that `null` as `0`, silently breaking the
documented invariant that category costs sum to the salary bill.

The fix was to delete the extra reporting rather than repair it three times:

| Change | Effect |
| --- | --- |
| One `costOf` in `cost-model.ts`, returning `{ cost, complete }` | used by the dashboard, departments, project detail and the reconciliation; the three variants and the defect are gone |
| One missing-data policy | cost is always the costable subtotal with a completeness flag; only `profit`, `margin` and `profitability` are withheld |
| Hours-only endpoints (`/periods`, `/productivity`, `/categories`) read rows + assumptions only | no salaries, no prices, no cost model; they keep `monthsCovered` and `hasData` |
| Scope cut (see [`spec.md`](./spec.md), *Reporting scope*) | the removed fields took their calculations with them |
| `buildMonthModels` accumulates per-employee hours in one pass | no per-employee rescan of the month, no per-month scan of all salaries |
| `groupBy` pushes instead of copying the group array per row | was O(n²) |

`analytics.service.ts` went from ~750 to 633 lines. The frontend was updated in the same change.
All figures for complete data are unchanged, field by field.
