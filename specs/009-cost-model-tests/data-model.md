# Phase 1 Data Model: Cost Model Verification Suite

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-10

This feature introduces no persisted entity and no schema change. What follows is the shape of the
data the suite **constructs in memory**, and the four fixtures the nine cases are built on — with
every expected figure derived here, by hand, from the assessment's formulas. The implementation
copies these numbers; it does not invent them, and it does not read them back out of the code.

---

## 1. Input shapes

All three are exported from `apps/api/src/analytics/cost-model.ts` and used as-is. No local copy or
adapter is introduced.

### Entry — one timesheet row

| Field | Type | Role in this suite |
|---|---|---|
| `year`, `month` | `number` | Places the row in a month model. |
| `employeeNo` | `string` | Joins to the salary record and to the direct rate. |
| `category` | `string` | Decides billable vs internal, via `isBillable`. |
| `hours` | `number` | The quantity every figure is built from. |
| `employeeName`, `department` | `string` | Required by the type; set to fixed filler values. |
| `typeOfExpense`, `designation`, `refCode`, `taskName`, `companyName` | `string \| null` | Not exercised. `refCode` is required by the type and set to a constant. |

**Fixture helper**: `entry(employeeNo, category, hours, month = 1)` fills every field the type
demands and leaves only the four that matter visible at the call site. This is one of the two local
helpers Principle II permits (research R4); it does not become a shared module.

### SalaryRecord — one person's pay for one month

| Field | Type | Role |
|---|---|---|
| `employeeNo` | `string` | Joins to entries. |
| `year`, `month` | `number` | Salaries are per calendar month; a rate is never blended across months. |
| `amount` | `number` | The numerator of the direct rate. |

**Absence is meaningful.** No record for a person in a month means *unknown*, which is a different
state from an `amount` of `0`. Case 6 exists to hold that line.

**Fixture helper**: `salary(employeeNo, amount, month = 1)`.

### Assumptions — the two operator-configurable inputs

| Field | Type | Value in the fixtures |
|---|---|---|
| `billableCategories` | `string[]` | `['Projects']` in the arithmetic fixtures — one category is enough to separate billable from internal, and fewer moving parts make a hand-derived figure checkable. Case 8 uses the real default trio. |
| `monthlyOverhead` | `number` | `0` except in case 3, which uses `12000`. |

---

## 2. Output shape asserted on

### MonthModel — everything derived for one calendar month

| Field | Type | Which case reads it |
|---|---|---|
| `directRates` | `Map<string, number \| null>` | 4 (the value), 6 (the `null`) |
| `indirectRate` | `number \| null` | 5 (the value), 7 (the `null`) |
| `pool` | `number` | 5, 7 |
| `knownSalaries` | `number` | 6 |
| `billableHours` | `number` | 5 |
| `uncostedBillableHours` | `number` | 6 |
| `poolComplete` | `boolean` | 6 |
| `missingSalaryEmployees` | `string[]` | 6 |

`costOf(rows, models, assumptions)` returns `{ cost: number; complete: boolean }` — read by cases 1,
2, 3 and 6. `entryCost` returns `number | null` (case 7). `uncostedIndirect` returns `number`
(case 6).

**Assertion rule.** `null` is asserted with `toBeNull()`, never `toBeFalsy()`, which would also
accept `0` and defeat the distinction the whole suite protects.

---

## 3. Fixture A — the reconciliation month

Used by cases **1, 3, 4, 5**. One month, `2025-01`. Billable category: `Projects`.

| Employee | Salary | Total hours | Billable | Non-billable | Direct rate |
|---|---|---|---|---|---|
| `E1` | 18,000 | 160 | 100 (`Projects`) | 60 (`FC - Meetings`) | 18000 ÷ 160 = **112.50** |
| `E2` | 12,000 | 100 | 100 (`Projects`) | 0 | 12000 ÷ 100 = **120.00** |
| `E3` | 20,000 | 0 | — | — | **null** — support staff |

**Total salaries: 50,000.**

### Derivation at `monthlyOverhead = 0`

```
billable hours          = 100 + 100                        = 200
indirect pool           = 20000            (E3, no hours)
                        + 60 × 112.50      (E1 non-billable) =  6750
                        + 0                (overhead)
                                                            = 26,750
indirect rate / hour    = 26750 ÷ 200                       = 133.75

cost E1 = 100 × (112.50 + 133.75) = 100 × 246.25            = 24,625
cost E2 = 100 × (120.00 + 133.75) = 100 × 253.75            = 25,375
total cost                                                  = 50,000
```

**Case 1 asserts**: total cost `50000`, equal to total salaries, to two decimal places.

**Case 4 asserts**: `directRates.get('E1') === 112.5`. The wrong-denominator implementation —
salary ÷ *billable* hours — would give `18000 ÷ 100 = 180`, so this fixture distinguishes the two.
E2 is deliberately fully billable, which makes E1 the only employee whose two denominators differ
and pins exactly which one the code uses.

**Case 5 asserts**: `pool === 26750`, `billableHours === 200`, `indirectRate === 133.75`. Because
the pool has all three of its stated components present and each contributes a distinguishable
amount, dropping any one of them changes the assertion.

