# Contract — Reporting

All endpoints require a signed-in session. Period parameters and the number contracts are in
`README.md`. Every response below was captured from the running API with the three supplied
workbooks loaded.

Endpoints fall into two groups, and the split is the point:

| Group | Endpoints | Reads |
| --- | --- | --- |
| **Hours** | `/productivity`, `/categories` | timesheet rows + the billable-category assumption |
| **Cost** | `/dashboard`, `/projects`, `/projects/:refCode`, `/departments` | the above, plus salaries, prices and the cost model |

Hours endpoints carry no cost or revenue completeness, because they report no cost. They still
report coverage — `period.monthsCovered` and `period.hasData` — so "no file uploaded for this
month" is visible.

`/periods` sits outside both: it reports no figures, but it does carry the standing data-quality
warnings, so it loads the cost model for the default year.

---

## `GET /periods`

*Serves the year/month filter and the empty state.* No parameters.

```json
{
  "years": [
    { "year": 2025, "months": [
      { "month": 1, "label": "January 2025", "hasTimesheet": true, "hasSalaries": true }
    ] }
  ],
  "defaultYear": 2025,
  "hasData": true
}
```

Empty database: `{ "years": [], "defaultYear": null, "hasData": false, "warnings": [] }` with `200`.

`warnings` carries the standing gaps in the loaded data — missing salaries, unpriced projects —
recomputed on read, so uploading the missing file clears them. It is what the Uploads page shows
as "standing gaps in the loaded data".

---

## `GET /dashboard?year=&month=`

*The Dashboard page.* Full year 2025, overhead `0`:

```json
{
    "period": {
        "year": 2025,
        "month": null,
        "label": "2025",
        "monthsCovered": 12,
        "hasData": true
    },
    "currency": "AED",
    "totals": {
        "totalHours": 19815.2,
        "billableHours": 15265.6,
        "nonBillableHours": 4549.6,
        "productivity": 0.7704,
        "cost": 2400000,
        "allocatedRevenue": 5012000,
        "profit": 2612000,
        "margin": 0.5211
    },
    "reconciliation": {
        "knownSalaries": 2400000,
        "overhead": 0,
        "expectedCost": 2400000,
        "allocatedCost": 2400000,
        "unallocatedCost": 0,
        "uncostedIndirectCost": 0,
        "difference": 0,
        "balances": true,
        "salariesComplete": true,
        "employeeMonthsMissingSalary": 0,
        "billableHours": 15265.6,
        "billableHoursUncosted": 0
    },
    "completeness": {
        "cost": "complete",
        "revenue": "complete",
        "issues": []
    }
}
```

| Field | Definition |
| --- | --- |
| `billableHours` | hours in a category listed in `billableCategories` |
| `productivity` | `billableHours / totalHours`; `null` when `totalHours` is 0 |
| `cost` | the assessment's cost model over this period |
| `allocatedRevenue` | for each project, `price x (period hours / the project's hours across every loaded period)` |
| `profit` | `allocatedRevenue - cost`, or `null` when either input is partial |
| `margin` | `profit / allocatedRevenue`; unbounded, never clamped; `null` when partial or undefined |

### One revenue figure, and what it is

A project has one price and up to five months of hours, and **the assessment does not say how to
split a price across periods**. This API allocates it by hour share — the same idea the brief uses
for `employee revenue share` — and calls it `allocatedRevenue` rather than `revenue` to keep that
visible. It is a reporting allocation, not an accounting basis.

**The denominator is the project's hours across every loaded period, never the requested period.**
The filter narrows the numerator only. Verified: the twelve monthly figures sum to AED 5,012,000,
the sum of every price, and one project's monthly figures sum to its own price. A consequence:
**loading more hours for a project revises the allocated revenue already reported for earlier
periods.**

### `reconciliation`

