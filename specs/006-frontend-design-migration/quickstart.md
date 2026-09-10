# Quickstart & Verification — FE-03

## Running it

```bash
cd ~/Documents/claude-worktree/tentwenty-test/frontend-design-migration
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter api dev     # :4000, seeds demo@tentwenty.local on first start
pnpm --filter web dev     # :3000
```

If port 3000 is taken, Next picks the next free port and `FRONTEND_ORIGIN` in
`apps/api/.env` must be changed to match, or the API answers `403` (the
`OriginCheckGuard` doing its job). That is what happened during this verification
run: the web app ran on **:3001** and `FRONTEND_ORIGIN` was set to
`http://localhost:3001`.

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
| Dashboard, 1440 — against the prototype | Matches: sidebar proportions, purple banner, 4+1 KPI wrap, mono figures, sample notice, warning banner, legend row. |
| Five metrics present | Total hours, Billable hours (with share bar), Cost, Revenue, Margin. |
| No table, no chart on the Dashboard | Confirmed — the FE-01 placeholder Projects table is gone. |
| Period filter → `?year=2025&month=7` | Empty state "Nothing logged in July 2025" with a "Go to March 2026" action. |
| "Go to March 2026" | URL became `?year=2026&month=3`; the figures returned. |
| **Network panel** | Only `/auth/me`, `/auth/login`, `/auth/logout` and their preflights. **No request to any assessment endpoint.** |
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
