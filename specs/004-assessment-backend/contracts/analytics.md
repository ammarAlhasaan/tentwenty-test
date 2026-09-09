# Contract — Reporting

All endpoints require a signed-in session. Period parameters, rounding, the `null`-for-unknown
rule and the completeness contract are in `README.md`. **Every response below was captured from
the running API** with the three supplied workbooks loaded and the default assumptions.

---

## `GET /periods`

*Serves: the year/month filter on every page, and the honest empty state.* No parameters.

```json
{
  "years": [
    {
      "year": 2025,
      "months": [
        {
          "month": 1,
          "label": "January 2025",
          "hasTimesheet": true,
          "hasSalaries": true
        },
        {
          "month": 2,
          "label": "February 2025",
          "hasTimesheet": true,
          "hasSalaries": true
        },
        "..."
      ]
    }
  ],
  "defaultYear": 2025,
  "hasData": true,
  "warnings": []
}
```

With nothing loaded the response is `200`, not an error:

```json
{ "years": [], "defaultYear": null, "hasData": false, "warnings": [] }
```

`warnings` carries the **standing** data-quality issues for the default year, recomputed on read
rather than replayed from upload time, so uploading the missing file makes them disappear.

---

## `GET /dashboard?year=&month=`

*Serves: the Dashboard page (Must Have).*

Full year 2025, overhead `0`:

```json
{
    "period": {
        "year": 2025,
        "month": null,
        "label": "2025",
        "monthsCovered": 12
    },
    "currency": "AED",
    "totals": {
        "totalHours": 19815.2,
        "billableHours": 15265.6,
        "nonBillableHours": 4549.6,
        "productivity": 0.7704,
        "cost": 2400000,
        "allocatedRevenue": 5012000,
        "bookedRevenue": 5012000,
        "profit": 2612000,
        "margin": 0.5211
    },
    "reconciliation": {
        "knownSalaries": 2400000,
        "overhead": 0,
        "expectedCost": 2400000,
        "allocatedCost": 2400000,
        "unallocatedCost": 0,
        "difference": 0,
        "balances": true,
        "salariesComplete": true,
        "employeeMonthsMissingSalary": 0,
        "billableHours": 15265.6,
        "billableHoursCosted": 15265.6
    },
    "completeness": {
        "cost": "complete",
        "revenue": "complete",
        "issues": []
    }
}
```

March 2025:

```json
{
    "period": {
        "year": 2025,
        "month": 3,
        "label": "March 2025",
        "monthsCovered": 1
    },
    "currency": "AED",
    "totals": {
        "totalHours": 1642.9,
        "billableHours": 1230.7,
        "nonBillableHours": 412.2,
        "productivity": 0.7491,
        "cost": 197000,
        "allocatedRevenue": 311011.81,
        "bookedRevenue": 330000,
        "profit": 114011.81,
        "margin": 0.3666
    },
    "reconciliation": {
        "knownSalaries": 197000,
        "overhead": 0,
        "expectedCost": 197000,
        "allocatedCost": 197000,
        "unallocatedCost": 0,
        "difference": 0,
        "balances": true,
        "salariesComplete": true,
        "employeeMonthsMissingSalary": 0,
        "billableHours": 1230.7,
        "billableHoursCosted": 1230.7
    },
    "completeness": {
        "cost": "complete",
        "revenue": "complete",
        "issues": []
    }
}
```

March shows why allocated and booked revenue are two fields: AED 330,000 of work was *sold* in
March, while AED 311,011.81 was *earned* by the hours logged in March across three projects. Over
the full year both reach AED 5,012,000, the sum of every price.

### Field definitions

| Field | Definition |
| --- | --- |
| `billableHours` | hours in a category listed in `billableCategories` |
| `productivity` | `billableHours / totalHours`; `null` when `totalHours` is 0 |
| `cost` | the assessment's cost model, summed over the period |
| `allocatedRevenue` | `price x (period hours / the project's hours across every loaded period)`, summed. See below |
| `bookedRevenue` | total price of projects whose *sales month* falls in the period |
| `profit` | `allocatedRevenue - cost`, or `null` when either input is partial |
| `margin` | `profit / allocatedRevenue`; unbounded, never clamped; `null` when partial or undefined |

### `allocatedRevenue` is a reporting allocation, not revenue recognition

A project has one price and up to five months of hours, and **the assessment does not prescribe
how to split a price across periods**. This API allocates it by hour share — the same idea the
brief itself uses for `employee revenue share` — and names the field `allocatedRevenue` rather
than `revenue` to keep that honest. It is not an accounting basis.

**The denominator is the project's hours across every loaded period, never the requested period.**
The period filter narrows the numerator only. Verified: the twelve monthly figures sum to
AED 5,012,000, and one project's monthly figures sum to its own price.

