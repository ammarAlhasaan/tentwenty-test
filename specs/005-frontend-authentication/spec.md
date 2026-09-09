# Feature Specification: FE-02 — Frontend Authentication and API Foundation

**Feature Branch**: `005-frontend-authentication`

**Created**: 2026-09-10

**Status**: Implemented — awaiting code review

**Scope**: `apps/web` only (per Constitution Principle V)

**Consumes**: BE-02's landed HTTP contract — [`specs/002-authentication/contracts/auth.md`](../002-authentication/contracts/auth.md) and BE-01's [error contract](../001-backend-foundation/contracts/errors.md). Nothing here depends on BE-03 / spec 004.

**Input**: User description: "Frontend Authentication and API Foundation. One centralized `apiFetch` transport with a normalized error shape; React Query conventions every later FE spec follows; a login page, current-user display, logout, and an authenticated application shell; centralized session-expiry handling; cache isolation across sessions. Frontend only. No business calculations, no backend changes, no automated tests."

## Overview

FE-01 shipped a shell with placeholder figures and no HTTP traffic at all. BE-02 shipped a
cookie-based session API. This spec is the join: it gives `apps/web` its first and only way to talk
to the API, and puts the whole application behind a sign-in.

Two deliverables that outlive this feature:

1. **A transport and error convention.** One `apiFetch` function, one `ApiError` shape. Every later
   FE spec calls the API through it, so status handling, credential handling and error normalization
   are decided once rather than per page.
2. **A React Query convention.** Query keys, retry policy, freshness, and a single shared rule for
   what happens when the session goes away. Written down in a conventions document so FE-03 onward
   inherits it instead of re-inventing it.

Everything else — the login page, the current-user display, the logout button, the authenticated
shell — is the smallest real feature that exercises those conventions end to end.

**The client-side gate is a user-experience boundary, not a security boundary.** `SessionAuthGuard`
in `apps/api` remains the only thing that actually authorizes access to data. This distinction is
load-bearing and is stated again in the requirements, the plan, and the conventions document.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and reach the dashboard (Priority: P1)

A director opens the tool, is asked for an email and a password, enters them, and lands on the
dashboard they were trying to reach. The browser holds the session; nothing about it is visible to
or readable by the page.

**Why this priority**: Without this, the application has no users. Every other story in this spec is
a variation on it.

**Independent Test**: With the reviewed API running against a verification database, open the app
signed out, sign in with the seeded credentials, and observe the dashboard.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor at `/`, **When** the page loads, **Then** the private dashboard is
   never shown and the visitor is taken to the login page.
2. **Given** the login page, **When** correct credentials are submitted, **Then** the visitor reaches
   the dashboard and their email is displayed in the application shell.
3. **Given** a signed-out visitor who tried to open `/projects`, **When** they sign in, **Then** they
   arrive at `/projects` rather than at `/`.
4. **Given** a signed-in user, **When** they reload the page, **Then** they stay signed in and the
   dashboard is shown again without a second sign-in.
5. **Given** a signed-in user, **When** they navigate to `/login` directly, **Then** they are sent
   into the application rather than shown the form again.

---

### User Story 2 - Be told exactly what went wrong when signing in fails (Priority: P1)

A wrong password, a malformed email, too many attempts, and a backend that is down are four
different situations. The form says which one happened, next to the form, and lets the person try
again.

**Why this priority**: A login form that fails opaquely is indistinguishable from a broken
application, and the API deliberately returns the same body for an unknown email and a wrong
password — so the frontend has to carry the explanation.

**Independent Test**: Submit a wrong password, an invalid email, and eleven failed attempts in
sequence; stop the API and submit again. Confirm four distinct, non-overlapping messages.

**Acceptance Scenarios**:

1. **Given** the login form, **When** a wrong email/password pair is submitted, **Then** an
   invalid-credentials message appears beside the form, the password field is not cleared silently
   without explanation, and the visitor is not redirected anywhere.
