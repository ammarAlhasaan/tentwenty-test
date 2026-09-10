# BE-03 Research

Findings that decided the plan. Everything below was checked against the installed versions in
this repository or computed from the three supplied workbooks, not recalled.

Installed versions verified on 2026-09-10: Node 24.21.0 (`.nvmrc`), `@nestjs/common` 12.0.1,
`@nestjs/platform-express` 12.0.1, `express` 5.2.1, `better-sqlite3` 13.0.3,
`read-excel-file` 9.3.10, `zod` 4.5.4, `typescript` 6.0.2.

---

## 1. The data, as it actually is

Read directly from `temp/timesheet-2025.xlsx`, `temp/salaries-2025.xlsx` and
`temp/project-prices-2025.xlsx`.

### Timesheet — sheet `Timesheet`, header on row 1, 562 data rows

Columns, in order: `Month`, `Employee No.`, `Employee Name`, `Type of Expense`, `Department`,
`Designation`, `Category`, `Ref Code`, `Project (Billable) / Task (Unbillable) Name`,
`Company Name (Billable)/ Fixed Costs (Unbillable)`, `Description`, `Hours`.

| Field | Observed values |
| --- | --- |
| `Month` | `January 2025` … `December 2025` (12 distinct, all text) |
| `Employee No.` | 12 distinct, **text** — `10201`–`10210`, `00101`, `00102`. The leading zeros make this a string, never a number |
| `Type of Expense` | `DL`, `IDL` |
| `Department` | `Design`, `Frontend`, `Backend`, `App`, `QA`, `Management` |
| `Category` | `Projects`, `Enhancements`, `Hosting`, `Tentwenty`, `FC - Leaves`, `FC - Meetings`, `FC - Learning`, `FC - Bug Fixes`, `FC - Idle`, `FC - SEO/Marketing`, `FC - Others` |
| `Ref Code` | the 11 priced ref codes, plus `Tentwenty`, plus one `FC - *` code per fixed-cost category |
| `Hours` | numeric on every row; no blanks, no `-`, no negatives |

Notable: `Ref Code` repeats the category name on every non-project row, so the ref code is not a
project key on those rows. Each employee keeps one department, designation and DL/IDL flag for the
whole year.

### Salary overview — sheet `Salary`, **header on row 2**, 12 employees

Row 1 is a title: `[null, "Salary Overview 2025 (AED)", null, ...]`. Row 2 is the header:
`Employee No.`, `Employee Name`, `January` … `December` — **bare month names with no year**. The
year exists only in the row-1 title.

This is the concrete case behind the brief's "header rows are not always in row 1" and "dates
appear as … just `January`". It drives two requirements: find the header by content, and resolve a
bare month name against a year found elsewhere.

Salaries step up in July for every employee. Monthly company total: AED 197,000 (Jan–Jun),
AED 203,000 (Jul–Dec). **Year total AED 2,400,000** — the self-check target.

### Project prices — sheet `Projects`, header on row 1, 11 projects

`Ref Code`, `Project (Billable) Name`, `Project Price`, `Sales month`, `Category`, `Status`.
`Sales month` is written `January '25` — a **different month format from the timesheet's**
`January 2025`. Categories: `Projects` (8), `Enhancements` (2), `Hosting` (1). Total price
AED 5,012,000. Projects span 2–5 months of hours each; none is confined to its sales month.

### Cross-file integrity of the supplied data

| Check | Result |
| --- | --- |
| Timesheet employees without a salary row | none |
| Salary rows without timesheet hours | none |
| Billable ref codes without a price | **`Tentwenty`** only |
| Priced ref codes without hours | none |
| Blank cells, `-` cells, non-numeric hours | none |
| Employee-months with zero logged hours | none (144 of 144 present) |

**Conclusion that shapes the plan**: the supplied files are clean. The brief's messiness —
`-` cells, missing salaries, unpriced ref codes, `May '25` dates, headers below row 1 — is
*mostly* latent. Two of them are real and must be handled to parse these files at all (the row-2
header, the two month formats). The rest must be handled because the brief says to expect them and
because the reviewer will very likely test them by hand. They are specified as behaviour, not as
speculative code paths.

