# BE-03 Tasks

Ordered and dependency-respecting. `[P]` means it can run in parallel with the task before it —
different files, no shared state.

Scope: `apps/api` only. No test files, no test dependencies, no Swagger, no new runtime
dependency (`plan.md`, Technical Context).

Conventions for every task: ESM imports carry the `.js` extension, as the existing code does;
Zod schemas go in the module's `*.schema.ts`; every error is thrown as a Nest `HttpException` so
the existing `HttpExceptionFilter` shapes it.

---

## Checkpoint 1 — Schema and ingestion

**Done when**: all three supplied workbooks import cleanly, a malformed workbook is rejected with
row-level messages and changes nothing, and a March-only re-upload replaces only March.

### T001 — Upload size limit in configuration
Add `MAX_UPLOAD_BYTES` to `envSchema` in `apps/api/src/config.ts`: coerced integer, minimum
`1024`, default `10 * 1024 * 1024`. Document it in `apps/api/.env.example` with the same default.
Do not touch any other config key.

### T002 — Data tables and `ImportsModule` skeleton
Create `apps/api/src/imports/imports.module.ts`. Declare the five tables from `data-model.md`
(`employees`, `salaries`, `projects`, `timesheet_entries`, `imports`) plus the four indexes in a
`SCHEMA` constant, and run `this.database.db.exec(SCHEMA)` in `onModuleInit`, following the
pattern in `auth/auth.module.ts`. Import `AuthModule`. Register `ImportsModule` in
`app.module.ts`.
**Depends on**: none. **Verify**: the API starts and `sqlite3 <db> ".tables"` lists the new tables
alongside `users` and `sessions`, with the demo user still present.

### T003 — `settings` table and `SettingsModule` skeleton [P]
Create `apps/api/src/settings/settings.module.ts` and `settings.service.ts`. Declare the
`settings` table, seed the two defaults with `INSERT OR IGNORE`
(`billableCategories = ["Projects","Enhancements","Hosting"]`, `monthlyOverhead = 0`), and expose
a `read()` that parses both values through a Zod schema and a `write(partial)`. Import
`AuthModule`. Register in `app.module.ts`.
**Depends on**: none. **Verify**: restarting twice does not reset a hand-edited value.

### T004 — Workbook helpers
Create `apps/api/src/imports/parse-workbook.ts` with no Nest and no SQL:
- `readRows(buffer)` — uses the **`readSheet` named export** of `read-excel-file/node`, not the
  default export (`research.md` §4). Wraps `InvalidInputError` into a "not a readable .xlsx
  workbook" failure.
- `findHeaderRow(rows, requiredColumns)` — scans the first 10 rows; matches names
  case-insensitively, trimmed, treating runs of spaces, `.`, `/` and `-` as equivalent. Returns
  the row index and a column-name → index map, or the list of columns it did find.
- `parseMonth(value, fallbackYear?)` — accepts `January 2025`, `January '25`, `Jan 2025`,
  `January`, `2025-01`, `01/2025` and a `Date` cell. Returns `{ year, month }` or `null`.
- `cellText(value)` / `cellNumber(value)` — treat `null`, `""`, whitespace-only and `-` as absent.
- The `ImportIssue` type (`row`, `message`) and the `Warning` type (`code`, `message`, `context`)
  used by every parser.
**Depends on**: none.

### T005 — Timesheet parser
Create `apps/api/src/imports/parse-timesheet.ts`: `parseTimesheet(buffer)` returning
`{ rows, warnings, issues, rowsSkipped, periods }`. Required and optional columns, and the row
rules, are in `contracts/imports.md`. **Store every row as supplied — no merging, no deduplication** (FR-013a):
those four fields do not determine department, category or expense type, and identical rows are
normally two real entries of work. Idempotence comes from period replacement. Skip blank rows into
`rowsSkipped`. Collect every failing
row into `issues` — never throw on the first one.
**Depends on**: T004.

### T006 — Salary parser [P]
Create `apps/api/src/imports/parse-salaries.ts`: `parseSalaries(buffer, yearFromRequest?)`.
Resolve the year in this order: a month column that states one, the sheet's title rows above the
header, then `yearFromRequest`; fail the file with the documented message if none resolves. The
supplied workbook has its header on **row 2** under a `Salary Overview 2025 (AED)` title — that is
the real case this must handle.

Two rules that are easy to get backwards:
- The **replacement scope is the set of month columns in the header**, returned whether or not any
  of their cells hold values (FR-017). A workbook whose `March` column is entirely blank must still
  report March in its scope, so the import clears March.
- An empty month cell is **skipped, never stored as `0`** — absence of a row is how "unknown" is
  represented, and `0` is a genuine zero (FR-035a).
**Depends on**: T004.

### T007 — Project price parser [P]
Create `apps/api/src/imports/parse-projects.ts`: `parseProjects(buffer)`. `Sales month` is written
`January '25` — a different format from the timesheet, handled by the shared `parseMonth`. A
missing or non-positive price is a `price_not_positive` **warning**, not a row error. A duplicate
ref code within one file is a row error.
**Depends on**: T004.