2. **Given** the login form, **When** the email is not a valid address, **Then** the field-level
   problem is shown and no request is sent, or the API's 400 detail is shown — either way the message
   names the field.
3. **Given** more than ten failed attempts inside the API's window, **When** another attempt is
   submitted, **Then** a rate-limit message is shown and no automatic retry is issued.
4. **Given** the API is unreachable, **When** credentials are submitted, **Then** a "cannot reach the
   service, try again" message is shown, the visitor is *not* told they are signed out, and a retry
   is available.

---

### User Story 3 - Sign out, and stay signed out (Priority: P1)

A user signs out on a shared machine. The session ends on the server, nothing of theirs remains in
the page, and pressing Back does not put it back.

**Why this priority**: A sign-out that leaves the previous user's data recoverable in the browser is
a data-exposure defect, not a polish item.

**Independent Test**: Sign in, sign out, press the browser Back button, then replay the captured
session cookie.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they choose Sign out and the API confirms, **Then** they are
   taken to the login page and the shell no longer shows their email.
2. **Given** the user has just signed out, **When** they press the browser Back button, **Then** they
   do not see the previous session's private content.
3. **Given** the sign-out request fails (backend down), **When** the failure returns, **Then** the
   application does **not** claim the user was signed out, keeps them where they are, and offers a
   clear retry.
4. **Given** a private request was in flight when Sign out was chosen, **When** that response
   arrives, **Then** it does not repopulate any private content.

---

### User Story 4 - Have an expired session handled once, not four times (Priority: P2)

A user leaves the tab open past the session lifetime and comes back. The application notices on the
next request, ends the local session, and sends them to sign in again — once, with one message, even
if several requests failed at the same moment.

**Why this priority**: Expiry is the normal end of every session. Handled per-page it produces
redirect loops and stacked error messages; handled centrally it is a single well-defined transition.

**Independent Test**: Sign in, delete the session server-side (or wait out the TTL), then trigger
several requests at once.

**Acceptance Scenarios**:

1. **Given** a signed-in user whose session has expired, **When** any protected request returns 401,
   **Then** the application transitions to signed-out, cancels outstanding private requests, discards
   private cached content, and navigates to the login page exactly once.
2. **Given** three protected requests fail with 401 at the same moment, **When** they are handled,
   **Then** one message is shown and one navigation occurs.
3. **Given** the user is returned to the login page by an expiry, **When** the page renders, **Then**
   it says the session ended rather than showing a blank form with no explanation.
4. **Given** the session expired while the user was on `/productivity`, **When** they sign in again,
   **Then** they return to `/productivity`.

---

### User Story 5 - Never see the previous account's data (Priority: P2)

Two people share a machine. The second person signs in and sees their own data from the first frame.

**Why this priority**: This is the single most damaging failure mode of a client-side cache, and it
is invisible in casual testing because it only appears when accounts change.

**Independent Test**: Sign in as account A, sign out, sign in as account B, and inspect every screen
plus the React Query cache for A's values.

**Acceptance Scenarios**:

1. **Given** a successful sign-in, **When** the application renders, **Then** the current user shown
   comes from that sign-in response and no cached value from a previous session survives.
2. **Given** a request issued under account A is still in flight, **When** account B signs in and it
   resolves, **Then** its result is discarded rather than written into the cache.

---

### User Story 6 - Know the difference between "signed out" and "broken" (Priority: P2)

The API is down. The user sees an honest "we cannot reach the service" with a retry — not a sign-in
page implying their session ended, and not an endless bounce between two routes.

**Why this priority**: Misclassifying a network failure as a sign-out is the classic cause of the
redirect loop, and it destroys trust in the sign-in state.

**Independent Test**: Stop the API, then load `/` directly and navigate around.

**Acceptance Scenarios**:

1. **Given** the API is unreachable, **When** the session check runs, **Then** a recoverable error
   state with a retry is shown and no navigation to the login page occurs.