`Tentwenty` is the brief's "ref codes have hours but no price" case, and it resolves cleanly:
`Tentwenty` is not one of the three billable categories, so it is internal time and correctly has
no price. It must not raise a missing-price warning.

---

## 2. The cost model, verified against the data

The assessment's formulas, transcribed exactly:

```
direct cost rate / hour   (per person, per month)
    = that month's salary / that month's total logged hours

indirect cost pool        (per month)
    = salaries of people who logged no hours (support staff)
    + everyone else's non-billable time, valued at their direct rate
    + monthly overhead entered by the user

indirect cost rate / hour (per month)
    = indirect cost pool / billable hours that month

employee cost on a project = hours x (direct rate + indirect rate)
employee revenue share     = project price x (employee hours / total project hours)
employee profitability     = (revenue share - employee cost) / revenue share
project profitability      = (project price - total project cost) / project price
productivity               = billable hours / total hours logged
```

### The model was implemented against the real data and it reconciles

A throwaway script applied the formulas to the three workbooks with overhead at zero:

| Month | Total hours | Billable hours | Salaries | Indirect pool | Indirect rate | Cost allocated | Diff |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| January | 1,634.6 | 1,283.5 | 197,000 | 72,612.93 | 56.5742 | 197,000.00 | 0.000000 |
| February | 1,655.3 | 1,242.2 | 197,000 | 78,620.23 | 63.2911 | 197,000.00 | 0.000000 |
| March | 1,642.9 | 1,230.7 | 197,000 | 78,848.50 | 64.0680 | 197,000.00 | 0.000000 |
| April | 1,652.6 | 1,264.9 | 197,000 | 74,456.54 | 58.8636 | 197,000.00 | 0.000000 |
| May | 1,663.4 | 1,261.1 | 197,000 | 76,736.03 | 60.8485 | 197,000.00 | 0.000000 |
| June | 1,641.0 | 1,222.1 | 197,000 | 81,721.46 | 66.8697 | 197,000.00 | 0.000000 |
| July | 1,646.6 | 1,300.8 | 203,000 | 72,955.92 | 56.0854 | 203,000.00 | 0.000000 |
| August | 1,676.9 | 1,256.1 | 203,000 | 78,883.92 | 62.8007 | 203,000.00 | 0.000000 |
| September | 1,630.2 | 1,259.5 | 203,000 | 78,003.79 | 61.9323 | 203,000.00 | 0.000000 |
| October | 1,688.9 | 1,247.9 | 203,000 | 78,891.29 | 63.2192 | 203,000.00 | 0.000000 |
| November | 1,631.0 | 1,371.0 | 203,000 | 66,409.74 | 48.4389 | 203,000.00 | 0.000000 |
| December | 1,651.8 | 1,325.8 | 203,000 | 71,116.98 | 53.6408 | 203,000.00 | 0.000000 |
| **Year** | **19,815.2** | **15,265.6** | **2,400,000** | | | **2,400,000.00** | **0.000000** |

**The self-check passes exactly**, and it passes *per month*, not only for the year. These figures
are the acceptance targets in `quickstart.md`.

### Why it reconciles — the algebraic identity

This matters, because it tells us which edge cases break the check and which do not.

```
cost = SUM over billable rows of  h x (dr_e + idr)
     = SUM_e (billable_e x dr_e)  +  idr x billableHours
     = SUM_e (billable_e x dr_e)  +  pool                      [idr = pool / billableHours]
     = SUM_e (billable_e x dr_e)  +  SUM_{no hours} salary
                                  +  SUM_e (nonbillable_e x dr_e)
                                  +  overhead
     = SUM_e (loggedHours_e x dr_e) + SUM_{no hours} salary + overhead
     = SUM_{e with hours} salary_e  + SUM_{no hours} salary_e  + overhead   [dr_e = salary_e / loggedHours_e]
     = total salaries + overhead
```

Four consequences:

1. **Anything double-counted breaks it immediately.** In particular, a person's non-billable time
   must be valued at their *direct* rate only — adding the indirect rate to it counts the pool
   inside itself.
2. **Zero billable hours in a month is a genuine break.** `idr` is undefined, the pool cannot
   attach to any project, and `cost < salaries` by exactly the pool. This is surfaced as
   *unallocated cost*, not hidden, so `allocated + unallocated = salaries + overhead` still holds.
