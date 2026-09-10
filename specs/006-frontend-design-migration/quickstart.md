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

## Second review follow-up verification — 2026-09-10

| Check | Result |
| --- | --- |
| `pnpm --filter web exec tsc --noEmit` | clean |
| `pnpm --filter web lint` | clean (two unused imports left by the trim were removed) |
| `pnpm --filter web build` | ✓ 10 routes: 9 static, `/projects/[refCode]` dynamic |
| **P1** Choosing a file | Selecting `my-timesheet.xlsx` staged it — name and size shown, "Upload and replace" and "Cancel" offered, **no request sent**. |
| **P1** Confirming | Pressing "Upload and replace" runs the import; a rejected file reports the API's own message. |
| **P2** Network failure | API stopped, then an upload confirmed: "Couldn't confirm the result of this import … The import may have been applied, or it may never have arrived." with a **Refresh the history** button. The phrase "nothing was changed" does not appear. |
| **P2** Refresh after a network failure | Pressed with the API back up: the history reloaded (4 rows). |
| **P2** HTTP rejection still definite | A text file named `.xlsx`: "Import failed — nothing was changed · That file is not a readable .xlsx workbook." — correct, because the API answered. |
| **P2** Overhead field | `step="any"`; `1234.5` reports `checkValidity() === true` with no validation message, and saved successfully. |
| **P2** Project page | "Month by month" and the department share bars are gone; the page is Verdict, three metrics, "Hours and cost by department" and "Employee contribution" — the reference design's shape. |

### Partial completeness — now verified

Produced through the app's own UI rather than by editing data: `Tentwenty` was ticked as billable
on the Assumptions screen. It has hours and a ref code but no price row, which is exactly the gap
the completeness contract describes.

- The banner switched to its third tone: *"We can't tell yet — the figures behind this month are
  incomplete."*
- Profit and Margin rendered as em dashes carrying the accessible label "Missing from the source
  data" — not zeroes.
- Cost and Revenue still showed their known subtotals.
- The scoped notice read *"Revenue for March 2025 is a known subtotal, not the whole answer ·
  Tentwenty has billable hours in this period and no usable price, so its revenue is unknown."*
- On Projects, that row carried a **no price on file** tag, an em dash price, `AED 0` revenue — a
  genuine zero — and em dashes for profit and margin.

The assumption was restored to `["Projects", "Enhancements", "Hosting"]` with overhead `0`
afterwards.

### Session expiry — now verified

Previously unreachable; the reporting queries made it reachable, because a protected endpoint other
than `/auth/me` can now answer `401`.

1. Signed in, then revoked the cookie server-side with a direct `POST /auth/logout`, leaving the
   client still holding a signed-in session.
2. Followed a sidebar link (a client-side navigation, so the app keeps having "seen" a user) to a
   screen whose query was not cached.
3. That query answered `401`, the central policy ended the session, and `AuthGate` navigated to
   **`/login?reason=expired&returnTo=%2Fdepartments`** with "Your session ended · Please sign in
   again to carry on." shown once.

For contrast, a **full page load** with a revoked cookie reaches `/login?returnTo=…` with **no**
expiry notice — correct, since a session the client never saw cannot have expired (README 6.3).

## Third review follow-up verification — 2026-09-10

| Check | Result |
| --- | --- |
| `pnpm --filter web exec tsc --noEmit` | clean |
| `pnpm --filter web lint` | clean |
| `pnpm --filter web build` | ✓ 10 routes: 9 static, `/projects/[refCode]` dynamic |
| **P2** Per-import confirmation copy | Timesheet — *"replaces every hour already recorded for the months this file covers"*, **Upload and replace**. Salary overview — *"…for the months this file has columns for — a blank column clears that month"*, **Upload and replace**. Project prices — *"adds the projects in this file and updates the ones already on record, matching on Ref Code. Projects the file does not mention are left exactly as they are"*, **Upload and update**. Each was read off the rendered card. |
| Copy checked against the API | `ImportsService.importTimesheet` and `importSalaries` `deleteMany` the periods their file covers before `createMany`; `importProjects` upserts by `refCode` with the comment *"A catalogue upload that omits a project is far more likely to be partial than to mean delete it"*, and returns `periodsReplaced: []`. |
| **P2** Body-read failure on a **successful** import | `window.fetch` wrapped so the request reached the server and was applied, while `response.text()` rejected with a plain `TypeError`. The card reported **"Couldn't confirm the result of this import"** with **Refresh the history**; the phrase "nothing was changed" did not appear. |
| …and the import really had landed | Pressing **Refresh the history** took it from 4 rows to 5, newest `project-prices-2025.xlsx · projects · 11`. This is the case the old wording would have described as "nothing was changed". |
| HTTP rejection still definite | A 1-byte file named `.xlsx` returned `422` and reported "Import failed — nothing was changed". |
| Notice layout | With an action button in a one-third-width card the message previously wrapped to two words per line; the action now drops below it. Verified on the uncertain-result notice. |
| Baseline data intact afterwards | March 2025 still reports AED 114,012 profit and +36.7% margin. |

### Still not verified

- **The `AuthGate` "can't reach the service" card.** With the API stopped the session check's retry
  is *paused* rather than failed — documented behaviour for a hidden tab under
  `networkMode: "online"` (README 3.10) — and the automation tab never reports itself visible, so
  the retry never resumes to produce the error state.