2. **Given** the API returns a 500 to a protected request, **When** it is handled, **Then** the user
   stays signed in and sees a recoverable error.
3. **Given** the session check has not yet resolved, **When** the page renders, **Then** a loading
   state is shown and no private content and no login form are shown.

---

### Edge Cases

- **`returnTo` pointing off-site.** `/login?returnTo=https://evil.example` or
  `?returnTo=//evil.example` must not navigate off the application. Only an explicit allowlist of
  in-app destinations is honoured; anything else falls back to the dashboard.
- **Direct visit to a protected route while signed out.** No flash of private content; the gate
  resolves before anything private renders.
- **Signed-in user opens `/login`.** Sent into the application, not shown the form.
- **Session check resolves 401 on first load.** This is the normal signed-out answer, not an error —
  no error banner, no console noise, no retry storm.
- **Double submit of the login form.** The submit control is disabled while the request is in flight;
  no second session is created.
- **Backend reachable but returning an unparseable body on failure.** The error is still surfaced
  with its HTTP status; the transport does not throw while trying to read it.
- **`204 No Content` from logout.** The transport must not attempt to parse an empty body.
- **Password managers and autofill.** The form uses standard field names/types so autofill works.
- **Rapid navigation during the session check.** Cancelling and remounting must not produce a
  redirect loop or a duplicate message.

## Requirements *(mandatory)*

### Functional Requirements

**HTTP transport**

- **FR-001**: All API traffic from `apps/web` MUST go through one `apiFetch` function built on native
  `fetch`. No component may issue a raw `fetch` to the API or parse an API response itself.
- **FR-002**: `apiFetch` MUST resolve the API origin from one environment setting, and MUST send
  `credentials: "include"` on every request.
- **FR-003**: `apiFetch` MUST set JSON request headers only when it is sending a JSON body, and MUST
  leave `Content-Type` unset for `FormData` bodies so the browser's multipart boundary survives.
- **FR-004**: `apiFetch` MUST check `response.ok`, MUST return parsed JSON for successful JSON
  responses, and MUST return no value for `204` without attempting to parse the body.
- **FR-005**: Every failed HTTP response MUST be normalized into one error shape carrying the HTTP
  status and the backend's human-readable messages. A failure body that is absent or not JSON MUST
  still produce that shape, with a fallback message, and MUST NOT cause a second error.
- **FR-006**: Network failures and cancellations MUST be distinguishable from HTTP failures by
  anything that catches them.
- **FR-007**: `apiFetch` MUST accept an `AbortSignal` and forward it to `fetch`.
- **FR-008**: `apiFetch` MUST NOT contain routing, React hooks, notifications, or cache mutations.
- **FR-009**: Endpoint functions MUST live in the feature file that owns them, not in the transport.

**React Query conventions**

- **FR-010**: The existing `QueryClientProvider` with its one stable `QueryClient` MUST be reused;
  no second client is created.
- **FR-011**: The current user MUST have exactly one query key and one query definition, `["auth",
  "me"]`, used everywhere the current user is displayed or checked.
- **FR-012**: Reads MUST be queries; sign-in and sign-out MUST be mutations.
- **FR-013**: Query keys MUST include every input that changes the data returned.
- **FR-014**: Sign-in and sign-out mutations MUST NOT retry automatically. `400`, `401`, `403` and
  `429` responses MUST NOT be retried. Cancelled requests MUST NOT be retried. Transient read
  failures MAY be retried at most once.
- **FR-015**: The freshness and refetch behaviour of the current-user query MUST be stated explicitly
  in the conventions document. Polling MUST NOT be used.
- **FR-016**: React Query MUST be the only frontend cache for user and session data. No Zustand auth
  store, no duplicate `isAuthenticated` flag, no user data in `localStorage` or `sessionStorage`.
- **FR-017**: Form field values and password visibility MUST stay local to the form component.

**Error and session policy**

- **FR-018**: One shared policy MUST handle session expiry for both queries and mutations, using
  React Query's own `QueryCache` / `MutationCache` callbacks. No custom event bus.