### Derivation at `monthlyOverhead = 12,000` (case 3)

```
indirect pool        = 26750 + 12000     = 38,750
indirect rate / hour = 38750 ÷ 200       = 193.75
cost E1 = 100 × (112.50 + 193.75)        = 30,625
cost E2 = 100 × (120.00 + 193.75)        = 31,375
total cost                               = 62,000  =  50,000 + 12,000
```

**Case 3 asserts**: total cost `62000` — the overhead appears exactly once, not once per employee
(which would give 74,000) and not once per row (also 74,000 here, hence the third employee).

---

## 4. Fixture B — two months at different rates

Used by case **2**. Fixture A is month `2025-01`; month `2025-02` changes both salaries and hours.

| Employee | Feb salary | Total hours | Billable | Non-billable |
|---|---|---|---|---|
| `E1` | 18,500 | 120 | 80 | 40 |
| `E2` | 12,500 | 150 | 150 | 0 |
| `E3` | 20,500 | 0 | — | — |

**February salaries: 51,500. Both months: 101,500.**

February's rates are deliberately non-terminating (`18500 ÷ 120 = 154.1666…`,
`12500 ÷ 150 = 83.333…`), which is why the comparison uses the 0.005 tolerance established in
research R5 rather than exact equality.

**Case 2 asserts**: `costOf` over both months' rows returns `101500`. A blended-rate implementation
— one that averaged the two months' salaries or hours — would not reproduce this, because the two
months differ in both dimensions at once.

---

## 5. Fixture C — a missing salary

Used by case **6**. One month, `2025-01`, `monthlyOverhead = 0`.

| Employee | Salary | Total hours | Billable | Non-billable |
|---|---|---|---|---|
| `E1` | 18,000 | 160 | 100 | 60 |
| `E3` | 20,000 | 0 | — | — |
| `E4` | **none** | 50 | 50 | 0 |

```
known salaries          = 18000 + 20000                     = 38,000
billable hours          = 100 + 50                          = 150   (E4's hours still count)
indirect pool           = 20000 + 60 × 112.50               = 26,750 (E4 contributes nothing)
indirect rate / hour    = 26750 ÷ 150                       = 178.3333…
allocated cost          = 100 × (112.50 + 178.3333…)        = 29,083.33
uncosted indirect       = 178.3333… × 50                    =  8,916.67
allocated + uncosted                                        = 38,000  = known salaries
```

**Case 6 asserts**, in order:

1. `directRates.get('E4')` is `null` — unknown, not zero.
2. `poolComplete` is `false`.
3. `missingSalaryEmployees` contains `E4`.
4. `costOf(...)` returns `cost ≈ 29083.33` **and** `complete === false` — a number accompanied by a
   flag, never `null`. One gap must not blank the period (FR-008).
5. `cost + uncostedIndirect(model) ≈ 38000` — the unattributable share is reported, not pushed onto
   E1 (FR-009).

E4's 50 hours stay in the billable denominator deliberately: narrowing it would make E1 absorb a
missing colleague's share purely to force the books to balance, which is a different cost model from
the one the brief specifies.

---

## 6. Fixture D — a month with no billable work

Used by case **7**. One month, `2025-01`, `monthlyOverhead = 0`.

| Employee | Salary | Total hours | Billable | Non-billable |
|---|---|---|---|---|
| `E1` | 18,000 | 160 | 0 | 160 (`FC - Meetings`) |
| `E3` | 20,000 | 0 | — | — |

```
billable hours       = 0
direct rate E1       = 18000 ÷ 160            = 112.50   (still known)
indirect pool        = 20000 + 160 × 112.50   = 38,000
indirect rate        = undefined — no denominator
```

**Case 7 asserts**: `indirectRate` is `null` (not `0`, not `Infinity`, and no thrown error),
`entryCost(row, model)` is `null`, and `pool === 38000` — the cost is real, it simply cannot be
allocated to any project. The pool equalling the full 38,000 salary bill is the same reconciliation
identity seen from the other side.

---

## 7. Cases 8 and 9 — no fixture

These two exercise predicates directly and need no timesheet data.

**Case 8 — `isBillable`**, against the real default assumption set
(`['Projects', 'Enhancements', 'Hosting']`, from `settings.schema.ts`):

| Input | Expected |
|---|---|
| `'Projects'` | `true` |
| `'projects'` | `true` — matching ignores letter case |
| `'HOSTING'` | `true` |
| `'FC - Meetings'` | `false` |
| `'FC - Idle'` | `false` |

**Case 9 — `ratio`**:

| Input | Expected | Why it matters |
|---|---|---|
| `ratio(50, 200)` | `0.25` | The ordinary path. |
| `ratio(50, 0)` | `null` | Unknown, not `0` and not `Infinity`. |
| `ratio(50, null)` | `null` | An unknown denominator stays unknown. |
| `ratio(-100, 200)` | `-0.5` | A loss stays a loss — margins are never clamped at zero. |
| `ratio(0, 200)` | `0` | A genuine zero survives, distinct from the `null`s above. |
