# Manual Verification: FE-02 — Frontend Authentication and API Foundation

**Spec**: [spec.md](spec.md) · **Branch**: `005-frontend-authentication`

No automated tests exist for this feature by design (FR-037). This guide is the verification. Run
every check and record the real result, including failures (Constitution Principle VIII).

Use a **real browser** — several checks are about cookie behaviour, browser navigation and keyboard
focus, and none of them can be observed from `curl`.

## Setup

**Use an isolated verification database. Do not point the API at a development database, and do not
add a debug endpoint to make any of this easier.**

1. Start the reviewed API from a checkout of `main` (or the `002-authentication` worktree) with a
   throwaway `DATABASE_PATH`, e.g. `DATABASE_PATH=./data/verify-fe02.sqlite`, and
   `FRONTEND_ORIGIN=http://localhost:3000`, on port 4000.
2. Seed **two** accounts — call them **A** and **B** — using whatever seeding path BE-02 documents.
   Two are required for check J.
3. In this worktree: `pnpm install`, then confirm `apps/web/.env.local` contains
   `NEXT_PUBLIC_API_URL=http://localhost:4000`, then `pnpm --filter web dev`.
4. Open `http://localhost:3000` in a browser with DevTools available. Start signed out (a private
   window is the simplest way to guarantee that).

Record for each check: **pass / fail / skipped**, plus what you actually saw.

---

## A. Automated gates

| # | Command | Expected |
|---|---|---|
| A1 | `pnpm --filter web lint` | passes, no new warnings |
| A2 | `pnpm --filter web exec tsc --noEmit` | passes |
| A3 | `pnpm --filter web build` | passes; `/login` and the four application routes are listed |
| A4 | `git diff --stat main` | the four page files appear as renames with no content change |
| A5 | `git diff main -- apps/web/package.json pnpm-lock.yaml` | empty |
| A6 | `grep -rn "fetch(" apps/web/app apps/web/lib apps/web/components` | exactly one file |
| A7 | `grep -rniE "document\.cookie\|localStorage\|sessionStorage\|\bsid\b" apps/web/app apps/web/lib apps/web/components` | no hits |
| A8 | `grep -rn "refetchInterval" apps/web` | no hits |
| A9 | `grep -rniE "test\|spec\|mock\|fixture\|vitest\|jest\|playwright\|cypress" apps/web/package.json` | no hits |

---

## B. Direct protected-route visit while signed out — US1

1. Signed out, open `http://localhost:3000/projects` directly.
2. **Expect**: a brief loading state, then the login page. No flash of the projects table, no
   application header or navigation rail on the login page.
3. In DevTools → Network, confirm exactly one `GET /auth/me` and that it returned `401`.
4. Confirm the URL carries `returnTo=/projects`.
5. Confirm the console shows no error for that `401` — it is the ordinary signed-out answer.

## C. Successful sign-in and safe return navigation — US1

1. From the state left by check B, sign in as account **A**.
2. **Expect**: you land on `/projects`, not `/`.
3. Confirm the header shows A's email.
4. In Network, confirm there is **no** `GET /auth/me` after the successful `POST /auth/login` — the
   current user was seeded from the login response (FR-023).
5. Sign out, then open `/login?returnTo=https://example.com` and sign in. **Expect**: you land on `/`
   and the browser never leaves `localhost:3000`.
6. Repeat with `/login?returnTo=//example.com` and `/login?returnTo=/nope`. Same result each time.

## D. Refresh while signed in — US1

1. Signed in, press reload on `/productivity`.
2. **Expect**: a brief loading state, then `/productivity` again. No sign-in prompt, no redirect.
3. Navigate between all four sections. Confirm at most one `GET /auth/me` within 30 seconds — the
   `staleTime` (FR-015).

## E. Signed-in user visits the login page — US1

1. Signed in, type `http://localhost:3000/login` into the address bar.
2. **Expect**: you end up inside the application, not looking at the form.
3. Confirm no redirect loop — the URL settles once.

## F. Failed sign-in and input validation — US2

1. Sign out. Submit a correct email with a wrong password. **Expect**: an inline invalid-credentials
   message beside the form; you stay on `/login`; no navigation.
2. Submit an email that does not exist. **Expect**: the **same** message — the API does not
   distinguish the two, and neither may the UI.
3. Submit `not-an-email`. **Expect**: a message naming the email field, either from client-side field
   validation or from the API's `400`.
4. Submit with an empty password. **Expect**: a field-level message, no request or a handled `400`.
5. Double-click Submit rapidly. **Expect**: the button disables while the request is in flight; the
   Network panel shows one `POST /auth/login`, not two.
6. Confirm no retry occurred on any of the above — one request per submission (FR-014).

## G. Rate-limit feedback — US2

1. Submit a wrong password **eleven** times in quick succession.
2. **Expect**: the eleventh returns `429` and a rate-limit message appears — distinct from the
   invalid-credentials message.
3. Confirm the Network panel shows **no** automatic retry of the `429` (FR-014).
4. Note: the API's window is in-memory and resets when it restarts — restart it before continuing.

## H. Sign out and browser Back — US3

