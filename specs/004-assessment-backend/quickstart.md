# BE-03 Manual Verification — procedure and observed results

No automated tests (spec FR-050). This is the acceptance procedure **and the record of running
it**. Every "Observed" line below is real output captured on 2026-09-10 from the built API
(`node dist/main.js`) on port **4123** against an isolated scratch database. Nothing here is
predicted.

## Conditions

| | |
| --- | --- |
| Commands | `pnpm --filter api lint`, `pnpm --filter api build`, then `curl` |
| Database | a scratch file under the session scratchpad — the development database and every sibling worktree's database untouched |
| Port | 4123 (and 4124 for the upgrade test), both unused; only processes started by this task were stopped |
| Data | the tracked workbooks at `apps/api/sample-data/`, byte-identical to `temp/` by `shasum`; the originals were never modified |
| Malformed fixtures | generated into the scratch directory, never into `temp/` or the repository |

## Reproducing

```bash
pnpm install && pnpm --filter api build
```

```bash
VDIR=$(mktemp -d); DATABASE_PATH="$VDIR/verify.sqlite" PORT=4123 node apps/api/dist/main.js
```

```bash
curl -s -c "$VDIR/c.txt" -X POST http://localhost:4123/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}'
```

Then `api() { curl -s -b "$VDIR/c.txt" -H 'Origin: http://localhost:3000' "$@"; }`.

---

## Q0 — Static checks · PASS

| Command | Result |
| --- | --- |
| `pnpm --filter api lint` (oxlint) | exit 0, no findings |
| `pnpm --filter api build` (`nest build`, type-checks) | exit 0 |
| `tsc --noEmit` | exit 0 |

The API started from a clean checkout with no `.env` file — every setting has a working default —
and mapped all 14 new and existing routes.

## Q1 — Authentication unchanged · PASS

| Check | Observed |
| --- | --- |
| `GET /dashboard?year=2025` with no session | `401` |
| `POST /imports/sample` with no session | `401` (before any file is read) |
| `POST /auth/login` | `200` `{"user":{"id":1,"email":"demo@tentwenty.local"}}` |
| `GET /auth/me` | `200`, same user |
| `POST /auth/logout` | `204` |
| `GET /dashboard` after logout | `401` |
| `GET /health` (never authenticated) | `200` `{"status":"ok"}` |

## Q2 — Empty state · PASS

| Check | Observed |
| --- | --- |
| `GET /periods` on an empty database | `200` `{"years":[],"defaultYear":null,"hasData":false,"warnings":[]}` |
| `GET /imports` on an empty database | `200` `{"imports":[],"loaded":{"timesheet":false,"salaries":false,"projects":false}}` |
| `GET /projects/UNKNOWN` | `404` |
| `GET /dashboard?year=abc` | `400` |

Neither empty-state endpoint errors.

## Q3 — Import all three supplied workbooks · PASS

`POST /imports/sample` loaded all three in one call.

| File | rowsAccepted | periods | warnings |
| --- | ---: | ---: | ---: |
| `project-prices-2025.xlsx` | 11 (11 inserted, 0 updated) | — | 0 |
| `salaries-2025.xlsx` | 144 | 12 | 0 |
| `timesheet-2025.xlsx` | 562 | 12 | 0 |

`loaded: {timesheet: true, salaries: true, projects: true}`.

- The salary workbook's **row-2 header** under the `Salary Overview 2025 (AED)` title was found,
  and the year came from that title — no `year` field was sent.
- `Sales month` values written `January '25` parsed alongside the timesheet's `January 2025`.
- **No warning names `Tentwenty`** — it is an internal category, so it is not expected to have a
  price.

## Q4 — The assessment's self-check · PASS

`GET /dashboard?year=2025`, overhead `0`:

```
cost              2400000
knownSalaries     2400000
expectedCost      2400000
allocatedCost     2400000
unallocatedCost   0
difference        0
balances          true
salariesComplete  true
```

**Total cost equals total salaries exactly**, and `difference` is `0`, not merely within
tolerance.

## Q5 — Every month reconciles independently · PASS

