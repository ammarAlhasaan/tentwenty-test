# Quickstart & Verification — FE-04

## Running it

```bash
cd ~/Documents/claude-worktree/tentwenty-test/frontend-design-migration
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter api exec prisma migrate deploy
pnpm --filter api dev     # :4000
pnpm --filter web dev     # :3000
```

Sign in as `demo@tentwenty.local` / `demo-password-2026`, then press **Load the
sample workbooks** on the Dashboard's empty state.

**If the web app is not on :3000**, `FRONTEND_ORIGIN` must match it or the API
answers without an `Access-Control-Allow-Origin` header and every request fails.
Editing `apps/api/.env` was not reliably picked up in this environment; passing
it in the environment was:

```bash
FRONTEND_ORIGIN=http://localhost:3001 pnpm --filter api dev
```

## Commands actually run — 2026-09-10

| Command | Result |
| --- | --- |
| `pnpm --filter web exec tsc --noEmit` | clean |
| `pnpm --filter web lint` | clean |
| `pnpm --filter web build` | ✓ 10 routes, 9 static + `/projects/[refCode]` dynamic |

ESLint caught one real defect in this work: the `useMemo` added to
`projects-view.tsx` sat behind the empty-list early return, breaking the rules of
hooks. Fixed by moving the memo above the return.

## Browser verification — actually performed

Against the running API with the sample workbooks loaded, on a production build
(`next build` + `next start`) as well as `next dev`.

| Check | Result |
| --- | --- |
| **A1** month not in the year, by URL | `/?year=2026&month=7`: chip reads "July 2026", the month control reads "July — no data" and is disabled, the empty state reads "Nothing logged in July 2026". All three agree — previously the control silently read "Whole year". |
| **G2** period chip | Renders beside the title on all five period-scoped screens ("2025", "March 2025"), and is absent on the first-run empty state. |
| **G3** first-run sample import | Database deleted and re-migrated. The Dashboard offered "Load the sample workbooks" and "Go to uploads"; pressing the first filled every screen **with no reload** — 2025 reads AED 5,012,000 revenue, AED 2,400,000 cost, +52.1% margin. |
| **G1** completeness action | `Tentwenty` ticked billable on Assumptions makes March partial: the banner switches to its unknown tone, profit and margin render as labelled em dashes, and the notice now carries **Open uploads**. Restored afterwards. |
| **C3** period change | Switching month does not blank the table: the previous figures stay while the next load. Verified by sampling the DOM 120 ms after the change — no skeleton, no empty render. |
| **B1** productivity footer | Filtering to Design leaves the footer at the agency's own figures (19,815.2 / 15,265.6 / 77.0%) while the body shows 3 rows. Previously the row was labelled "Agency" while two of its cells were the filtered subset. |
| **B7** table panels | All six table screens render through `TablePanel`; the productivity department filter still sits in the panel header. |
| Screens against the contract | Dashboard, Projects, Departments, Productivity, Categories and `/projects/Q2025001a` all match — the project reads price 560,000, cost 468,776, profit 91,224, +16.3%. |
| **T027** authentication | Deliberate sign-out → plain `/login`, no notice. Sign in again → `/`. Cookie revoked server-side, then a sidebar link → `/login?reason=expired&returnTo=%2Fcategories` with the notice shown. |
| **T028** 375 px | No horizontal overflow on any of the seven screens; sign-out present on all of them. |

## T009 — a false negative worth recording

Moving the shell outside `AuthGate` appeared to break hydration: the page stopped
at "Checking your session", no API request was issued, and reverting the change
appeared to fix it. It was dropped on that basis, then restored.

The real cause was that the API process was serving `FRONTEND_ORIGIN=
http://localhost:3000` while the web app ran on `:3001`, so `/auth/me` was
CORS-blocked. `apiFetch` turns that into a network `ApiError`, and with the
automation tab reporting `document.visibilityState === "hidden"`, React Query's
`networkMode: "online"` **pauses the retry** rather than failing it — so the query
stays `pending` for ever and the gate never resolves. That is the behaviour
`apps/web/README.md` 3.10 documents, reached by an unexpected route.

Two lessons recorded here rather than lost: a paused retry is indistinguishable
from a slow one on screen, and a bisect is only valid if the environment is held
still — the earlier "revert fixes it" reading was coincidence.

With CORS corrected, T009 behaves as intended: the sidebar and navigation paint
while the session check is still pending (`document.querySelector('aside')`
present against a pending gate), in both dev and a production build.

## Not verified

- **Full page loads in the automation tab are unreliable.** With the tab hidden,
  a hard load intermittently issues no client requests at all — in dev and in
  production alike, with and without T009. Everything above was therefore
  verified through client-side navigation after a sign-in, which is the ordinary
  path. A human should click through one hard reload per screen before delivery.
- **The `AuthGate` "can't reach the service" card**, for the reason in the T009
  note: with the API unreachable the retry pauses instead of failing, so the
  error state is not reached from a hidden tab.