3. **An unknown salary cannot be quietly treated as `0`.** Doing so would let the identity keep
   holding while silently understating cost — a balanced check over an incomplete dataset, which is
   the most misleading thing this system could produce. Instead, an employee whose salary is
   unknown is **excluded from the cost model's denominators entirely**: their `dr` is `null`, their
   cost is `null`, and their hours are excluded from the billable-hours basis for the indirect
   rate. The identity then holds exactly over the *known* subset:

   ```
   allocatedCost + unallocatedCost = knownSalaries + overhead
   ```

   and a separate flag says the subset is not everything. Arithmetic balance and dataset
   completeness are two different facts and are reported as two different fields (spec `A-005`,
   FR-037a).

   Note the blast radius: one missing salary makes that month's *pool* incomplete, and the pool
   feeds the indirect rate, which prices **every** project row in that month. So the completeness
   flag is per month and propagates to every period that contains it — not just to the rows
   belonging to the person whose salary is missing (FR-035c).
4. **A salary recorded as `0` is not the same input.** It is a genuine zero: `dr = 0`, the person
   is fully inside the model, and nothing is marked partial (FR-035a).

### Rounding

Every intermediate value stays a full-precision JavaScript number; only the response is rounded.
The table above was computed that way and lands on `0.000000` — rounding intermediates would not.
Rounding at the boundary: money 2 dp, hours 2 dp, ratios 4 dp as fractions in `0..1`.
"To the dirham" is checked as `|difference| < 0.005`.

---

## 3. Period filtering and revenue allocation

The dashboard must show "cost, revenue and margin for a selected period, with a year and month
filter". Cost is inherently monthly. A price is not: a project has one price and 2–5 months of
hours.

| Option | Full-year total | January figure | Verdict |
| --- | --- | --- | --- |
| A — recognise the whole price in its sales month | 5,012,000 | 560,000 against 197,000 of cost | Rejected: months with no sale look loss-making, months with a sale look impossible |
| B — allocate by the period's share of the project's **lifetime** hours | 5,012,000 | 237,590.90 | **Chosen** |
| C — allocate by the period's share of the period's own hours | 21,000,000+ | the full price, repeatedly | Rejected: credits every period with the whole price; not a total |

### What this is, and what it is not

It is an **hour-based reporting allocation**, and the field is named `allocatedRevenue` to say so.
It is **not** a revenue-recognition rule, and the assessment does not prescribe one. What the
assessment does supply is an hour-share split of a price for *employee revenue share*; option B
extends that same idea across periods, which is the only reading consistent with the brief's own
arithmetic. The naming matters: calling it `revenue` would imply an accounting basis nobody
specified.

### The denominator is lifetime, and that is the whole trick

```
allocatedRevenue(project p, period P) = price(p) x  hours(p, P)
                                                   ------------------------------
                                                   hours(p, all loaded periods)
```

The period filter narrows the **numerator only**. The denominator is read separately, with one
batched aggregate over the whole table:

```sql
SELECT ref_code, SUM(hours) AS lifetime_hours FROM timesheet_entries GROUP BY ref_code;
```

Getting this wrong is the single easiest way to produce numbers that look plausible and are wrong.
If the denominator were also filtered to the requested month, every month would be credited with
`price x (h/h)` — the entire price — and the year would total far more than was ever sold.

**One rule, used everywhere**: dashboard totals, the project list, project detail's monthly
breakdown, department figures and employee revenue shares all divide by the same lifetime total.

**Consequence, documented in the contracts and the README**: allocation is relative to the data
currently loaded. Importing more hours for a project **revises the allocated revenue already
reported for earlier periods** — the price is unchanged, but each period's share of it shrinks.
That is inherent to any hour-share allocation and is stated rather than hidden.

### Verified against the data

The twelve monthly allocations sum to exactly AED 5,012,000, the sum of every price, and each
project's monthly allocations sum to exactly its own price. That is the property that makes the
choice safe: nothing is invented and nothing is lost.

`bookedRevenue` — the total price of projects whose *sales month* falls in the period — is kept as
a separate field so the sales view is not discarded. For March 2025 the two differ (330,000 booked
against 311,011.81 allocated); over the full year they converge on 5,012,000.