| Field | Meaning |
| --- | --- |
| `knownSalaries` | salaries actually on record for the period |
| `expectedCost` | `knownSalaries + overhead` |
| `allocatedCost` | cost attached to billable hours |
| `unallocatedCost` | pool no project could carry, because a month had no billable hours |
| `uncostedIndirectCost` | pool that fell on billable hours whose direct rate is unknown |
| `difference` | `allocatedCost + unallocatedCost + uncostedIndirectCost - expectedCost` |
| `balances` | `abs(difference) < 0.005`. **Arithmetic only** |
| `salariesComplete` | whether every employee with hours has a salary. **Completeness, not arithmetic** |
| `billableHours` / `billableHoursUncosted` | all billable hours — the indirect rate's denominator — and the subset that could not be costed |

`balances: true` with `salariesComplete: false` is a real state: the arithmetic ties over the
inputs that exist, and the dataset is still incomplete.

---

## `GET /projects?year=&month=`

*The project list.* Every project with billable hours in the period, plus every project priced in
it, sorted by period hours.

```json
{
  "period": { "year": 2025, "month": 3, "label": "March 2025", "monthsCovered": 1, "hasData": true },
  "currency": "AED",
  "projects": [
    {
      "refCode": "Q2025001a",
      "name": "Meridian-Website-UIUXdesign-Development-14012025-COMMERCIAL.pdf",
      "client": "Meridian Group",
      "category": "Projects",
      "status": "in progress",
      "priced": true,
      "price": 560000,
      "salesMonth": { "year": 2025, "month": 1, "label": "January 2025" },
      "periodHours": 532.4,
      "periodCost": 87114.66,
      "costComplete": true,
      "periodAllocatedRevenue": 98553.48,
      "periodProfit": 11438.83,
      "periodMargin": 0.1161,
      "lifetimeHours": 3025.2,
      "lifetimeShareOfHours": 0.176
    }
  ],
  "completeness": { "cost": "complete", "revenue": "complete", "issues": [] }
}
```

**Membership follows the row's category, not whether a price exists.** A billable ref code with
hours and no price is the gap the brief asks us to surface, so it is listed with `priced: false`,
`price: null`, a name taken from the timesheet's task column, and an openable detail page. Internal
categories are what gets excluded — January's list is `["Q2025001a"]`, no `FC - *`, no `Tentwenty`.

The three March `periodCost` values sum to AED 197,000, March's whole salary bill, because these
are the only projects with billable hours that month.

---

## `GET /projects/:refCode`

*The Project page, and per-employee profitability.* **Not period-filtered** — a price only means
something against all of the project's hours. Abridged:

```json
{
  "refCode": "Q2025001a",
  "name": "Meridian-Website-UIUXdesign-Development-14012025-COMMERCIAL.pdf",
  "client": "Meridian Group",
  "category": "Projects",
  "status": "in progress",
  "currency": "AED",
  "priced": true,
  "price": 560000,
  "salesMonth": {
    "year": 2025,
    "month": 1,
    "label": "January 2025"
  },
  "totals": {
    "hours": 3025.2,
    "cost": 468776.21,
    "costComplete": true,
    "profit": 91223.79,
    "profitability": 0.1629
  },
  "departments": [
    {
      "department": "Design",
      "hours": 1143.7,
      "cost": 175113.89,
      "costComplete": true,
      "shareOfHours": 0.3781
    },
    {
      "department": "Frontend",
      "hours": 579.7,
      "cost": 84846.85,
      "costComplete": true,
      "shareOfHours": 0.1916
    },
    "..."
  ],
  "employees": [
    {
      "employeeNo": "10201",
      "name": "Ayesha Rahman",
      "department": "Design",
      "designation": "Senior UI/UX Designer",
      "hours": 311.8,
      "cost": 50586.14,
      "costComplete": true,
      "revenueShare": 57717.84,
      "profitability": 0.1236
    },
    "..."
  ],
  "completeness": {
    "cost": "complete",
    "revenue": "complete",
    "issues": []
  }
}
```