**Loading more hours for a project revises the allocated revenue already reported for earlier
periods.** The price does not change, but each period's share of it shrinks. That is inherent to
any hour-share allocation and is stated rather than hidden.

### `reconciliation` — the assessment's self-check, exposed

| Field | Meaning |
| --- | --- |
| `knownSalaries` | salaries actually on record for the period |
| `expectedCost` | `knownSalaries + overhead` |
| `allocatedCost` | cost attached to billable hours |
| `unallocatedCost` | pool that no project could carry, because a month had no billable hours |
| `difference` | `allocatedCost + unallocatedCost - expectedCost` |
| `balances` | `abs(difference) < 0.005` — "equal to the dirham". **Arithmetic only** |
| `salariesComplete` | whether every employee with hours has a salary. **Completeness, not arithmetic** |
| `employeeMonthsMissingSalary` | how many employee-months have none |
| `billableHours` / `billableHoursCosted` | all billable hours, and the subset behind the indirect rate |

`balances: true` with `salariesComplete: false` is a real and important state: the arithmetic ties
over the inputs that exist, and the dataset is still incomplete. Observed with one salary removed
from March — `knownSalaries` 172,000, `balances` true, `salariesComplete` false, `profit` and
`margin` `null`.

---

## `GET /projects?year=&month=`

*Serves: the project list the Project page drills into.* Lists every project with hours in the
period, plus every project priced in the period, sorted by period hours.

```json
{
    "period": {
        "year": 2025,
        "month": 3,
        "label": "March 2025",
        "monthsCovered": 1
    },
    "currency": "AED",
    "projects": [
        {
            "refCode": "Q2025001a",
            "name": "Meridian-Website-UIUXdesign-Development-14012025-COMMERCIAL.pdf",
            "client": "Meridian Group",
            "category": "Projects",
            "status": "in progress",
            "price": 560000,
            "salesMonth": {
                "year": 2025,
                "month": 1,
                "label": "January 2025"
            },
            "periodHours": 532.4,
            "periodCost": 87114.66,
            "periodAllocatedRevenue": 98553.48,
            "periodProfit": 11438.83,
            "periodMargin": 0.1161,
            "lifetimeHours": 3025.2,
            "lifetimeShareOfHours": 0.176
        },
        {
            "refCode": "Q2025009b",
            "name": "Bayside-Website-UIUXdesign-Development-19032025-COMMERCIAL.pdf",
            "client": "Bayside Realty",
            "category": "Projects",
            "status": "completed",
            "price": 330000,
            "salesMonth": {
                "year": 2025,
                "month": 3,
                "label": "March 2025"
            },
            "periodHours": 423.9,
            "periodCost": 63167.11,
            "periodAllocatedRevenue": 75918.27,
            "periodProfit": 12751.16,
            "periodMargin": 0.168,
            "lifetimeHours": 1842.6,
            "lifetimeShareOfHours": 0.2301
        },
        {
            "refCode": "Q2025004c",
            "name": "Alwasl-App-UIUXdesign-Development-03022025-COMMERCIAL.pdf",
            "client": "Al Wasl Holding",
            "category": "Projects",
            "status": "in progress",
            "price": 900000,
            "salesMonth": {
                "year": 2025,
                "month": 2,
                "label": "February 2025"
            },
            "periodHours": 274.4,
            "periodCost": 46718.23,
            "periodAllocatedRevenue": 136540.06,
            "periodProfit": 89821.83,
            "periodMargin": 0.6578,
            "lifetimeHours": 1808.7,
            "lifetimeShareOfHours": 0.1517
        }
    ],
    "completeness": {
        "cost": "complete",
        "revenue": "complete",
        "issues": []
    }
}
```

- `periodAllocatedRevenue` is the earned share for this period only. The full `price` is its own
  field and is **never** presented as the period's revenue — `Q2025009b` was sold in March for
  AED 330,000 but earned AED 75,918.27 of it in March.
- `lifetimeShareOfHours` makes the allocation legible: it is the fraction of the project's hours
  across all loaded periods that fell in this period — exactly the fraction of `price` applied.
- The three `periodCost` values sum to AED 197,000, March's entire salary bill, because these are
  the only projects with billable hours that month.
- A project with no usable price reports `price`, `periodAllocatedRevenue`, `periodProfit` and
  `periodMargin` as `null`, and the response's `completeness.revenue` becomes `partial`.

---

## `GET /projects/:refCode`

*Serves: the Project page (Must Have) and Per-employee profitability (Should Have).*

**Not period-filtered**: a price only means something against all of the project's hours. The
month-by-month split is inside the response. Departments and employees abridged below.