### T008 — Import persistence
Create `apps/api/src/imports/imports.service.ts`. One method per kind. Each:
1. parses and validates **outside** any transaction;
2. if `issues` is non-empty, throws `UnprocessableEntityException` with the first message stating
   the total and at most 50 row messages (FR-014) — writing nothing;
3. otherwise opens one `db.transaction`, upserts `employees`, deletes the affected
   `(year, month)` rows (or upserts projects by `ref_code`), inserts the parsed rows, and writes
   the `imports` audit row.
Replacement identities and the transaction order are in `data-model.md`. Use one prepared
statement per insert, reused across rows.
**Depends on**: T002, T005, T006, T007.

### T009 — Upload and history endpoints
Create `apps/api/src/imports/imports.controller.ts` with the four routes in
`contracts/imports.md`. Use `FileInterceptor('file', { limits: { fileSize, files: 1 } })` with the
limit from config, and declare the uploaded-file shape as a local four-field interface — no
`@types/multer` (`research.md` §5). Guard every route with `SessionAuthGuard`. Translate multer's
size error into `413` with the documented message. Reject a request with no `file` field as `400`.
**Depends on**: T003, T008.

### T010 — Checkpoint 1 verification
Run `pnpm --filter api lint` and `pnpm --filter api build`. Then, against an isolated
`DATABASE_PATH`, run `quickstart.md` checks **Q0–Q2 and Q6–Q9** and record the real output.
**Depends on**: T009.

---

## Checkpoint 2 — Calculations and reconciliation

**Done when**: the year and each of the twelve months reconcile to the dirham at zero overhead.

### T010a — Tracked sample data and one-click support
Copy the three workbooks from `temp/` into `apps/api/sample-data/`, unmodified, and commit them
(`temp/` is gitignored, so a clean checkout has none). Add `POST /imports/sample` to
`imports.controller.ts`, reading the three files with `readFileSync` and passing the buffers to
**the same** `ImportsService` methods the upload routes use — no second pipeline (FR-022a,
FR-022b). Note in the spec and README that the one-click button belongs to the later frontend
upload spec.
**Depends on**: T009.

### T011 — The cost model
Create `apps/api/src/analytics/cost-model.ts` — pure functions, no Nest, no SQL, taking plain
arrays of timesheet rows, salary rows and projects plus the settings, and returning computed
figures. Implement, per month: direct rate per employee, the indirect pool, the indirect rate,
employee cost per project row. Then the derived figures: employee revenue share, employee
profitability, project profitability, productivity.

Three things a reader cannot infer, and the only places a comment is warranted here:
- non-billable time enters the pool at the employee's **direct rate only** — adding the indirect
  rate counts the pool inside itself and breaks the self-check;
- a month with no billable hours has an undefined indirect rate; its pool becomes **unallocated
  cost** rather than being dropped, so `allocated + unallocated = knownSalaries + overhead` holds;
- an employee with an **unknown** salary is excluded from the cost model's denominators entirely
  (`dr = null`, cost `null`, hours excluded from the indirect-rate basis), so the identity holds
  exactly over the known subset while a separate flag reports that the subset is incomplete. A
  salary recorded as `0` is a genuine zero and stays inside the model.

Also in this file:
- **Completeness** (FR-035a–g): each month carries `poolComplete`; a period's cost is `partial` if
  any month it covers is incomplete, and its revenue is `partial` if any project with hours in it
  has no price. Profit and margin are `null` whenever either is partial.
- **Allocated revenue** (FR-028a): `price x (period hours / lifetime hours)`, where the lifetime
  denominator is passed in from the un-filtered aggregate — never derived from the period rows.

Keep full precision; no rounding in this file. Return `null` for every undefined ratio, and never
clamp a margin (FR-035g).
**Depends on**: none (pure). **Verify**: the figures in `research.md` §2.

### T012 — Analytics reads
Create `apps/api/src/analytics/analytics.service.ts` with the three batched period reads from
`data-model.md` and the standing data-quality warnings (`project_without_price`,
`employee_without_salary`, `employee_without_hours`, `no_billable_hours`,
`period_missing_salaries`, `period_missing_timesheet`). One query per table per request — no
per-row query.
**Depends on**: T002, T003.

### T013 — Rounding and response shaping
In `analytics.service.ts`, add the single place where rounding happens: money and hours to 2 dp,
ratios to 4 dp, `null` preserved as `null`. Nothing upstream of this rounds. The rounder must map
any non-finite value to `null`, so no response can serialise `NaN` or `Infinity`, and it must not
clamp negative margins.
**Depends on**: T011, T012.

### T014 — Checkpoint 2 verification
With the three files loaded into an isolated database, print the year and each month's
`reconciliation` and confirm `balances` is `true` everywhere and total cost is AED 2,400,000.
Run `quickstart.md` checks **Q3–Q5**.
**Depends on**: T013.

---

## Checkpoint 3 — Read and settings APIs

**Done when**: every endpoint in `contracts/` answers with real figures and the twelve monthly
answers sum to the year answer.