- **FR-019**: The policy MUST distinguish: a `401` from sign-in (invalid credentials, shown inline);
  a `401` from the current-user check (the ordinary signed-out answer); a `401` from any other
  protected request (session expiry); `403` (forbidden operation — **not** an automatic sign-out);
  `400` (validation feedback); `429` (rate-limit feedback, no automatic retry); network failures and
  `5xx` (recoverable, and **never** reported as signed out).
- **FR-019a**: Distinguishing a `401` from the current-user check MUST NOT exempt it from cleanup.
  Discovering expiry through `GET /auth/me` MUST stop private requests, remove private cached data,
  set the current user to signed-out, and drive the same single UI transition as a protected `401`.
  A first visit while already signed out MUST produce no expiry notification and no refetch or
  redirect loop.
- **FR-019b**: `cancelQueries` does not cancel mutations. A mutation started under a previous session
  MUST NOT populate the new user's cache, invalidate the new user's data, sign the new user out
  because its response returned `401`, or trigger stale navigation or notifications. The mechanism
  MUST be the smallest explicit one — a client-local session generation captured when an operation
  starts and checked before session-sensitive callbacks — and MUST NOT be a second user or auth
  store, a Zustand store, or an event bus.
- **FR-019c**: Exactly one component MUST own navigation for each session transition. A successful
  deliberate sign-out MUST reach the ordinary login page with no expired-session message; an actual
  expiry MAY show that message once. Cleanup left over from an old session MUST NOT overwrite a
  newer successful sign-in.
- **FR-020**: Identical `onError` handling MUST NOT be repeated across pages, and several requests
  failing together MUST NOT produce several messages or several navigations.
- **FR-021**: Expected request failures MUST surface in form or page state. `app/error.tsx` remains
  reserved for uncaught rendering failures.

**Authentication flow**

- **FR-022**: The application MUST provide a login page, a display of the signed-in user, a sign-out
  action, an authenticated application shell, and explicit loading and recoverable-failure states for
  the session check.
- **FR-023**: On a successful sign-in the application MUST, in order: cancel and remove any private
  cached data from a previous session; seed the current-user cache from the sign-in response itself;
  then navigate to the intended permitted destination.
- **FR-024**: On a successful sign-out the application MUST cancel outstanding private queries, remove
  private cached data, set the current user to signed-out, and navigate to the login page.
- **FR-025**: A response belonging to a previous session MUST NOT be able to repopulate private cached
  data after a sign-out or an account change. Query cancellation signals MUST be forwarded to `fetch`.
- **FR-026**: A failed sign-out request MUST NOT be reported as a successful sign-out. A clear retry
  MUST be offered.
- **FR-027**: Post-sign-in destinations MUST be validated against a small explicit allowlist of
  in-app routes. External and protocol-relative targets MUST be rejected in favour of the default
  destination.
- **FR-028**: Frontend JavaScript MUST NOT read, decode, copy, or store the `HttpOnly` session cookie,
  and MUST NOT introduce any second session or token mechanism.

**Routing and Next.js boundaries**

- **FR-029**: The root layout MUST keep the shared document structure and providers. The public login
  page MUST be separated from the authenticated application shell, and MUST NOT acquire the
  authenticated application chrome.
- **FR-029a**: The application loading and error boundaries MUST sit at the segment where the shell
  is rendered, so a page's loading state and a page's rendering failure both appear inside the shell.
  Root fallbacks and the global not-found page MUST remain coherent for routes outside that shell.
- **FR-030**: The current-user check MUST resolve before any private UI is displayed. Private queries
  MUST NOT start while the session state is unresolved or signed-out.
- **FR-031**: Direct visits, reloads, in-app navigation and expiry MUST all be handled without a
  redirect loop.
- **FR-032**: The client gate MUST be documented as a UX boundary. The API's guards remain the
  authorization boundary.