| Month | Hours | Billable | Cost | Allocated revenue | difference | balances |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| January | 1,634.60 | 1,283.50 | 197,000.00 | 237,590.90 | 0.0000 | true |
| February | 1,655.30 | 1,242.20 | 197,000.00 | 374,375.54 | 0.0000 | true |
| March | 1,642.90 | 1,230.70 | 197,000.00 | 311,011.81 | 0.0000 | true |
| April | 1,652.60 | 1,264.90 | 197,000.00 | 381,919.23 | 0.0000 | true |
| May | 1,663.40 | 1,261.10 | 197,000.00 | 421,439.63 | 0.0000 | true |
| June | 1,641.00 | 1,222.10 | 197,000.00 | 524,083.70 | 0.0000 | true |
| July | 1,646.60 | 1,300.80 | 203,000.00 | 642,430.95 | 0.0000 | true |
| August | 1,676.90 | 1,256.10 | 203,000.00 | 617,110.57 | 0.0000 | true |
| September | 1,630.20 | 1,259.50 | 203,000.00 | 422,396.15 | 0.0000 | true |
| October | 1,688.90 | 1,247.90 | 203,000.00 | 569,540.71 | 0.0000 | true |
| November | 1,631.00 | 1,371.00 | 203,000.00 | 236,961.19 | 0.0000 | true |
| December | 1,651.80 | 1,325.80 | 203,000.00 | 273,139.63 | 0.0000 | true |

Each month's cost equals that month's salary bill exactly.

## Q6 — Year figures and monthly aggregation · PASS

Year: `totalHours` 19,815.20 · `billableHours` 15,265.60 · `nonBillableHours` 4,549.60 ·
`productivity` 0.7704 · `cost` 2,400,000 · `allocatedRevenue` 5,012,000 · `bookedRevenue`
5,012,000 · `profit` 2,612,000 · `margin` 0.5211.

Summing the twelve monthly responses:

| Figure | Sum of months | Year | Delta |
| --- | ---: | ---: | ---: |
| totalHours | 19,815.20 | 19,815.20 | 0 |
| billableHours | 15,265.60 | 15,265.60 | 0 |
| cost | 2,400,000.00 | 2,400,000.00 | 0 |
| allocatedRevenue | 5,012,000.01 | 5,012,000.00 | 0.01 |

The one cent is rounding across twelve already-rounded responses, not a modelling error.

## Q7 — Monthly revenue uses the lifetime denominator · PASS

This is the check that would fail if the denominator were period-filtered.

- The twelve monthly `allocatedRevenue` figures sum to **5,012,000.01** — the sum of every price.
  A period-filtered denominator would have credited each month with a full price and totalled far
  more.
- `Q2025001a`'s five monthly figures — 237,590.90 + 144,387.15 + 98,553.48 + 22,472.56 +
  56,995.90 — sum to **559,999.99**, its price of 560,000 to the cent.
- `lifetimeShareOfHours` for `Q2025001a` in March is `0.176`, and `98,553.48 / 560,000 = 0.176`.

## Q8 — Project detail against an independently worked example · PASS

Worked by hand from the workbooks before the code existed — January 2025, Ayesha Rahman (10201):

```
salary                 = 18,000
her January hours      = 176.0
direct cost rate       = 18,000 / 176.0                     = 102.272727 / h
January indirect pool  =                                      72,612.93
January billable hours =                                       1,283.50
indirect cost rate     = 72,612.93 / 1,283.50               =  56.574156 / h
employee cost          = 135.9 x (102.272727 + 56.574156)   =  21,587.29
```

`GET /projects/Q2025001a` observed:

| Figure | Observed | Independently worked |
| --- | ---: | ---: |
| price | 560,000 | 560,000 |
| hours | 3,025.20 | 3,025.20 |
| cost | 468,776.21 | 468,776.21 |
| profit | 91,223.79 | 91,223.79 |
| profitability | 0.1629 | 0.1629 |
| January cost | 197,000.00 | 197,000.00 |
| Ayesha: hours / cost / revenueShare / profitability | 311.80 / 50,586.14 / 57,717.84 / 0.1236 | identical |
| Rohit Menon profitability | 0.3029 | 0.3029 |
| Lina Haddad profitability | 0.0046 | 0.0046 |

**Invariants:** employee costs sum to 468,776.21 (= project cost); revenue shares sum to
560,000.01 (= price); month costs sum to 468,776.21; department hours sum to 3,025.20.

## Q9 — Departments, categories, productivity · PASS

Departments (year): Design 6,335.90 h / 815,242.13 · Backend 5,815.30 / 744,890.03 · Frontend
3,876.30 / 461,897.47 · App 1,558.40 / 229,106.13 · QA 1,416.70 / 148,864.24 · Management 812.60 /
0.00. **Hours sum to 19,815.20, cost to 2,400,000.00, allocated revenue to 5,012,000.00.**
Design's three nested employees sum to its own totals exactly.

Categories (year): eleven rows, hours summing to 19,815.20 and `directCost` summing to
**2,399,999.99** — total salaries to the cent, the property that makes the column safely addable.

