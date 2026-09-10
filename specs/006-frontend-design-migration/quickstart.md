# Quickstart & Verification — FE-03

## Running it

```bash
cd ~/Documents/claude-worktree/tentwenty-test/frontend-design-migration
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter api exec prisma migrate deploy
pnpm --filter api dev     # :4000, seeds demo@tentwenty.local on first start
pnpm --filter web dev     # :3000
```

If port 3000 is taken, Next picks the next free port and `FRONTEND_ORIGIN` in
`apps/api/.env` must be changed to match, or the API answers `403` (the
`OriginCheckGuard` doing its job). That is what happened during this verification
run: the web app ran on **:3001** and `FRONTEND_ORIGIN` was set to
`http://localhost:3001`.

Then sign in and press **Load the sample workbooks** on the Uploads screen — no curl needed.

If a pre-Prisma `apps/api/data/margin.sqlite` exists, `prisma migrate deploy` fails with `P3005`.
Delete the file and re-run it; the demo user is re-seeded on the next start.

## Commands actually run — 2026-09-10

| Command | Result |
| --- | --- |
| `pnpm --filter web exec tsc --noEmit` | exit 0, no output |
| `pnpm --filter web lint` | exit 0, no findings |
| `pnpm --filter web build` | ✓ compiled; TypeScript ✓; 8/8 static pages; routes `/`, `/_not-found`, `/categories`, `/login`, `/productivity`, `/projects` all prerendered static |

## Browser verification — actually performed

Prototype served from `~/Downloads/design-system/project` on `:8912`; the
application on `:3001`. Both rendered at **1440x900** and at **375x812**.

| Check | Result |
| --- | --- |
| Sign-in, 1440 — layout against the prototype | Matches: split panel, brand mark, field sizing, indigo panel. The prototype's demo-credentials hint is deliberately absent. |
| Sign-in with a wrong password | `POST /auth/login` → 401; inline danger notice "Invalid email or password."; **no navigation**. |
| Sign-in with the demo credentials | `POST /auth/login` → 200; navigated to `/`. |
| Dashboard, 1440 — against the prototype | Matches: sidebar proportions, purple banner, 4+1 KPI wrap, mono figures, legend row. |
| Five metrics present | Total hours, Billable hours (with share bar), Cost, Revenue, Margin. |
| No table, no chart on the Dashboard | Confirmed — the FE-01 placeholder Projects table is gone. |
| Period filter → `?year=2026&month=7` (not loaded) | Empty state "Nothing logged in July 2026", and **no `/dashboard` request was made** — the `enabled` gate held. |
| **Network panel** | `/auth/*`, `GET /periods` and `GET /dashboard?year=&month=` — nothing else. Paired `ERR_ABORTED` entries show the `signal` genuinely aborting superseded requests. |
| Section navigation | `/projects`, `/productivity`, `/categories` each render the design's empty state; `aria-current` highlight follows. |
| 404 | `/nowhere` renders the restyled not-found with a route back. |
| Mobile 375 | Sidebar collapses to a scrollable section bar; **sign-out stays visible in the header**; `document.scrollWidth === window.innerWidth` — no horizontal overflow. |
| Skip link | First focusable element is `<a href="#main">Skip to content</a>`; `#main` exists. |
| Sign-out at mobile width | `POST /auth/logout` → landed on a plain `/login`, **no** `reason=expired`. |
| Revoked session cookie, then reload of `/projects` | Redirected to `/login?returnTo=%2Fprojects` — correct: a session the client never saw cannot "expire" (README 6.3). |
| Signing in from that page | Returned to `/projects`. |
| `/login?reason=expired` | Shows "Your session ended · Please sign in again to carry on." once. |
| Already signed in, visiting `/login` | Navigated straight to `/`. |

## Not verified, and why

- **The in-session expiry notice end to end.** Reaching it requires a live client
  session whose next `/auth/me` answers 401. With the API stopped, the request
  failed with `ERR_CONNECTION_REFUSED` and the retry **paused**, leaving the
  session-check loading state — exactly what README 3.10 documents for a hidden
  tab under `networkMode: "online"`. The automation tab reported
  `document.visibilityState === "hidden"` throughout, so the focus-driven refetch
  that ends the pause could not be triggered. The redirect and the notice were
  each verified separately (rows above); the code joining them is 005's and was
  not modified.
- **The `AuthGate` "Can't reach the service" card**, for the same reason.
- **Dark mode**, beyond adding tokens: the app has no theme switch, so the block
  was written but not exercised.

## Integration verification — after 004 landed

API running with the three supplied workbooks loaded via `POST /imports/sample`
(11 project rows, 144 salary rows, 562 timesheet rows accepted).