### Project lifetime profitability is untouched

`(price - total project cost) / price`, exactly as the assessment writes it. Allocation splits a
price across periods for reporting; it never enters the project's own profitability arithmetic.

Corollary (spec `A-002`): **project detail is never period-filtered.** A project's price only means
something against all of its hours.

---

## 4. `read-excel-file` 9.3.10 — a version trap, verified

The installed v9 API differs from the v8 API that most examples show. Verified by running it:

| Call | Returns |
| --- | --- |
| `readXlsxFile(input)` (default export) | `Sheet[]` — an array of `{ sheet, data }`, **not** rows |
| `readXlsxFile(input, { getSheets: true })` | the same `Sheet[]` |
| `readSheet(input, { sheet })` | `Row[]` — the rows, which is what we want |

There is **no `readSheetNames` export** in this version; the sheet option is `sheets` (plural) on
the default export and `sheet` (singular) on `readSheet`. Writing `readXlsxFile(file)` and
treating the result as rows silently yields one "row" that is an object — a bug that type-checks
in loose code and fails at runtime.

**Decision**: use the named `readSheet` export, called with the in-memory `Buffer`.

Also verified:

- `readSheet(Buffer)` works — no temporary file needed.
- Reading a non-workbook throws `InvalidInputError: Doesn't look like an '.xlsx' file`. This is the
  content-based file-type check; the client-supplied MIME type and extension are not trusted.
- Cells come back already typed: numbers as `number`, text as `string`, date-formatted cells as
  `Date`. Employee numbers arrive as strings, preserving `00101`.
- Empty cells arrive as `null`.

The schema-driven `parseSheetData` / `{ schema }` mode is **not** used: it validates column by
column against a fixed header position and produces its own error objects, which would mean a
second validation vocabulary alongside Zod and no control over the row-level messages the brief
asks for. Rows are read raw and validated with Zod, which is the framework already in the project.

---

## 5. File upload — no new dependency needed

`@nestjs/platform-express` 12.0.1 declares `multer@2.2.0` as a **direct dependency**, so
`FileInterceptor` from `@nestjs/platform-express` works with nothing added to `apps/api`.
Verified in `node_modules/.pnpm/multer@2.2.0`.

- Nest 12 ships its own `MulterOptions` interface and does not reference `Express.Multer.File`, so
  `@types/multer` is not needed for the interceptor options.
- With no `storage` or `dest` option, multer uses memory storage and the file arrives as a
  `Buffer` — exactly what `readSheet` takes. No temp file, no cleanup, nothing on disk. This also
  satisfies `A-008` (originals are not retained) by construction.
- `limits: { fileSize, files: 1 }` rejects an oversized upload before it is buffered.

**The uploaded-file type**: `multer@2.2.0` ships no typings, and `@types/multer` on
DefinitelyTyped targets multer 1.4.x. Installing types for a different major than the installed
runtime is a worse trade than declaring the four fields we actually read
(`originalname`, `mimetype`, `size`, `buffer`) as a local interface in the imports module. That is
the decision; it adds no dependency and no ambient global.

**Net new dependencies for BE-03: none.**

---

## 6. `better-sqlite3` 13.0.3 — transactions and batching

- `db.transaction(fn)` returns a function that runs `fn` inside `BEGIN`/`COMMIT`, rolling back on
  any throw. It is synchronous, which suits `better-sqlite3` and gives FR-019 (all-or-nothing)
  directly. Nothing async may be awaited inside it — parsing and validation therefore complete
  *before* the transaction opens, which is the same ordering FR-011 requires anyway.
- Prepared statements are reused across rows; 562 inserts run as one prepared statement in one
  transaction.
- `PRAGMA foreign_keys = ON` and WAL are already set by `DatabaseService`.

**Query shape**: the whole dataset is 562 timesheet rows, 144 salary rows and 11 projects. Every
calculated endpoint reads the period's rows once with three flat `SELECT`s (timesheet, salaries,
projects) and computes in memory. There is no per-row query and no N+1: the cost model needs
whole-month aggregates before it can value any single row, so a row-at-a-time approach would be
both slower and wrong.

**Indexes**, each justified by a query that exists:

