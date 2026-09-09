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

## Completeness — read this before trusting a figure

Arithmetic balance and dataset completeness are **two different facts**, reported separately.

Every calculated response carries:

```json
"completeness": {
  "cost": "complete",
  "revenue": "partial",
  "issues": [
    {
      "code": "project_without_price",
      "message": "Q2025001a has billable hours in this period and no usable price, so its revenue is unknown.",
      "context": { "refCode": "Q2025001a" }
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `cost` | `partial` when any month in scope has an employee with logged hours and no salary on record |
| `revenue` | `partial` when any project with billable hours in scope has no usable price |
| `issues` | the specific reasons, recomputed on read — fixing a gap by uploading the missing data makes the issue disappear |

Four consequences that the API guarantees:

1. **A partial `cost` or `revenue` figure is the known subtotal, never a complete one.** It is a
   real sum of the inputs that exist; it is not the whole answer. The flag is the only way to know
   which you are looking at.
2. **`profit`, `margin` and `profitability` are withheld — `null` — whenever the inputs behind
   them are partial.** A derived figure built on incomplete inputs is never presented as though it
   were trustworthy.
3. **One missing salary marks the whole month partial**, not just that person's rows. Their
   non-billable time is missing from the indirect cost pool, and the pool prices *every* project
   row in that month, so a colleague whose own salary is on record still has an understated cost.
4. **Completeness propagates to every level, and is reported at every level.** Each month,
   department and employee row in a response carries its own `costComplete`, so a gap in one month
   does not silently discredit the others. Observed: with March incomplete, a project's April to
   July rows keep `costComplete: true` and real figures, while every March-touching employee —
   including ones whose salaries are known — reports `profitability: null`.

**The cost model's formula is never bent to make the arithmetic tie.** The indirect cost rate
divides the pool by **all** billable hours that month, as the assessment specifies — not by the
hours of employees who happen to have a salary on record. Narrowing that denominator would make
colleagues absorb a missing person's share. Instead the unattributable remainder is reported as
`reconciliation.uncostedIndirectCost`.

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