### T015 — Period query schema
Create `apps/api/src/analytics/analytics.schema.ts`: `year` required integer, `month` optional
integer 1–12, `.strict()`. Used with `@Query({ schema })` through the existing global pipe.
**Depends on**: none.

### T016 — `/periods`, `/dashboard`
Create `apps/api/src/analytics/analytics.controller.ts` with `GET /periods` and
`GET /dashboard`, guarded by `SessionAuthGuard`. `/periods` must answer `200` with
`hasData: false` on an empty database, never an error.
**Depends on**: T013, T015.

### T017 — `/departments`, `/productivity`, `/categories`
Add the three remaining routes to the same controller, per `contracts/analytics.md`. Employees are
nested inside departments — there is no separate drill-down route.
**Depends on**: T016.

### T018 — `/projects` and `/projects/:refCode` [P]
Create `apps/api/src/analytics/projects.controller.ts`. The list is period-filtered; the detail is
**not** (spec `A-002`) and carries the month, department and employee breakdowns. `404` when a ref
code has neither hours nor a price.
**Depends on**: T013, T015.

### T019 — Settings endpoints [P]
Create `apps/api/src/settings/settings.controller.ts` and `settings.schema.ts` per
`contracts/settings.md`. `PUT` accepts a partial body; an invalid value is `400` and leaves the
stored settings unchanged; `billableCategories` must have at least one entry. `GET` includes
`knownCategories` computed from the loaded timesheet data.
**Depends on**: T003.

### T020 — Checkpoint 3 verification
Run `pnpm --filter api lint` and `pnpm --filter api build`, then `quickstart.md` checks
**Q10–Q17**.
**Depends on**: T016, T017, T018, T019.

---

## Checkpoint 4 — End-to-end verification and completeness audit

### T021 — Document the API
Add an API section to `apps/api/README.md`: the endpoint table, the upload size limit and the new
`MAX_UPLOAD_BYTES` variable, the two assumptions and their defaults, and a pointer to
`specs/004-assessment-backend/contracts/`. Record assumption **A-001** (revenue earned by hour
share) in the README as well — the assessment asks for the assumptions to be stated where the
reviewer will find them.
**Depends on**: T020.

### T022 — Full manual verification
Run `quickstart.md` end to end, in order, against a clean isolated database, and record the real
output of every check. Any failure is fixed and the whole guide is re-run.
**Depends on**: T021.

### T023 — Coverage audit
Complete the audit at the end of `quickstart.md` and record the result in this file:
- every assessment backend requirement in `plan.md`'s coverage table is mapped and covered;
- every planned frontend screen has a complete contract in `contracts/`;
- no placeholder endpoint, stub or `TODO` remains for required backend functionality —
  `grep -rn "TODO\|FIXME\|not implemented" apps/api/src` returns nothing;
- `grep -rn "test\|spec\|mock" apps/api/package.json` shows no testing dependency or script was
  added;
- `git diff --stat main -- apps/web pnpm-lock.yaml package.json` is empty;
- the deliberately excluded stretch goals are named.
**Depends on**: T022.

---

## Task dependency summary

```
T001 ─┐
T002 ─┼─ T008 ─ T009 ─ T010                       (Checkpoint 1)
T003 ─┤    │
T004 ─┴─ T005/T006/T007 ─┘

T011 ─┬─ T013 ─ T014                              (Checkpoint 2)
T012 ─┘

T015 ─┬─ T016 ─ T017 ─┐
T018 ─┤               ├─ T020                     (Checkpoint 3)
T019 ─┘               ┘

T021 ─ T022 ─ T023                                (Checkpoint 4)
```

## Completion

All tasks implemented and verified on 2026-09-10. `pnpm --filter api lint` and
`pnpm --filter api build` both exit 0. The manual procedure and its observed results are in
[`quickstart.md`](./quickstart.md) — 21 checks, all passing, including the self-check
(AED 2,400,000), the lifetime-denominator proof, missing-salary and missing-price propagation,
unclamped negative margins, blank-month salary clearing, and the schema upgrade over a BE-02-era
database.

Two deviations from the task list as written, both simplifications found during implementation:

- **T009's size limit moved to the module.** `MulterModule.registerAsync` applies
  `limits.fileSize`, and Nest maps multer's `LIMIT_FILE_SIZE` to a `413` on its own — so the
  interceptor rejects an oversized upload before buffering it, and the controller keeps only the
  missing-field check. Simpler and stricter than checking `file.size` in the handler.
- **A fourth analytics file, `analytics.repository.ts`.** The service was carrying every SQL
  string as well as the shaping; splitting the queries out kept `analytics.service.ts` readable
  and left one obvious place to check that no query is period-filtered when it should not be. It
  is a provider with one implementation and no interface — not a generic repository.

## Not in this spec

Restating, so nothing is quietly picked up: no `apps/web` change, no automated test or test
dependency, no Swagger, no ORM or migration framework, no new runtime dependency, no permanent
debug endpoint, and no change to the root `package.json` or `pnpm-lock.yaml`.