1. Sign in as **A**, navigate to `/projects`.
2. Choose Sign out. **Expect**: `POST /auth/logout` returns `204`, you land on `/login`, and the
   header no longer shows A's email.
3. Press the browser **Back** button. **Expect**: you do **not** see the previous session's private
   content — the gate re-checks and returns you to the login page.
4. In DevTools → Application → Cookies, confirm `sid` is gone.

## I. Session expiry and a deleted account — US4

1. Sign in as **A** and stay on `/`.
2. Delete A's session server-side (remove the session row from the verification database, or delete
   the account entirely to also cover the deleted-user case).
3. Trigger a request — switch tabs away and back to force a focus refetch.
4. **Expect**: exactly one navigation to `/login`, exactly one "your session ended" notice, and
   `returnTo` set to the page you were on.
5. Sign in again. **Expect**: you return to that page.
6. Repeat with the account **deleted** rather than the session: the API must still answer `401` and
   the UI must behave identically — no crash, no partial signed-in state.

## J. No previous-account data after a new sign-in — US5

1. Sign in as **A**. Open the React Query cache in the React Query DevTools if available, or inspect
   it from the console via the provider.
2. Sign out, then sign in as **B**.
3. **Expect**: the header shows B's email, and **no** cache entry holds any value belonging to A.
4. Repeat without signing out in between: sign in as A, then — in the same tab, by expiring A's
   session server-side and signing in as B — confirm the same result.

## K. Logout or account change with a request in flight — US3, US5

1. Sign in as **A**.
2. Throttle the network to a very slow profile in DevTools so requests take several seconds.
3. Trigger a `GET /auth/me` (switch tabs away and back), and while it is pending, press Sign out.
4. **Expect**: the in-flight request appears as **cancelled** in the Network panel — the abort signal
   reached `fetch` — and when it settles, nothing about A reappears anywhere (FR-025).
5. Remove the throttle.

## L. Multiple concurrent 401 responses — US4

1. Sign in, then invalidate the session server-side.
2. Force several protected requests to fire at once — switching focus back to the tab after
   navigating between sections is the simplest way, or trigger a refetch from the DevTools panel.
3. **Expect**: one navigation to `/login` and one notice, regardless of how many `401`s appeared in
   the Network panel (SC-006, FR-020).

## M. Backend unavailable, without a redirect loop — US6

1. Stop the API entirely.
2. Load `http://localhost:3000/` while signed out. **Expect**: a recoverable error with a retry —
   **not** the login page, not a loop between routes. The URL must not change.
3. Press Retry. **Expect**: one further attempt, which fails the same way.
4. Restart the API and press Retry. **Expect**: the application recovers without a manual reload.
5. Signed in, stop the API and trigger a request. **Expect**: a recoverable error and you remain
   signed in — the header still shows your email (FR-019).
6. Confirm the retry predicate: a network failure produced at most **two** attempts total, and never
   four (FR-014).

## N. Sign-out failure — US3

1. Sign in, then stop the API.
2. Choose Sign out. **Expect**: an inline failure with a retry; the application does **not** claim
   you were signed out; the header still shows your email; you are not navigated to `/login`
   (FR-026).
3. Restart the API and press Retry. **Expect**: the sign-out completes normally.

## O. HttpOnly cookie behaviour in a real browser — FR-028

1. Signed in, in DevTools → Application → Cookies, confirm `sid` shows **HttpOnly** ✓ and
   `SameSite=Lax`. In local development `Secure` is expected to be **unset** — that is BE-02's
   documented development behaviour.
2. In the console, run `document.cookie`. **Expect**: the session cookie is absent from the output.
3. Confirm no request from `apps/web` sends a cookie value in a header, a URL parameter or a body.

## P. Keyboard and responsive behaviour — SC-009

1. On the login page, `Tab` through: email → password → visibility toggle → submit. Confirm a visible
   focus ring on each and that `Enter` submits from any field.
2. Confirm a password manager offers to fill and to save the credentials.
3. Confirm the error message is associated with the form so it is announced, not merely coloured.
4. Sign in and view every section at **375 px**, **768 px** and **1440 px**. Confirm each matches
   FE-01 exactly, including the mobile navigation bar and the desktop rail, with the user menu added
   to the header and no horizontal scrolling at any width.
5. Confirm the loading and error states of the gate are also legible at 375 px.

## Q. Scope and boundary

1. `git diff main --stat -- apps/api` is empty.
2. No file under `apps/web` imports anything from `apps/api`.
3. No business calculation was added to `apps/web` — the placeholder figures on the four pages are
   unchanged.
4. No assessment endpoint is called anywhere.
5. `apps/web/README.md` (or `apps/web/docs/api-conventions.md`) carries the conventions document with
   its **[library]** / **[ours]** tags and source links intact.

---

## Notes found while running these checks

> Record anything surprising here rather than fixing it silently — including checks that could not be
> run and why.

| # | Check | What happened | Action |
|---|---|---|---|
| | | | |

---

## Sign-off

| | |
|---|---|
| Verified by | |
| Date | |
| API commit verified against | |
| Verification database | |
| Checks passed | / |
| Checks failed | |
| Checks skipped | |