| Field | Formula |
| --- | --- |
| `totals.profitability` | `(price - cost) / price` — the assessment's project profitability, exactly |
| `employees[].cost` | `sum over months of hours x (direct rate + that month's indirect rate)` |
| `employees[].revenueShare` | `price x (employee hours / project total hours)`; `null` without a usable price |
| `employees[].profitability` | `(revenueShare - cost) / revenueShare`; `null` when that row's `costComplete` is false |

**Invariants**, confirmed against the running API: employee costs sum to `totals.cost`
(468,776.21); revenue shares sum to `price` (560,000.01, one cent of rounding across ten rows);
department hours sum to `totals.hours` (3,025.20).

---

## `GET /departments?year=&month=`

*Department drill-down — hours and cost per department, and the people inside each one.* People
are nested, so the drilldown needs no second request. Abridged:

```json
{
  "period": {
    "year": 2025,
    "month": null,
    "label": "2025",
    "monthsCovered": 12,
    "hasData": true
  },
  "currency": "AED",
  "departments": [
    {
      "department": "Design",
      "totalHours": 6335.9,
      "billableHours": 5121.2,
      "nonBillableHours": 1214.7,
      "cost": 815242.13,
      "costComplete": true,
      "employees": [
        {
          "employeeNo": "10201",
          "name": "Ayesha Rahman",
          "designation": "Senior UI/UX Designer",
          "totalHours": 2111.9,
          "billableHours": 1702.1,
          "cost": 278120.42,
          "costComplete": true
        },
        "..."
      ]
    },
    "..."
  ],
  "completeness": {
    "cost": "complete",
    "revenue": "complete",
    "issues": []
  }
}
```

A department's `cost` is the cost carried by its **billable** hours; across departments it sums to
AED 2,400,000 for the year. **Management reads `cost: 0`, and that is correct** — its two people
log no billable hours, so their salaries enter the indirect pool and are recovered through the
departments that do carry billable work.

---

## `GET /productivity?year=&month=`

*Billable ÷ total hours per employee.* Hours only — no salaries, no prices, no completeness block.

```json
{
  "period": { "year": 2025, "month": null, "label": "2025", "monthsCovered": 12, "hasData": true },
  "companyProductivity": 0.7704,
  "employees": [
    {
      "employeeNo": "10208", "name": "Kevin D'Souza", "department": "App",
      "designation": "Mobile Developer", "typeOfExpense": "DL",
      "totalHours": 1558.4, "billableHours": 1292.7, "nonBillableHours": 265.7,
      "productivity": 0.8295
    }
  ]
}
```

An employee who logged hours but none billable reports a genuine `0`; one with no hours at all in
the period reports `totalHours: 0` and `productivity: null`. The two stay distinguishable.

---

## `GET /categories?year=&month=`

*Hours per category — where the time actually goes.* Hours only. Abridged:

```json
{
  "period": {
    "year": 2025,
    "month": null,
    "label": "2025",
    "monthsCovered": 12,
    "hasData": true
  },
  "totalHours": 19815.2,
  "billableHours": 15265.6,
  "internalHours": 4549.6,
  "categories": [
    {
      "category": "Projects",
      "billable": true,
      "hours": 12540.9,
      "shareOfTotal": 0.6329
    },
    {
      "category": "FC - Meetings",
      "billable": false,
      "hours": 2180.4,
      "shareOfTotal": 0.11
    },
    {
      "category": "Enhancements",
      "billable": true,
      "hours": 2080.5,
      "shareOfTotal": 0.105
    },
    {
      "category": "FC - Leaves",
      "billable": false,
      "hours": 1176,
      "shareOfTotal": 0.0593
    },
    "..."
  ]
}
```

`categories[].hours` sums to `totalHours`; the `billable: true` rows sum to `billableHours`.
**Cost is not reported here** — it is read on the Dashboard and the project pages, where the
indirect pool is loaded onto billable hours. `Tentwenty` is internal time: hours and a ref code but
no price, exactly as the brief describes, and it correctly raises no missing-price warning.