| Check | Result |
| --- | --- |
| Whole year 2025 | `GET /dashboard?year=2025` → 19,815.2 h · 15,265.6 billable · 77.0% · AED 2,400,000 cost · AED 5,012,000 revenue · AED 2,612,000 profit · +52.1% margin. Rendered figures match the response field for field. |
| March 2025 | `GET /dashboard?year=2025&month=3` → 1,642.9 h · 1,230.7 billable · 74.9% · AED 197,000 · AED 311,012 earned (AED 330,000 sold) · AED 114,012 profit · +36.7% margin. Matches the response and the published contract. |
| Nothing calculated in the browser | Every figure is a response field passed through a formatter. `productivity` and `margin` arrive as ratios and go straight to `formatShare` / `formatPercent`. |
| Period filter options | Years and months come from `GET /periods`; only 2025 and its twelve months are offered, plus "Whole year". |
| Banner scope wording | "made money this month" for March; "made money in 2025" for the whole-year view. |
| Empty database | Database deleted and re-migrated: the Dashboard shows "No data has been ingested yet" and the period filter is not rendered. |
| Signed-out gating | With the session unresolved, neither `/periods` nor `/dashboard` is requested. |
| Mobile 375, live data | No horizontal overflow; sign-out present; banner and cards stack. |
| `tsc --noEmit`, `lint`, `build` | Re-run after the integration — all three clean. |

### Still not verified

- **The partial-completeness banner.** The supplied workbooks are complete
  (`completeness.cost` and `.revenue` both `complete`, zero issues), so the
  `partial` branch was never rendered. Reaching it needs a dataset with a missing
  salary or an unpriced ref code. The branch is written against the documented
  `completeness.issues[]` shape and compiles; it has not been seen on screen.

## Review follow-up verification — 2026-09-10

Everything below was performed against the running API in a browser, after the four review findings
were addressed.

| Check | Result |
| --- | --- |
| `pnpm --filter web exec tsc --noEmit` | clean |
| `pnpm --filter web lint` | clean (one real finding fixed on the way: `setState` inside an effect in the assumptions form, replaced with a keyed remount) |
| `pnpm --filter web build` | ✓ 10 routes: 9 static, `/projects/[refCode]` dynamic |
| **P1-1** Projects | 11 projects for 2025 with price, hours, cost, revenue earned, profit and margin; totals only over the additive columns. |
| **P1-1** Project page | `Q2025001a`: price 560,000 · cost 468,776 · profit 91,224 · profitability +16.3% · 3,025.2 h — matches `GET /projects/Q2025001a` exactly, including January's 197,000. |
| **P1-1** Departments | March 2025: six departments totalling 1,642.9 h and AED 197,000 — the same totals the Dashboard reports. The nested drill-down shows Design's three people. Management reads a genuine `AED 0` cost and an em-dash margin. |
| **P1-1** Productivity | Twelve people for 2025, sorted by productivity, with the department filter. |
| **P1-1** Categories | Eleven categories, billable/internal tags, shares and direct cost, totalling AED 2,399,999.99. |
| **P1-2** Empty instance | Database deleted and re-migrated: Dashboard shows "No data has been ingested yet" with a link to Uploads. |
| **P1-2** Sample button | Pressed in the UI on the empty instance: the three workbooks imported, results listed per file, and the Dashboard filled in (2025: AED 5,012,000 revenue, +52.1% margin) **without a reload**. |
| **P1-2** Real upload | `project-prices-2025.xlsx` put through the file input: 11 rows accepted, import history refreshed on its own. This is the multipart path through `apiFetch`, not the sample endpoint. |
| **P1-2** Rejected upload | A text file named `.xlsx`: "Import failed — nothing was changed · That file is not a readable .xlsx workbook." — the API's own message. |
| **P2-4** Warning scope | The Dashboard now renders only the selected period's `completeness.issues`; `/periods` standing warnings render on Uploads, labelled "standing gaps in the loaded data". |
| Assumptions save | Overhead 0 → 50,000 saved: March cost went 197,000 → 247,000, profit 114,012 → 64,012, margin +36.7% → +20.6%, with no reload. The API recalculated; the frontend did no arithmetic. Reset to 0 afterwards. |
| Mobile 375 | Projects: no page overflow, the table scrolls inside its own container, sign-out present. |
| Navigation | Both design groups (Reporting, Data) render; every entry leads to a route that shows something. |

### Still not verified

- **The month-fallback path (P2-3) end to end.** The fix is in
  `usePeriodScope.selectPeriod`, but every year in the supplied dataset holds all twelve months, so
  no year exists that a selected month could be stripped by. The related case *is* covered: a
  period reached by URL that the data does not hold shows the empty state and issues no
  `/dashboard` request.
- **The partial-completeness banner.** The supplied workbooks are complete
  (`completeness.cost` and `.revenue` both `complete`, zero issues), so the `partial` branch still
  has not rendered. It is written against the documented `issues[]` shape and compiles.
- **The in-session expiry notice end to end**, and the `AuthGate` "can't reach the service" card —
  unchanged from the previous run, and for the same reason: the automation tab never becomes
  visible, so React Query's paused retry never resumes.