```json
{
  "refCode": "Q2025001a",
  "name": "Meridian-Website-UIUXdesign-Development-14012025-COMMERCIAL.pdf",
  "client": "Meridian Group",
  "category": "Projects",
  "status": "in progress",
  "currency": "AED",
  "price": 560000,
  "salesMonth": {
    "year": 2025,
    "month": 1,
    "label": "January 2025"
  },
  "totals": {
    "hours": 3025.2,
    "cost": 468776.21,
    "profit": 91223.79,
    "profitability": 0.1629
  },
  "months": [
    {
      "year": 2025,
      "month": 1,
      "label": "January 2025",
      "hours": 1283.5,
      "cost": 197000,
      "allocatedRevenue": 237590.9
    },
    {
      "year": 2025,
      "month": 2,
      "label": "February 2025",
      "hours": 780,
      "cost": 120542.34,
      "allocatedRevenue": 144387.15
    },
    {
      "year": 2025,
      "month": 3,
      "label": "March 2025",
      "hours": 532.4,
      "cost": 87114.66,
      "allocatedRevenue": 98553.48
    },
    {
      "year": 2025,
      "month": 4,
      "label": "April 2025",
      "hours": 121.4,
      "cost": 20433.25,
      "allocatedRevenue": 22472.56
    },
    {
      "year": 2025,
      "month": 5,
      "label": "May 2025",
      "hours": 307.9,
      "cost": 43685.96,
      "allocatedRevenue": 56995.9
    }
  ],
  "departments": [
    {
      "department": "Design",
      "hours": 1143.7,
      "cost": 175113.89,
      "shareOfHours": 0.3781
    },
    {
      "department": "Frontend",
      "hours": 579.7,
      "cost": 84846.85,
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
      "revenueShare": 57717.84,
      "profitability": 0.1236
    },
    {
      "employeeNo": "10202",
      "name": "Rohit Menon",
      "department": "Design",
      "designation": "UI/UX Designer",
      "hours": 520.9,
      "cost": 67222.46,
      "revenueShare": 96424.7,
      "profitability": 0.3029
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
| `totals.cost` | every employee's cost on the project, month by month |
| `totals.profitability` | `(price - cost) / price` — **the assessment's project profitability, exactly**, unaffected by period allocation |
| `employees[].cost` | `sum over months of hours x (direct rate + that month's indirect rate)` |
| `employees[].revenueShare` | `price x (employee hours / project total hours)`; `null` without a usable price |
| `employees[].profitability` | `(revenueShare - cost) / revenueShare`; unbounded and never clamped |

**Invariants, all confirmed against the running API:**

- `employees[].cost` sums to `totals.cost` — 468,776.21
- `employees[].revenueShare` sums to `price` — 560,000.01 (one cent of rounding across ten rows)
- `months[].cost` sums to `totals.cost`; `months[].allocatedRevenue` sums to the price
- `departments[].hours` sums to `totals.hours` — 3,025.20

January's cost on this project is AED 197,000, the whole company's January salary bill. That is
correct: `Q2025001a` is the only project with billable hours in January, so it absorbs the month.

With the price removed, the observed response keeps `hours` and `cost` and reports `price`,
`profit`, `profitability`, every `revenueShare` and every `allocatedRevenue` as `null`, with
`completeness.revenue: "partial"`. With the price set to 1,000 it reports
`profitability: -467.7762` — negative values are not clamped.

`404 Not Found` when the ref code has neither hours nor a price row.

---

## `GET /departments?year=&month=`

*Serves: Department drill-down (Should Have) — "click Design and see the hours and cost of every
person in it". People are nested, so the drilldown needs no second request.* Abridged below.

```json
{
  "period": {
    "year": 2025,
    "month": null,
    "label": "2025",
    "monthsCovered": 12
  },
  "currency": "AED",
  "departments": [
    {
      "department": "Design",
      "totalHours": 6335.9,
      "billableHours": 5121.2,
      "nonBillableHours": 1214.7,
      "productivity": 0.8083,
      "cost": 815242.13,
      "allocatedRevenue": 1807082.77,
      "profit": 991840.64,
      "margin": 0.5489,
      "employees": [
        {
          "employeeNo": "10201",
          "name": "Ayesha Rahman",
          "designation": "Senior UI/UX Designer",
          "totalHours": 2111.9,
          "billableHours": 1702.1,
          "productivity": 0.806,
          "cost": 278120.42,
          "allocatedRevenue": 657812.55,
          "profit": 379692.13,
          "margin": 0.5772
        },
        "..."
      ]
    },
    {
      "department": "Management",
      "totalHours": 812.6,
      "billableHours": 0,
      "nonBillableHours": 812.6,
      "productivity": 0,
      "cost": 0,
      "allocatedRevenue": 0,
      "profit": 0,
      "margin": null,
      "employees": [
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

- Department `cost` is the cost carried by that department's **billable** hours. Across
  departments it sums to AED 2,400,000 for the year — the dashboard's allocated cost.
- `allocatedRevenue` uses the same lifetime denominator, so departments sum to AED 5,012,000.
- Each department's nested `employees[]` sum to its own totals (confirmed for Design:
  6,335.90 hours, 815,242.13 cost).

**Management reads `cost: 0.00` and `margin: null`, and both are correct.** Its two people log no
billable hours — they are the brief's support staff. Their salaries enter the indirect cost pool
and are recovered through everyone else's indirect rate, so the cost surfaces in the departments
that carry billable hours. Their `productivity` is a genuine `0` (hours logged, none billable);
their `margin` is `null` (no revenue to divide by). A real zero and an unknown, distinguished.

---

## `GET /productivity?year=&month=`

*Serves: the Productivity page (Must Have) — "billable ÷ total hours per employee, filterable".*
Abridged to three of twelve.

```json
{
  "period": {
    "year": 2025,
    "month": null,
    "label": "2025",
    "monthsCovered": 12
  },
  "companyProductivity": 0.7704,
  "employees": [
    {
      "employeeNo": "10208",
      "name": "Kevin D'Souza",
      "department": "App",
      "designation": "Mobile Developer",
      "typeOfExpense": "DL",
      "totalHours": 1558.4,
      "billableHours": 1292.7,
      "nonBillableHours": 265.7,
      "productivity": 0.8295
    },
    {
      "employeeNo": "10201",
      "name": "Ayesha Rahman",
      "department": "Design",
      "designation": "Senior UI/UX Designer",
      "typeOfExpense": "DL",
      "totalHours": 2111.9,
      "billableHours": 1702.1,
      "nonBillableHours": 409.8,
      "productivity": 0.806
    },
    {
      "employeeNo": "00102",
      "name": "Omar Zayed",
      "department": "Management",
      "designation": "Operations Lead",
      "typeOfExpense": "IDL",
      "totalHours": 417.8,
      "billableHours": 0,
      "nonBillableHours": 417.8,
      "productivity": 0
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

- Omar Zayed's `0` is a **genuine zero**: 417.80 hours logged, none billable.
- An employee with a salary and no hours at all in the period reports `totalHours: 0` and
  `productivity: null` — unknown, not 0%. The two cases stay distinguishable.

---

## `GET /categories?year=&month=`

*Serves: the Category page (Must Have) — "hours per category … where does the time actually go".*
Abridged to six of eleven.

```json
{
  "period": {
    "year": 2025,
    "month": null,
    "label": "2025",
    "monthsCovered": 12
  },
  "currency": "AED",
  "totalHours": 19815.2,
  "billableHours": 15265.6,
  "internalHours": 4549.6,
  "totalDirectCost": 2399999.99,
  "billableDirectCost": 1490742.67,
  "internalDirectCost": 909257.32,
  "categories": [
    {
      "category": "Projects",
      "billable": true,
      "hours": 12540.9,
      "shareOfTotal": 0.6329,
      "directCost": 1217539.08
    },
    {
      "category": "FC - Meetings",
      "billable": false,
      "hours": 2180.4,
      "shareOfTotal": 0.11,
      "directCost": 452097.07
    },
    {
      "category": "Enhancements",
      "billable": true,
      "hours": 2080.5,
      "shareOfTotal": 0.105,
      "directCost": 209655.49
    },
    {
      "category": "FC - Leaves",
      "billable": false,
      "hours": 1176,
      "shareOfTotal": 0.0593,
      "directCost": 201772.75
    },
    {
      "category": "Hosting",
      "billable": true,
      "hours": 644.2,
      "shareOfTotal": 0.0325,
      "directCost": 63548.1
    },
    {
      "category": "FC - Others",
      "billable": false,
      "hours": 300.8,
      "shareOfTotal": 0.0152,
      "directCost": 36649.48
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

**`directCost` is deliberately a different measure from the dashboard's `cost`.** It is each
category's hours valued at the people's **direct rates only** — what that time cost in salary.
It was chosen because it is the only cost measure that is *additive across every category*: the
eleven rows sum to AED 2,399,999.99, total salaries, to the cent. The dashboard's `cost` loads the
indirect pool onto billable hours, so adding a billable category's fully-loaded cost to an internal
category's pool contribution would count the pool twice and produce a meaningless total.

One measure, one meaning, and a column a reader can safely add up. The dashboard remains the place
to read fully-loaded cost.

- `billable` reflects the current `billableCategories` assumption, so flipping a category in
  `PUT /settings` moves its hours between `billableHours` and `internalHours` here.
- `Tentwenty` is internal time — hours and a ref code but no price, exactly as the brief
  describes — and correctly raises no missing-price warning while it stays internal.
