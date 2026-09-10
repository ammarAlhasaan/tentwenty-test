# BE-03 HTTP Contracts

Markdown, not OpenAPI — no Swagger dependency is added (spec, Out of Scope).

Every example in these files is a **real response** captured from the running API with the three
supplied workbooks loaded, not an illustration.

| File | Endpoints |
| --- | --- |
| `imports.md` | `POST /imports/timesheet`, `POST /imports/salaries`, `POST /imports/projects`, `POST /imports/sample`, `GET /imports` |
| `analytics.md` | `GET /periods`, `GET /dashboard`, `GET /projects`, `GET /projects/:refCode`, `GET /departments`, `GET /productivity`, `GET /categories` |
| `settings.md` | `GET /settings`, `PUT /settings` |

## Rules that apply to every endpoint here

- **Authentication.** All of them require a signed-in session (`SessionAuthGuard`, BE-02). An
  anonymous caller gets `401`. `GET /health` and the `/auth/*` routes are unchanged by BE-03.
- **Origin.** The global `OriginCheckGuard` runs first, as it does today.
- **Errors** use the shape established in BE-01
  (`specs/001-backend-foundation/contracts/errors.md`):

  ```json
  {
    "statusCode": 422,
    "error": "Unprocessable Entity",
    "message": ["Row 3: Hours must be a number, found \"-\"."],
    "path": "/imports/timesheet",
    "timestamp": "2026-09-10T09:12:44.031Z"
  }
  ```

- **Period parameters.** Every period-filtered endpoint takes `year` (required, integer) and
  `month` (optional, 1–12). Omitting `month` means the whole year. An invalid value is `400`.

## Number contracts

| Kind | Range | Rounding |
| --- | --- | --- |
| Hours | `>= 0` | 2 dp |
| Money | any | 2 dp |
| `productivity`, `shareOfHours`, `shareOfTotal`, `lifetimeShareOfHours` | `0..1` | 4 dp |
| `margin`, `profitability` | **unbounded, frequently negative, can be below `-1`** | 4 dp |

- **Margins are never clamped.** A project costing far more than its price reports what the
  formula gives — a real observed value is `-467.7762`.
- **Undefined is `null`**, never `0`. No field ever serialises as `NaN` or `Infinity`.
- **Currency** is AED throughout, stated once per response as `"currency": "AED"`.

## Completeness — one policy, everywhere

Arithmetic and completeness are **two separate facts**, and the rule is the same on every endpoint
that reports cost:

> **A cost figure is always the cost of what could be costed. `completeness` says whether that is
> everything. Anything divided by an incomplete input is `null`.**

```json
"completeness": {
  "cost": "partial",
  "revenue": "complete",
  "issues": [
    {
      "code": "employee_without_salary",
      "message": "10201 logged hours in March 2025 with no salary on record. Every allocated cost in that month covers only part of the work.",
      "context": { "employeeNo": "10201", "year": 2025, "month": 3 }
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `cost` | `partial` when any month in scope has an employee with logged hours and no salary |
| `revenue` | `partial` when any project with billable hours in scope has no usable price |
| `issues` | the reasons, recomputed on read — uploading the missing file makes them disappear |

What this guarantees:

1. **A partial cost is a partial cost, not a total.** It is the cost of the rows that could be
   costed. It does **not** tell you how much is missing — the missing salary is unknown, so the
   size of the gap is unknowable. Present it as "cost so far", never as the period's cost.
2. **`profit`, `margin` and `profitability` are withheld — `null` — whenever their inputs are
   partial.**
3. **One missing salary marks the whole month partial**, not just that person's rows: their
   non-billable time is missing from the indirect pool, and the pool prices every row in that
   month. A colleague whose own salary is on record still has an understated cost.
4. **Completeness is reported per group.** Each department, employee and project row carries its
   own `costComplete`, so a gap in one month does not discredit figures from the others.
5. **A gap never blanks a period.** A single missing salary in March leaves the year's cost
   readable and flagged, rather than erasing it.

`reconciliation` stays alongside it as diagnostic detail — `knownSalaries`, `allocatedCost`,
`uncostedIndirectCost` — so the size of what *is* known stays inspectable.

**The cost model's formula is never bent to make the arithmetic tie.** The indirect cost rate
divides the pool by **all** billable hours that month, as the assessment specifies — not by the
hours of employees who happen to have a salary on record. Narrowing that denominator would make
colleagues absorb a missing person's share. The unattributable remainder is reported as
`reconciliation.uncostedIndirectCost`.

**Hours-only endpoints carry no completeness block.** `/periods`, `/productivity` and
`/categories` report no cost, so cost and revenue completeness do not apply. They still report
coverage: `period.monthsCovered` and `period.hasData` make an unuploaded month visible.

## Warning and issue codes

| `code` | Raised when |
| --- | --- |
| `project_without_price` | a ref code has billable hours and no usable price |
| `price_not_positive` | a project row's price is missing, zero or negative (at import) |
| `employee_without_salary` | an employee logged hours in a month with no salary on record |
| `cost_partial` | a project's hours fall in a month whose salaries are incomplete |
| `no_billable_hours` | a month has cost but no billable hours, so part of the pool is unallocated |
| `period_missing_salaries` | a period has timesheet data and no salary data at all |
| `period_missing_timesheet` | a period has salary data and no timesheet data |