- **FR-033**: No private data may be placed into server-rendered HTML or the RSC payload behind only a
  client-side gate. If server-side private fetching is introduced later, it MUST verify the session
  server-side against the API at that data-access point.
- **FR-034**: No `proxy.ts` may be added solely to test whether the session cookie exists. The API's
  session secret and database MUST NOT be replicated into `apps/web`. No Next.js authentication
  framework, BFF layer, or duplicate API routes are introduced.

**Scope**

- **FR-035**: Changes are confined to `apps/web`. FE-01's visual design and responsive fixes MUST be
  preserved.
- **FR-036**: No business calculations are performed in `apps/web`. No integration with BE-03 or spec
  004 endpoints.
- **FR-037**: No automated tests, test dependencies, mocks, fixtures, test configuration, or test
  scripts are added.
- **FR-038**: A "Frontend API conventions" document MUST be produced, distinguishing documented
  library behaviour (with source links) from this project's own choices, and MUST be the reference
  every later FE spec follows.

### Key Entities

- **Current user** — `{ id: number, email: string }`, as returned by the API. Three states are
  distinguished: *unresolved* (the check has not answered), *signed out* (the check answered `401`),
  and *signed in* (a user object). A fourth, *unavailable* (network/5xx), is an error state and is
  explicitly **not** "signed out".
- **API error** — HTTP status plus the backend's message list, normalized. Network failure and
  cancellation are separate categories, not statuses.
- **Session cookie** — owned entirely by the browser and the API. Never touched by application code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of `apps/web` finds `fetch(` in exactly one file.
- **SC-002**: A search of `apps/web` finds no reference to the session cookie name, no
  `document.cookie`, and no `localStorage` / `sessionStorage` write of user or session data.
- **SC-003**: The current-user query key `["auth", "me"]` is defined in exactly one place and every
  consumer imports it.
- **SC-004**: With the API stopped, loading `/` shows a recoverable error with a retry and produces
  zero navigations to `/login`.
- **SC-005**: Signing in as a second account after a first shows no value belonging to the first, in
  the UI or in the React Query cache.
- **SC-006**: Three simultaneous `401` responses produce exactly one message and one navigation.
- **SC-007**: `pnpm lint`, `tsc --noEmit`, and `pnpm build` for `apps/web` all pass.
- **SC-011**: Expiry discovered through `GET /auth/me` leaves no private cache entry behind.
- **SC-012**: A private mutation started under one session and resolving after another has begun
  writes nothing and signs nobody out.
- **SC-013**: A deliberate sign-out reaches `/login` with no `reason=expired`.
- **SC-008**: `apps/web/package.json` gains no dependency, and no test tooling appears anywhere.
- **SC-009**: Every FE-01 page renders at 375 px, 768 px and 1440 px exactly as it did before, inside
  the authenticated shell.
- **SC-010**: The whole login → use → sign out → Back cycle is completed in a real browser with
  DevTools confirming the cookie is `HttpOnly` and unreadable from the console.

## Assumptions

- The reviewed BE-02 API is running at `http://localhost:4000` with `FRONTEND_ORIGIN` set to
  `http://localhost:3000`, against a verification database that is not a development database.
- At least one seeded account exists; a second account is available for the account-change checks.
  Creating accounts is out of scope for `apps/web` — there is no sign-up endpoint in BE-02.
- `apps/web` and `apps/api` remain different origins in every environment. `SameSite=Lax` on the
  session cookie is sufficient because the frontend only ever issues same-site top-level navigations
  and cross-origin XHR carrying the cookie via `credentials: "include"`, which `Lax` permits for the
  cookie's own site. This is BE-02's decision and is not revisited here.
- In production both applications are served over HTTPS, so the cookie's `Secure` attribute applies.

## Out of scope

Sign-up, password reset, password change, "remember me", multi-factor authentication, roles and
permissions, session listing or remote sign-out, refresh tokens, server-side rendering of private
data, and any integration with assessment endpoints that do not yet exist.