Productivity (year): company 0.7704; Kevin D'Souza 0.8295, Ayesha Rahman 0.8060, Sara Al Marzooqi
0.7364, Hana Yousef and Omar Zayed `0` (genuine zeros — hours logged, none billable).

## Q10 — Dimensions are preserved, not collapsed · PASS

Read directly from the scratch database after importing the 562-row workbook:

| Check | Observed |
| --- | --- |
| `SELECT COUNT(*) FROM timesheet_entries` | **562** — one stored row per source row, nothing merged |
| distinct departments | 6 |
| distinct categories | 11 |
| salaries / projects / employees | 144 / 11 / 12 |

Department and category drilldowns therefore see every dimension the source recorded.

## Q11 — Repeat upload does not duplicate · PASS

Uploading `timesheet-2025.xlsx` a second, then a third time: year figures identical each time
(19,815.20 h, 2,400,000 cost, 5,012,000 allocated revenue). Idempotence comes from period
replacement, not from deduplication.

## Q12 — Corrected month preserves the rest of the year · PASS

A March-only workbook with one hours value raised by 10:

```
before  1634.60 1655.30 1642.90 1652.60 1663.40 1641.00 1646.60 1676.90 1630.20 1688.90 1631.00 1651.80
after   1634.60 1655.30 1652.90 1652.60 1663.40 1641.00 1646.60 1676.90 1630.20 1688.90 1631.00 1651.80
```

`periodsReplaced: ["March 2025"]`, 50 rows. March moved by exactly +10; the other eleven months
are unchanged. Re-uploading the full timesheet restored 1,642.90.

## Q13 — A blank salary month clears that month · PASS

A salary workbook whose only column is `March` and whose cells are all blank:

| Check | Observed |
| --- | --- |
| Response | `rowsAccepted: 0`, `periodsReplaced: ["March 2025"]` |
| March | `cost` 0, `knownSalaries` 0, `completeness.cost` `partial`, `profit`/`margin` `null`, twelve `employee_without_salary` issues |
| April | `cost` 197,000, `salariesComplete` true — untouched |
| After re-uploading the real salaries | March `cost` back to 197,000 |

Scope came from the header column, not the values, so a correction can remove salaries as well as
change them.

## Q14a — The indirect rate keeps the assessment's denominator · PASS

The check that a missing salary does not get quietly loaded onto colleagues. March, with **Ayesha
Rahman's** salary removed — she has 139.7 billable hours that month, so this is the case a
narrowed denominator would distort.

| Field | Observed |
| --- | ---: |
| `billableHours` (the denominator) | **1,230.70** — unchanged, her hours still counted |
| `billableHoursUncosted` | 139.70 |
| `knownSalaries` | 179,000 |
| `allocatedCost` | 170,471.11 |
| `uncostedIndirectCost` | **8,528.89** |
| `difference` | 0 · `balances` true |
| `salariesComplete` | false · `completeness.cost` partial |
| `profit` / `margin` | `null` |

Nobody else's rate rose to cover her. The AED 8,528.89 of pool that landed on her hours is
reported as unattributable, and the reconciliation still ties because that remainder is accounted
for rather than hidden — `allocatedCost + uncostedIndirectCost = expectedCost`.

## Q14b — Partial cost propagates to every grouping · PASS

Same state (March incomplete). Checked at each level:

| Level | Observed |
| --- | --- |
| `/departments?month=3` | all six departments `costComplete: false`, all `margin: null`, costs still reported as known subtotals |
| Backend's employees | Imran Sheikh 25,402.96, Nadia Kapoor 20,606.47, Vikram Nair 18,034.07 — **all `margin: null`** although each has a salary on record |
| `/projects/Q2025009b` months | March `costComplete: false`, cost `null`; **April 106,612.65, May 40,585.22, June 28,410.81, July 44,337.45 all `costComplete: true`** with real figures |
| its employees | Ayesha `cost: null`; Rohit 36,829.09, Tariq 30,814.14, Grace 24,564.00 — costs present, **every `profitability: null`** |
| its departments | Design `null`; Frontend 55,378.14, Backend 50,948.68, each `costComplete: false` |

A colleague whose own salary is known still has their profitability withheld, because the month's
indirect rate is understated for everyone in it. Months outside the gap keep their figures — the
withholding is precise, not blanket.

## Q14c — An unpriced project stays visible and openable · PASS

A ref code `Q2025099z` with 100 billable hours and no price row:

| Check | Observed |
| --- | --- |
| Appears in `GET /projects?year=2025&month=6` | yes — `priced: false`, `price: null` |
| Name | `Orion-Portal-Redesign-COMMERCIAL.pdf`, taken from the timesheet's task-name column |
| Client | `Orion Labs`, from the company column |
| `GET /projects/Q2025099z` | **`200`**, opens normally |
| Revenue fields | `periodAllocatedRevenue` 0, `periodMargin` `null`, every `revenueShare` and `profitability` `null` |
| Flagging | import warning `project_without_price` (100.00 billable hours) and `completeness.revenue: "partial"` |
| Internal categories | still excluded — January's list is `["Q2025001a"]`, no `FC - *`, no `Tentwenty` |

Membership is decided by category, not by whether a price exists.

## Q14 — Missing salary vs genuine zero · PASS

March, with Omar Zayed (00102, salary 25,000) omitted from the salary workbook:

```
cost              172000        (197,000 - 25,000 -- not silently treated as zero cost)
profit            null          withheld
margin            null          withheld
knownSalaries     172000
difference        0
balances          true          arithmetic ties over the inputs that exist
salariesComplete  false         the dataset is incomplete -- reported separately
employeeMonthsMissingSalary  1
completeness.cost partial
issue             employee_without_salary: "00102 logged hours in March 2025 with no salary on
                  record. Every allocated cost in that month is partial."
```

Then with Omar restored and Hana Yousef (00101) set to a **genuine `0`**:

```
cost              177000        (197,000 - 20,000 -- her real salary, she is inside the model at 0)
profit            134011.81     present
margin            0.4309        present
salariesComplete  true
completeness.cost complete
```

A recorded `0` and an absent value produce different behaviour, as required. `balances: true`
alongside `salariesComplete: false` is exactly the state that keeps arithmetic and completeness
apart.

## Q15 — Missing price does not become zero revenue · PASS

`Q2025001a` re-uploaded with a blank price:

| Field | Observed |
| --- | --- |
| `price`, `profit`, `profitability` | `null` |
| `cost`, `hours` | 468,776.21 and 3,025.20 — still computed |
| every `revenueShare`, every month's `allocatedRevenue` | `null` |
| `completeness.revenue` | `partial`, with `project_without_price` |
| January dashboard `profit` / `margin` | `null` |

Nothing reads as a confident zero. The period's `allocatedRevenue` shows only the known
subtotal — with `completeness.revenue: "partial"` next to it, which is the contract.

## Q16 — Negative margins are not clamped · PASS

`Q2025001a` re-priced at 1,000 against a cost of 468,776.21:

| Field | Observed |
| --- | --- |
| `profit` | −467,776.21 |
| `profitability` | **−467.7762** |
| Ayesha Rahman's `profitability` | **−489.8056** |

Both are far below `-1` and reported as the formula gives them. Restoring the real prices returned
the year to cost 2,400,000 / allocated revenue 5,012,000 / margin 0.5211.

## Q17 — Invalid imports change nothing · PASS

| File | Observed |
| --- | --- |
| PDF renamed `.xlsx` | `422` — `That file is not a readable .xlsx workbook.` |
| `Hours` header renamed `Hrs` | `422` — names the missing column and lists all twelve found |
| three broken rows | `422` — `3 rows could not be read; no data was changed.` then `Row 3: Hours must be a number, found "-".`, `Row 4: Month "Janury 2025" was not recognised.`, `Row 5: Employee No. is required.` |
| 11 MB file | `413` — `File too large`, rejected before buffering |
| no `file` field | `400` — `A spreadsheet is required in the "file" field.` |

After all three rejected imports: year figures unchanged **and** the `GET /imports` count
unchanged at 4. A rejected upload writes no audit row.

## Q18 — Settings changes flow through consistently · PASS

| Change | Observed |
| --- | --- |
| `monthlyOverhead` = 10,000 | year cost 2,400,000 → **2,520,000** (12 x 10,000); March → **207,000**; `expectedCost` rose identically, `balances` still true; `allocatedRevenue` unchanged |
| `Tentwenty` added to billable | `billableHours` 15,265.60 → **15,404.30**; `productivity` 0.7704 → **0.7774**; **`cost` unchanged at 2,400,000**, still balancing; `completeness.revenue` became `partial` with `project_without_price` |
| `{"monthlyOverhead":-1}` | `400`, stored settings unchanged |
| `{"billableCategories":[]}` | `400`, stored settings unchanged |
| `{"nope":1}` | `400`, stored settings unchanged |
| reset to defaults | figures returned to the Q4/Q6 values |

## Q19 — Persistence and schema upgrade · PASS

- **Restart**: stopping and restarting the API left every figure identical (19,815.20 h,
  2,400,000 cost, 5,012,000 allocated revenue).
