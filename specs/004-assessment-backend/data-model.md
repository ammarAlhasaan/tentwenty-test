# BE-03 Data Model

SQLite, through **Prisma ORM 7.10.0** and the official `@prisma/adapter-better-sqlite3` driver
adapter. Six new tables alongside BE-02's `users` and `sessions`, so an existing development
database keeps its demo user and live sessions — **upgrading does not require deleting the
database file**.

> **Migrated to Prisma after BE-03 shipped.** The tables below are unchanged; what changed is how
> they are declared and queried. [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma)
> is now the single description of the schema, every model maps onto the same snake_case columns
> with `@map`/`@@map`, and there is no `CREATE TABLE` at runtime any more — migrations in
> `apps/api/prisma/migrations` are applied by `pnpm --filter api db:deploy` before the API starts.
> The SQL in this document is what those migrations produce; it is kept because it remains the
> clearest statement of the shape and the constraints.

## Applying the schema

| Situation | Commands |
| --- | --- |
| Fresh database | `pnpm --filter api db:deploy` |
| Database created before Prisma | `pnpm --filter api db:adopt` then `pnpm --filter api db:deploy` |

`db:adopt` is `prisma migrate resolve --applied 0_init` — Prisma's documented baselining step. It
records that the pre-Prisma schema is already present without re-running it; `db:deploy` then
applies `1_align_with_prisma_schema`, which rebuilds five tables in place with `INSERT..SELECT`
because SQLite declares a non-INTEGER `PRIMARY KEY` nullable and `users.email` carried a
`COLLATE NOCASE` that Prisma cannot express. No data is lost and nothing is recreated from empty.
After either path `prisma migrate diff` reports **no difference**.

## Ownership

Modules no longer create their own tables; ownership below is about which feature reads and
writes them.

| Module | Tables |
| --- | --- |
| `AuthModule` | `users`, `sessions` |
| `ImportsModule` | `employees`, `salaries`, `projects`, `timesheet_entries`, `imports` |
| `SettingsModule` | `settings` |

## Conventions

- **Money** is stored as `REAL` in AED. The figures are five- and six-digit salaries and prices;
  double precision is exact well beyond the dirham, and the reconciliation was verified to
  `0.000000` at full precision.
- **Hours** are `REAL`, one decimal in the source data.
- **Periods** are stored as two integers, `year` and `month` (1–12) — never as a formatted string.
  Every filter, sort and range query is then a plain integer comparison.
- **Employee numbers** are `TEXT`. `00101` is not `101`.
- **Timestamps** are ISO-8601 text, matching BE-02's `created_at`. `users.created_at` is written
  by the application rather than by a SQL default: a function default cannot round-trip through
  SQLite introspection, so Prisma would report permanent drift against it.
- **`sessions.expires_at`** is milliseconds since the epoch, modelled as `BigInt` — the value
  exceeds Prisma's 32-bit `Int`, and the column stays `INTEGER` so existing rows read unchanged.

---

## `employees`

One row per person known to the system, from either file. Identity only — the department,
designation and DL/IDL flag live on each timesheet row, because they belong to the period the row
describes rather than to the person forever.

```sql
CREATE TABLE IF NOT EXISTS employees (
  employee_no TEXT PRIMARY KEY,
  name        TEXT NOT NULL
);
```

Written by both the timesheet and the salary import, as an upsert on `employee_no`; the most
recent import wins the display name. A person in the timesheet but not the salary sheet, or the
reverse, is a normal row here and a warning elsewhere.

## `salaries`

One row per person per calendar month.

```sql
CREATE TABLE IF NOT EXISTS salaries (
  employee_no TEXT NOT NULL REFERENCES employees (employee_no),
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,
  amount      REAL NOT NULL,
  PRIMARY KEY (employee_no, year, month)
);
```

The primary key is the replacement identity and the lookup index; no separate index is added.

**Absence and zero are different states, and the table encodes them differently** (FR-035a):

| State | Storage |
| --- | --- |
| salary is genuinely `0` | a row with `amount = 0` |
| salary is unknown | **no row at all** |

