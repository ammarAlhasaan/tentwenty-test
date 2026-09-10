# Contract — Ingestion

All five endpoints require a signed-in session. Examples are real responses from the running API.

---

## `POST /imports/timesheet` · `POST /imports/salaries` · `POST /imports/projects`

**Request**: `multipart/form-data`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `file` | file | yes | one `.xlsx` workbook, at most **10 MB** (`MAX_UPLOAD_BYTES`) |
| `year` | text | no | read only by `/imports/salaries`, and only when the workbook states no year of its own |

`200` on acceptance · `422` validation failure · `413` oversized · `400` missing/unexpected field ·
`401` not signed in.

### 200 — accepted

```json
{
  "importId": 4,
  "kind": "timesheet",
  "filename": "timesheet-2025.xlsx",
  "rowsAccepted": 562,
  "rowsSkipped": 0,
  "periodsReplaced": [
    { "year": 2025, "month": 1, "label": "January 2025" },
    { "year": 2025, "month": 2, "label": "February 2025" }
  ],
  "warnings": []
}
```

- `rowsAccepted` is the number of source rows **stored**. Rows are never merged or deduplicated,
  so this equals the workbook's data-row count — 562 for the supplied timesheet, confirmed against
  the stored table.
- `rowsSkipped` counts entirely blank rows that were ignored. It is not an error count.
- `periodsReplaced` lists every `(year, month)` the upload rewrote.
- `/imports/projects` adds `projectsInserted` and `projectsUpdated`, and its `periodsReplaced` is
  always `[]` — it upserts by ref code:

```json
{
  "importId": 1, "kind": "projects", "filename": "project-prices-2025.xlsx",
  "rowsAccepted": 11, "rowsSkipped": 0,
  "projectsInserted": 11, "projectsUpdated": 0, "periodsReplaced": [], "warnings": []
}
```

### Replacement scope — what an upload overwrites

| Kind | Scope comes from | Data outside the scope |
| --- | --- | --- |
| Timesheet | the `(year, month)` values in **data rows** | untouched |
| Salaries | the month **columns in the header**, whether or not their cells hold values | untouched |
| Projects | `ref_code` — upsert only | untouched, never deleted |

**The salary rule matters for the upload UI.** Scope is taken from the header, not the values, so
a corrected workbook whose `March` column is entirely blank **clears** March's stored salaries and
leaves them unknown. Observed: uploading such a file returns `rowsAccepted: 0` with
`periodsReplaced: ["March 2025"]`, March's cost drops to `0` with `completeness.cost: "partial"`,
and April is untouched. Without this, a salary could be corrected but never removed.

Repeat-upload idempotence comes from this replacement alone — confirmed by uploading the supplied
timesheet twice and seeing every figure unchanged.

### 422 — rejected, nothing stored

Observed responses:

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": [
    "3 rows could not be read; no data was changed.",
    "Row 3: Hours must be a number, found \"-\".",
    "Row 4: Month \"Janury 2025\" was not recognised.",
    "Row 5: Employee No. is required."
  ],
  "path": "/imports/timesheet",
  "timestamp": "2026-09-10T09:12:44.031Z"
}
```

| Situation | Observed first message |
| --- | --- |
| Not a workbook | `That file is not a readable .xlsx workbook.` |
| Missing column | `The column "Hours" was not found. Columns found: Month, Employee No., ...` |
| Bare months, no year | `The workbook uses bare month names and states no year. Send a year with the upload.` |
| Oversized (`413`) | `File too large` |
| No `file` field (`400`) | `A spreadsheet is required in the "file" field.` |

Row numbers are **spreadsheet row numbers**. At most 50 row messages are listed; the first message
always states the true total.

**A rejected upload changes nothing — including the history.** Confirmed: after three failed
uploads the dashboard figures and the `GET /imports` count were both unchanged. Parsing and
validation complete before any transaction opens, so there is nothing to roll back.

### Validation per kind

**Timesheet** — required: `Month`, `Employee No.`, `Employee Name`, `Department`, `Category`,
`Ref Code`, `Hours`. Optional: `Type of Expense`, `Designation`, the project/task name column, the
company column, `Description`. A row fails if the month is unrecognised, the employee number,
department, category or ref code is missing, or hours are non-numeric or negative.

**Salaries** — required: `Employee No.`, `Employee Name`, and at least one month column. The year
resolves from a month column, then the title rows above the header, then the `year` field. The
supplied workbook's header is on **row 2** under `Salary Overview 2025 (AED)`, and imports with no
`year` field. **An empty month cell is skipped, never stored as `0`** — absence of a row is how
"unknown" is represented, and `0` is a genuine zero salary.

**Projects** — required: `Ref Code`, `Project (Billable) Name`, `Project Price`. A duplicate ref
code within one file is a row error. A missing or non-positive price is **accepted with a
`price_not_positive` warning**, so the project's hours still cost something and only its revenue
reads as unknown.

### Header and value tolerance

- The header is found by scanning the first 10 rows for the required column names, so it need not
  be row 1.
- Column names match ignoring case, whitespace and punctuation: `Employee No.`, `employee no` and
  `Employee  No` are the same column.
- Months accepted: `January 2025`, `January '25`, `Jan 2025`, `January` (with a year from
  elsewhere), `2025-01`, `01/2025`, and a date cell. The timesheet and the price list use
  different forms and both import unchanged.
- `-`, `""` and whitespace-only all mean "no value" — never `0`.

---

## `POST /imports/sample`

*Backend support for the assessment's "sample data loadable in one click".* No body.

Loads the three workbooks tracked at `apps/api/sample-data/` through **the same service methods**
an upload uses — same parsing, validation, replacement and audit rows. Only the source of the bytes
differs; there is no second ingestion pipeline. Prices load first so the timesheet import can
report unpriced ref codes accurately.

**The one-click button itself belongs to the later frontend upload spec.**

```json
{ "results": [ { "importId": 1, "kind": "projects", "...": "one result per file, same shape as an upload" } ] }
```

---

## `GET /imports`

History, newest first.

```json
{
  "imports": [
    {
      "id": 3, "kind": "timesheet", "filename": "timesheet-2025.xlsx",
      "uploadedAt": "2026-09-10T10:59:12.417Z", "uploadedBy": "demo@tentwenty.local",
      "rowsAccepted": 562,
      "periodsReplaced": [{ "year": 2025, "month": 1, "label": "January 2025" }],
      "warningCount": 0
    }
  ],
  "loaded": { "timesheet": true, "salaries": true, "projects": true }
}
```

`loaded` answers "can the dashboard be trusted yet?" at a glance. An empty database returns `200`
with an empty list and all three `false`.
