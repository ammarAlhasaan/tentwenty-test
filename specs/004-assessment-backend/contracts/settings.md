# Contract — Assumptions

*Serves: Configurable assumptions (Should Have) — "which categories count as billable, and a
monthly overhead figure — without editing code". Also required by the assessment's own self-check,
which asks for a full year run with overhead set to zero.*

Both endpoints require a signed-in session.

---

## `GET /settings`

```json
{
  "billableCategories": [
    "Projects",
    "Enhancements",
    "Hosting"
  ],
  "monthlyOverhead": 0,
  "currency": "AED",
  "knownCategories": [
    {
      "category": "Projects",
      "billable": true,
      "hours": 12540.9
    },
    {
      "category": "FC - Meetings",
      "billable": false,
      "hours": 2180.4
    },
    {
      "category": "Enhancements",
      "billable": true,
      "hours": 2080.5
    },
    {
      "category": "FC - Leaves",
      "billable": false,
      "hours": 1176
    },
    {
      "category": "Hosting",
      "billable": true,
      "hours": 644.2
    },
    {
      "category": "FC - Others",
      "billable": false,
      "hours": 300.8
    },
    "..."
  ]
}
```

`knownCategories` is every category present in the loaded timesheet, with its current billable flag
and total hours, so the UI can offer real choices instead of a free-text box.

Defaults are the assessment's own and are seeded once with `INSERT OR IGNORE`, so a restart never
resets a changed value.

---

## `PUT /settings`

**Request** — `application/json`, `.strict()`. Both fields optional; only what is sent changes.

```json
{ "billableCategories": ["Projects", "Enhancements", "Hosting", "Tentwenty"], "monthlyOverhead": 45000 }
```

| Field | Rule |
| --- | --- |
| `billableCategories` | array of non-empty strings, at least one entry, no case-insensitive duplicates, each at most 100 characters |
| `monthlyOverhead` | finite number, `>= 0` |

`200` returns the full settings object. `400` on an invalid value, **leaving the stored assumptions
unchanged** — confirmed for all three cases:

| Body | Observed |
| --- | --- |
| `{"monthlyOverhead":-1}` | `400` — `monthlyOverhead: Too small: expected number to be >=0` |
| `{"billableCategories":[]}` | `400` — `billableCategories: At least one billable category is required` |
| `{"nope":1}` | `400` — `Unrecognized key: "nope"` |

A category name absent from the loaded data is **accepted**, not rejected — data for it may arrive
later. Its absence from `knownCategories` makes that visible.

## Effect of a change

Applied to every subsequent request immediately; nothing is cached and no restart is needed. All
observed:

| Change | Effect |
| --- | --- |
| `monthlyOverhead` = 10,000 | year `cost` 2,400,000 → **2,520,000** (12 x 10,000); March 197,000 → **207,000**; `expectedCost` rises identically and `balances` stays `true`; `allocatedRevenue` unchanged |
| `Tentwenty` added to `billableCategories` | year `billableHours` 15,265.60 → **15,404.30**; `productivity` 0.7704 → **0.7774**; **`cost` unchanged at 2,400,000** and still balancing — moving a category redistributes cost, it does not create or destroy it; `completeness.revenue` becomes `partial` because `Tentwenty` has no price |
| A category moved out | the mirror of the above |
| All categories removed | rejected — a month with no billable hours can allocate no cost |