`amount` is therefore `NOT NULL`: a blank cell is skipped rather than stored as a null, so "no
row" is the single, unambiguous representation of unknown. Every read distinguishes the two, and
the cost model treats them differently — `0` gives a direct rate of `0`, absence gives `null`.

## `projects`

One row per priced item, from the project-price workbook.

```sql
CREATE TABLE IF NOT EXISTS projects (
  ref_code    TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       REAL,
  sales_year  INTEGER,
  sales_month INTEGER,
  category    TEXT,
  status      TEXT
);
```

`price` is nullable: a project row with a blank price is loaded and warned about, not rejected, so
that its hours still cost something and only its revenue reads as unknown. `sales_year` and
`sales_month` are nullable for the same reason and feed the `bookedRevenue` figure only.

## `timesheet_entries`

One row per timesheet line. This is the only table with row-level granularity, and it is the
grain the whole cost model works from.

```sql
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  employee_no     TEXT NOT NULL REFERENCES employees (employee_no),
  employee_name   TEXT NOT NULL,
  type_of_expense TEXT,
  department      TEXT NOT NULL,
  designation     TEXT,
  category        TEXT NOT NULL,
  ref_code        TEXT NOT NULL,
  task_name       TEXT,
  company_name    TEXT,
  description     TEXT,
  hours           REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timesheet_period   ON timesheet_entries (year, month);
CREATE INDEX IF NOT EXISTS idx_timesheet_ref      ON timesheet_entries (ref_code);
CREATE INDEX IF NOT EXISTS idx_timesheet_employee ON timesheet_entries (employee_no, year, month);
```

`employee_name`, `department` and `designation` are denormalised onto the row deliberately: they
are what the spreadsheet recorded for that month, and a later reorganisation must not silently
rewrite history.

**One source row in, one row stored. Nothing is merged (FR-013a).** An earlier draft of this plan
summed rows sharing `(month, employee, ref code, description)`, and that was wrong twice over:
those four fields do not determine department, designation, category or expense type, so merging
could collapse two rows that a department or category drilldown must keep apart; and two identical
rows are normally two real entries of work, not one entry recorded twice. Idempotence does not need
deduplication — deleting the period before inserting it already guarantees that uploading the same
file twice yields exactly the same table.

There is **no foreign key to `projects`**. A ref code with hours and no price is an expected state
the brief names explicitly, and a constraint would turn it into an import failure.

Each index is justified in `research.md` §6 by a query that exists.

## `imports`

The audit trail behind `GET /imports`.

```sql
CREATE TABLE IF NOT EXISTS imports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL,
  filename      TEXT NOT NULL,
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now')),
  uploaded_by   INTEGER REFERENCES users (id),
  rows_accepted INTEGER NOT NULL,
  periods       TEXT NOT NULL,
  warnings      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_imports_uploaded_at ON imports (uploaded_at DESC);
```

- `kind` is `timesheet` | `salaries` | `projects`.
- `periods` is a JSON array of `{ year, month }` — the periods this upload wrote. For a
  project-price upload it is `[]`.
- `warnings` is a JSON array of the warning objects returned to the client, so the history shows
  what was flagged at the time.
- Only **accepted** imports are recorded. A rejected upload writes nothing at all, including here
  — that is what makes FR-012 verifiable by inspection.
- The row is written inside the same transaction as the data it describes.

JSON in a text column is the right call for two arrays that are only ever read whole and never
queried by their contents. Separate tables for them would be structure without a query.

## `settings`

```sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

| Key | Value | Default |
| --- | --- | --- |
| `billableCategories` | JSON array of category names, at least one entry | `["Projects","Enhancements","Hosting"]` |
| `monthlyOverhead` | JSON number, AED, finite, `>= 0` | `0` |

Seeded on first start with `INSERT OR IGNORE`, so restarting never resets a changed value and the
self-check passes out of the box. Read through a Zod schema on every read, so a hand-edited row
cannot put a bad value into the cost model.

---

## Import replacement rules

The identity that decides what an upload replaces. This is the whole of FR-016 to FR-020.

| Kind | Replacement scope comes from | Effect on data not in the file |
| --- | --- | --- |
| Timesheet | the `(year, month)` values appearing in **data rows** | Untouched |
| Salaries | the month **columns present in the header**, whether or not their cells hold values | Untouched |
| Projects | `ref_code` | Untouched — upsert only, never delete |

**Timesheet** — for each distinct `(year, month)` appearing in a data row:

```sql
DELETE FROM timesheet_entries WHERE year = ? AND month = ?;   -- then insert that month's rows
```

**Salaries** — the scope is the **header**, not the values (FR-017, FR-017a). For each month
column present:

```sql
DELETE FROM salaries WHERE year = ? AND month = ?;            -- then insert the non-blank cells
```

This distinction matters. A corrected workbook whose `March` column is entirely blank must
**clear** March's stored salaries and leave them unknown — otherwise a salary could be changed but
never removed, and stale figures would survive a correction that was meant to delete them. Taking
the scope from the values instead would make that month invisible to the importer and silently
preserve the old data.

A file containing only March rewrites only March. A file containing the whole year rewrites the
whole year. Either way, uploading the same file twice yields identical data (FR-020), and no month
is ever appended to.

**Repeat-upload idempotence comes from this replacement alone.** Rows are never deduplicated to
achieve it (FR-013a) — see the note on `timesheet_entries` below.

**Projects** — `INSERT ... ON CONFLICT(ref_code) DO UPDATE SET ...`. A project omitted from a
re-upload keeps its price (`A-005`): a partial catalogue is far more likely than an intended
deletion, and nothing in the assessment requires removing a project.

## Transaction boundaries

One Prisma interactive transaction (`prisma.$transaction(async (tx) => ...)`) per upload,
wrapping, in order:

1. upsert `employees`
2. delete the affected periods
3. insert the parsed rows
4. insert the `imports` row

Parsing and validation complete **before** the transaction opens. If any row fails validation
nothing is written, no `imports` row appears, and the response is a 422 listing the failures —
so a failed import is indistinguishable from an import that never happened (FR-012).

Prisma rolls the transaction back on any throw, so a mid-insert failure (a disk error, a
constraint violation) leaves the database exactly as it was. Rows are inserted with `createMany`
rather than one statement per row. (`createMany`'s `skipDuplicates` is not supported on SQLite;
where insert-if-absent is needed — seeding settings — an `upsert` with an empty `update` does the
same job.)

## What the cost model reads

Per request, four reads issued together with `Promise.all`, then everything is computed in memory:

```ts
this.prisma.timesheetEntry.findMany({ where: period })
this.prisma.salary.findMany({ where: period })
this.prisma.project.findMany()
this.prisma.timesheetEntry.groupBy({ by: ['refCode'], _sum: { hours: true } })  // lifetime denominator
```

The fourth is deliberately **not** period-filtered: it is the lifetime denominator for revenue
allocation (spec `A-002`, `research.md` §3). Narrowing it by the requested period would credit
every period with the project's entire price.

No per-row query, no N+1. The cost model needs whole-month aggregates — total logged hours per
person, total billable hours — before it can value any individual row, so the batch read is not an
optimisation but the only correct shape. `projects` is 11 rows and is read whole.

Project detail is the one endpoint that reads by `ref_code` across all periods (`A-002`), served
by `idx_timesheet_ref`; it still needs every month's rates, so it reads those months' salaries and
timesheet rows in the same batched way.


---

## Sample data (not a table)

`temp/` is gitignored, so the three supplied workbooks are absent from a clean checkout. They are
therefore copied — unmodified — into a tracked directory (FR-022a):

```
apps/api/sample-data/
├── timesheet-2025.xlsx
├── salaries-2025.xlsx
└── project-prices-2025.xlsx
```

Read-only fixtures, byte-identical to the originals in `temp/`, verified by checksum. They are not
retained uploads and have nothing to do with `A-011`.

`POST /imports/sample` reads these three files from disk and feeds them through **the same**
`ImportsService` methods an ordinary upload uses — same parsing, same validation, same
transactional replacement, same audit rows (FR-022b). There is no second ingestion pipeline and no
special-cased data path; the only difference is where the bytes came from. The one-click button
that calls it belongs to the later frontend upload spec.