- **Upgrade over a BE-02-era database**: a database built with only BE-02's `users` and `sessions`
  tables, holding one user and one live session, was opened by the new build on port 4124.

  ```
  before  sessions, sqlite_sequence, users
  after   employees, imports, projects, salaries, sessions, settings, sqlite_sequence,
          timesheet_entries, users
  users preserved:    [{ id: 1, email: 'legacy@tentwenty.local' }]
  sessions preserved: ['legacy-sid']
  health:             {"status":"ok"}
  ```

  New tables added, existing rows untouched, no demo user re-seeded, **no database deletion
  needed**.

## Q20 — Sample data from a clean checkout · PASS

- `apps/api/sample-data/` holds the three workbooks and is tracked — `git check-ignore` reports
  them as not ignored, unlike `temp/`, which `.gitignore` excludes.
- `shasum` matches the originals exactly for all three; the originals were never written to.
- `POST /imports/sample` loaded all three through the ordinary import service methods.

---

## Q21 — No regression on the complete data · PASS

Re-run after the three corrections, with the sample data restored:

| Figure | Observed |
| --- | ---: |
| Year cost | 2,400,000 · `difference` 0 · `balances` true · `salariesComplete` true |
| `uncostedIndirectCost` / `unallocatedCost` | 0 / 0 |
| Hours / billable / productivity | 19,815.20 / 15,265.60 / 0.7704 |
| Allocated revenue / margin | 5,012,000 / 0.5211 |
| Each of the twelve months | cost = its salary bill, `difference` 0 |
| `Q2025001a` | cost 468,776.21 · profitability 0.1629 · `costComplete` true · employee costs sum to 468,776.21 · revenue shares sum to 560,000.01 |
| Ayesha on that project | 311.80 h / 50,586.14 / 57,717.84 / 0.1236 — identical to the hand-worked example |
| Departments | cost 2,400,000 · revenue 5,012,000 · hours 19,815.20 |
| Categories `totalDirectCost` | 2,399,999.99 |

Every figure matches the pre-correction run exactly. The corrections change behaviour only where
an input is missing.

# Coverage audit

## Assessment requirements

| # | Requirement | Endpoint | Check |
| --- | --- | --- | --- |
| M1 | Upload three spreadsheets and persist | `POST /imports/{timesheet,salaries,projects}` | Q3 |
| M2 | Corrected re-upload must not duplicate or destroy the year | replacement rules | Q11, Q12, Q13 |
| M3 | Dashboard: hours, billable, cost, revenue, margin | `GET /dashboard` | Q4, Q5, Q6 |
| M4 | Year and month filter | all period endpoints | Q6, Q7 |
| M5 | Project page: price, hours by department, cost, profit, margin, per-employee table | `GET /projects/:refCode` | Q8 |
| M6 | Productivity per employee, filterable | `GET /productivity` | Q9 |
| M7 | Category page, filterable | `GET /categories` | Q9 |
| S1 | Department drill-down | `GET /departments` | Q9, Q10 |
| S2 | Per-employee profitability | `GET /projects/:refCode` | Q8, Q16 |
| S3 | Configurable assumptions | `GET`/`PUT /settings` | Q18 |
| S4 | Honest empty and error states | warnings, `completeness`, 422s | Q2, Q13–Q17 |
| — | Self-check: full year, zero overhead, cost = salaries | `reconciliation` | Q4, Q5 |
| — | Sample data loaded or loadable in one click | `POST /imports/sample` + tracked workbooks | Q20 |
| — | Runs locally from a clean checkout | no new dependency | Q0 |

Every Must Have and every Should Have is implemented and verified.

## Frontend readiness

Dashboard → `/dashboard` · Project page → `/projects`, `/projects/:refCode` · Productivity →
`/productivity` · Category → `/categories` · Department drill-down → `/departments` · Upload →
`/imports/*`, `/imports` · Filters → `/periods` · Assumptions → `/settings`.

No response requires the frontend to apply a business formula.

## Deliberately excluded

The assessment's four **stretch** goals: CSV export, employee × category matrix, cost-rate audit
view, multi-year side-by-side comparison. Named in the spec's Out of Scope. The **one-click sample
UI** is assigned to the later frontend upload spec; its backend endpoint exists and is verified.

## No deferred backend work

| Command | Result |
| --- | --- |
| `grep -rn "TODO\|FIXME\|not implemented\|placeholder" apps/api/src` | no matches |
| `grep -rniE "jest\|vitest\|supertest\|mock\|\"test\"" apps/api/package.json` | no matches |
| `git diff --stat main -- apps/web package.json pnpm-lock.yaml` | empty |

No stub, no permanent debug endpoint, no testing dependency, no frontend or root-manifest change.