| Index | Serves |
| --- | --- |
| `timesheet_entries (year, month)` | every period-filtered read |
| `timesheet_entries (ref_code)` | project detail and the project list |
| `timesheet_entries (employee_no, year, month)` | per-person monthly totals for the direct rate |

`salaries` is keyed by `(employee_no, year, month)` and `projects` by `ref_code`, so their primary
keys already serve their lookups.

---

## 7. Schema evolution without deleting the database

BE-02 creates its tables with `CREATE TABLE IF NOT EXISTS` in `AuthModule.onModuleInit`, noting
that changing a column would mean deleting the file. BE-03 **adds** tables and touches neither
`users` nor `sessions`, so an existing development database keeps its demo user and live sessions.
The same `IF NOT EXISTS` pattern is followed, in the module that owns each table. No ORM and no
migration framework is added: there is nothing to migrate.

---

## 8. Wiring `SessionAuthGuard` into new modules

`SessionAuthGuard` injects `AuthService`. `AuthService` is provided by `AuthModule` and is in its
`exports`, but `AuthModule` is **not** `@Global()`. A new module that writes
`@UseGuards(SessionAuthGuard)` without importing `AuthModule` fails at startup with a Nest
dependency-resolution error.

**Decision**: `ImportsModule`, `AnalyticsModule` and `SettingsModule` each list `AuthModule` in
`imports`. The guard stays route-scoped rather than global, because `GET /health` must remain
public — which is exactly why BE-02 did not register it globally.

`DatabaseModule` *is* `@Global()`, so `DatabaseService` needs no import.

---

## 9. Validation and error shape — reused, not re-invented

- Query and body validation use the existing `StandardSchemaValidationPipe`, already registered
  globally in `main.ts`, with Zod schemas passed per-parameter — the same
  `@Body({ schema })` / `@Query({ schema })` pattern `AuthController` uses.
- Every failure goes through the existing `HttpExceptionFilter`, so upload errors carry the same
  `{ statusCode, error, message[], path, timestamp }` body as every other error. Row-level errors
  fit the existing `message: string[]` array without a new shape.
- Rejected uploads use **422 Unprocessable Entity** (a well-formed request whose *content* fails
  validation), reserving 400 for a malformed request and 413 for an oversized one.

---

## 10. Alternatives considered and rejected

| Considered | Rejected because |
| --- | --- |
| `xlsx` / SheetJS | `read-excel-file` is already installed and reads these files; adding a second parser adds a dependency for nothing |
| An ORM (Prisma, Drizzle) or a migration tool | Six tables, hand-written SQL, no deployed database to evolve. Contradicts Principle II |
| Accepting partial imports (store valid rows, report bad ones) | Leaves the database in a state nobody asked for and makes "re-upload the corrected month" ambiguous. All-or-nothing is what FR-012 and the brief's re-upload rule imply |
| Storing computed figures | Assumptions are changeable at runtime; a cached figure would be stale the moment overhead changes. The dataset recomputes in milliseconds |
| A generic `POST /imports?kind=` | Three explicit routes make the contract, the validation and the frontend's three upload targets obvious |
| A separate `GET /departments/:name` drill-down | Six departments and twelve people. Nesting the employees inside `GET /departments` removes an endpoint and a round trip |
| Swagger/OpenAPI | Excluded by the spec; Markdown contracts are published in `contracts/` |


---

## 11. Prisma ORM 7.10.0 — the migration off handwritten SQL

Added after BE-03 shipped, to cut repetitive SQL out of the backend. Every fact below was checked
against the **installed** package (its `prisma init` template, CLI help, `.d.ts` files and real
migration runs) rather than documentation pages, because v7 is recent and several published pages
now redirect to v8.

### Version choice — `latest` is a release candidate

```
npm view prisma dist-tags        -> latest: 8.0.0-rc.13   prev: 7.10.0
npm view @prisma/client dist-tags-> latest: 7.10.0
```

`prisma@latest` currently resolves to **8.0.0-rc.13**, a release candidate. Installing "the latest
stable" therefore means pinning explicitly: **`prisma@7.10.0` and `@prisma/client@7.10.0`**, the
matching stable pair. `prisma generate` prints an upgrade nag to 8.0.0-rc.13; it is correctly
ignored.

`engines.node` for 7.10.0 is `^20.19 || ^22.12 || >=24.0` — satisfied by the pinned Node 24.21.0
and by the Node 26.4.0 used here.

### What changed in v7 and cost time

| v6 habit | v7 reality |
| --- | --- |
| `generator client { provider = "prisma-client-js" }` | `provider = "prisma-client"`, and `output` is **required** |
| Client generated into `node_modules/.prisma` | Generated **TypeScript** into your source tree, compiled by your own tsconfig |
| `url = env("DATABASE_URL")` in the schema's `datasource` | `datasource` holds only `provider`; the URL moves to a config file |
| `prisma.config.ts` | **`prisma7.config.ts`** — the filename is version-stamped |
| `migrate diff --to-schema-datamodel <path>` | `migrate diff --to-schema <path>`; `--from-url` becomes `--from-config-datasource` |

The generator is set to `moduleFormat = "esm"` so the emitted code carries `.js` specifiers, which
is what this project's `"type": "module"` + `moduleResolution: nodenext` needs. Output goes to
`src/generated/prisma` (inside `rootDir`, so `nest build` compiles it) and is gitignored;
`postinstall` and `build` both run `prisma generate`.

### Driver adapter: required, and it brings better-sqlite3 back

Prisma 7 has no Rust query engine — `prisma --version` reports `Query Compiler: enabled`, and
SQLite access goes through a driver adapter. The only two official SQLite adapters are
`@prisma/adapter-better-sqlite3` and `@prisma/adapter-libsql`; there is no `node:sqlite` adapter.
The better-sqlite3 one is right for a plain local file, so `better-sqlite3` stays in the tree —
but as the **adapter's own dependency**, not something `apps/api` declares.

That adapter asks for `better-sqlite3@^12.6.0`, and **12.x ships no prebuilt binaries**: its
install script is `prebuild-install || node-gyp rebuild`. With this repository's `allowBuilds`
policy the script is skipped and the native module fails to load at runtime — the first start
crashed with a `bindings` error listing thirteen paths it tried. 13.x ships prebuilds for every
platform and needs no install script, which is why BE-01 chose it. A pnpm `overrides` entry pins
`better-sqlite3: ^13.0.3`; the adapter only uses the constructor, `prepare`, `exec`, `pragma` and
`transaction`, all unchanged across that major, and the whole verification suite passes on it.

### Two schema details SQLite forces

- **`sessions.expires_at`** holds `Date.now()` — about `1.78e12`, past Prisma's 32-bit `Int`. It is
  modelled `BigInt`; the column stays `INTEGER` (SQLite gives `BIGINT` integer affinity), so
  pre-existing rows read unchanged. Verified: a session cookie written **before** the migration
  still authenticates afterwards.
- **`users.created_at`** was `DEFAULT (datetime('now'))`. SQLite introspection cannot tell a
  function default from a string default — `db pull` returns `@default("datetime('now')")` — so
  `@default(dbgenerated(...))` never converges and `migrate diff` reports drift forever. The
  default is dropped and the value written by `AuthService.createUser`, in SQLite's own
  `YYYY-MM-DD HH:MM:SS` shape so old and new rows match. `created_at` is never read by an endpoint.

`COLLATE NOCASE` on `users.email` is likewise inexpressible in Prisma. Rather than keep a
collation the schema cannot describe, the address is lowercased in `createUser` — it was already
lowercased on the way in by the Zod login schema, so one rule in one place replaces it.

### Baselining an existing database

Prisma's documented existing-project workflow, using two migrations so both paths converge:

- `0_init` — the schema BE-03 created at runtime. An existing database already matches it.
- `1_align_with_prisma_schema` — generated with
  `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` against a
  database holding only the baseline. It rebuilds five tables with `INSERT..SELECT`, because
  SQLite declares a non-INTEGER `PRIMARY KEY` nullable and the baseline's `email` column carried
  `COLLATE NOCASE`.

| Path | Commands | Result |
| --- | --- | --- |
| Fresh | `prisma migrate deploy` | both applied, `migrate diff` → *No difference detected* |
| Existing | `prisma migrate resolve --applied 0_init` then `prisma migrate deploy` | `1` applied, *No difference detected*, all row counts and values identical |

Nothing is reset, deleted or recreated. Verified on a copy of a populated database, never on the
working one.
