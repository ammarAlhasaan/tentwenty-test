# Implementation Plan: FE-02 — Frontend Authentication and API Foundation

**Branch**: `005-frontend-authentication` | **Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)

**Worktree**: `/Users/ammaralhasan/Documents/claude-worktree/tentwenty-test/frontend-authentication`,
branched from `main` at `12c5014` — the merge of the reviewed FE-01, including its calculation-removal
and responsive fixes (`942b404`) and the reviewed BE-02 (`3b54229`, `68e76ce`).

## Summary

Give `apps/web` one way to reach the API and one way to know who is signed in, then use both to put
the existing FE-01 screens behind a login.

The technical core is three small modules and one provider change:

- `lib/api.ts` — `apiFetch` over native `fetch`, plus a normalized `ApiError`.
- `lib/auth.ts` — the three endpoint functions, the `["auth","me"]` key, and the query/mutation
  definitions.
- `lib/session.ts` — the one shared session transition (cancel → remove → set signed-out) that the
  `QueryCache`/`MutationCache` callbacks and the sign-out mutation both call.
- `app/providers.tsx` — the retry predicate, the freshness defaults, and the two cache callbacks
  wired into the existing single `QueryClient`.

Around them: a login page in a public route group, an authenticated route group whose layout runs the
gate and renders FE-01's shell unchanged, and a user menu with the current email and a sign-out
button.

The durable output is [contracts/frontend-api-conventions.md](contracts/frontend-api-conventions.md),
which every later FE spec follows.

## Technical Context

**Language/Version**: TypeScript 5, `strict: true`, target ES2017, Node ≥ 24.15.0

**Primary Dependencies**: `next@16.3.4` (App Router), `react@19.2.8`,
`@tanstack/react-query@5.102.8`, Tailwind CSS v4, Base UI, `lucide-react`. **Nothing is added.**

**Storage**: none in `apps/web`. In-memory React Query cache only.

**Testing**: none — no automated tests are added (spec FR-037). Verification is manual plus
`lint` / `tsc` / `build`; see [quickstart.md](quickstart.md).

**Target Platform**: modern evergreen browsers; `apps/web` on port 3000, `apps/api` on port 4000.

**Project Type**: Next.js App Router frontend in a two-application pnpm workspace.

**Performance Goals**: no measurable regression to FE-01's first paint. One `GET /auth/me` per mount
of the authenticated area, ≤ 1 retry on transient failure, no polling.

**Constraints**: no shared code with `apps/api`; no business calculation in `apps/web`; no dependency
added; FE-01's visual design and responsive behaviour preserved byte-for-byte in the page bodies.

**Scale/Scope**: 4 existing routes moved into a route group, 1 new public route, ~7 new files,
2 modified files.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see below.*

| Principle | Assessment |
|---|---|
| **I. Simple, Conventional Code** | Route groups, `layout.tsx`, client components, `useQuery`/`useMutation` and the documented `QueryCache`/`MutationCache` callbacks — all framework-documented mechanisms. No custom router, no event bus, no bespoke state machine. **Pass.** |
| **II. No Speculative Structure** | Every new file traces to a numbered requirement — see [§ Justification per new file](#justification-per-new-file). No barrel files, no base classes, no generic repository, no `features/` scaffolding. The one forward-looking element, the private-key predicate, is required *now* by FR-023/FR-025. **Pass.** |
| **III. Comments Explain the Non-Obvious** | Comments are budgeted for exactly four places where the code would otherwise read as arbitrary: why `401` from `/auth/me` resolves to `null`; why `Content-Type` is omitted for `FormData`; why cancel/remove precedes the seed write; why the gate is not a security boundary. Nothing else is commented. **Pass.** |
| **IV. HTTP-Only Boundary** | `AuthUser`, `AuthResponse` and `ApiErrorBody` are re-declared in `apps/web`. No import crosses the boundary, no shared package, no generated client. **Pass.** |
| **V. One Side Per Spec** | `apps/web` only. Zero files under `apps/api` are touched. **Pass.** |
| **VI. One Spec Per Side At A Time** | FE-01 (`003`) is complete, reviewed and merged to `main`. No other `apps/web` spec is in flight. `004-assessment-backend` targets `apps/api` and shares no file with this branch. **Pass** — and see [§ Independence from spec 004](#independence-from-spec-004). |
| **VII. Libraries That Remove Complexity** | No dependency added. Research checked each decision against the *installed* versions, including reading `@tanstack/query-core@5.102.8`'s emitted types where the published guide was silent (mutation retry default, mutation callback arity). **Pass.** |
| **VIII. Verified Results Only** | No result is claimed in this plan. Every gate in [tasks.md](tasks.md) Phase 8 requires the command to be run and its real output reported. **Pass.** |

### Constitution re-check after Phase 1

The design did not add structure. Two points were re-examined:

- **`lib/session.ts` as a third module** — could its ~20 lines fold into `lib/auth.ts`? They could,
  but `providers.tsx` must import the transition and `lib/auth.ts` imports nothing from
  `providers.tsx`; keeping them separate makes the dependency direction obvious and keeps the
  policy in a file whose name says what it is. Judged a real seam, not speculative structure.
- **Route groups `(app)` and `(auth)`** — they add two directories and no routes. Justified by
  FR-029: the login page must not render the application chrome, and the gate must wrap every
  authenticated route without being repeated in each one. This is the documented App Router mechanism
  for exactly that.

No entry is needed in Complexity Tracking.

## Independence from spec 004

`004-assessment-backend` is planned in parallel in its own worktree on `apps/api`. Constitution
Principle VI permits this only if the frontend spec does not depend on the backend spec's unlanded
contract. It does not:

- The only endpoints consumed are `POST /auth/login`, `GET /auth/me` and `POST /auth/logout`, all
  landed in BE-02 and merged to `main`.
- No assessment endpoint is called. The dashboard, projects, productivity and categories pages keep
  FE-01's placeholder figures verbatim.
- The private-key predicate and the `enabled`-gating rule are written and exercised against zero
  private queries. When 004's endpoints land, a later FE spec adds `lib/projects.ts` and inherits
  both by convention.

**Deferred to a later FE spec**: displaying real assessment data, spreadsheet upload (the `FormData`
path in `apiFetch` is built and left unused for it), and any private query at all.

## Project Structure

### Documentation (this feature)

```text
specs/005-frontend-authentication/
├── spec.md
├── research.md
├── data-model.md
├── plan.md                                  # this file
├── quickstart.md                            # manual verification guide
├── tasks.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── api-consumption.md                   # what we rely on from BE-02, + contract review
    └── frontend-api-conventions.md          # the durable rules for all later FE specs
```

### Source Code (repository root)

```text
apps/web/
├── .env.example                             # NEW — NEXT_PUBLIC_API_URL
├── app/
│   ├── layout.tsx                           # MODIFIED — document + providers only; shell moves out
│   ├── providers.tsx                        # MODIFIED — retry policy, freshness, cache callbacks
│   ├── error.tsx                            # unchanged
│   ├── loading.tsx                          # unchanged
│   ├── not-found.tsx                        # unchanged (must stay at the root)
│   ├── globals.css                          # unchanged
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                     # NEW — /login
│   └── (app)/
│       ├── layout.tsx                       # NEW — gate + FE-01's header/nav/main shell
│       ├── page.tsx                         # MOVED from app/page.tsx, body unchanged
│       ├── projects/page.tsx                # MOVED, body unchanged
│       ├── productivity/page.tsx            # MOVED, body unchanged
│       └── categories/page.tsx              # MOVED, body unchanged
├── lib/
│   ├── api.ts                               # NEW — apiFetch, ApiError, isApiError, isAbortError
│   ├── auth.ts                              # NEW — endpoints, authKeys, query/mutation definitions
│   ├── session.ts                           # NEW — the shared session transition + returnTo allowlist
│   ├── format.ts                            # unchanged
│   └── utils.ts                             # unchanged
├── components/
│   ├── auth-gate.tsx                        # NEW — client gate: loading / error / signed-out / children
│   ├── login-form.tsx                       # NEW — the form and its inline errors
│   ├── user-menu.tsx                        # NEW — current email + sign-out
│   ├── app-nav.tsx                          # unchanged
│   ├── empty-state.tsx                      # unchanged
│   ├── error-state.tsx                      # possibly extended with an optional message prop
│   ├── stat-card.tsx                        # unchanged
│   └── ui/                                  # unchanged (button, card, skeleton, table)
└── README.md                                # MODIFIED — carries the conventions document
```

**Structure Decision**: FE-01's existing three-directory layout (`app/`, `lib/`, `components/`) is
kept. Two route groups are added because the public and authenticated areas need different chrome;
no other directory is created. The four existing page files move without their contents changing, so
the diff shows renames and the preserved design is verifiable by inspection.

### Justification per new file

| File | Requirement that forces it | Why it is not folded into another file |
|---|---|---|
| `lib/api.ts` | FR-001 … FR-008 | The single transport; nothing else may call `fetch`. |
| `lib/auth.ts` | FR-009, FR-011, FR-012, FR-014 | Feature-owned endpoints and keys; the transport must not know about endpoints. |
| `lib/session.ts` | FR-018, FR-020, FR-023 … FR-027 | Imported by both `providers.tsx` and `lib/auth.ts`; keeping it separate keeps the import direction acyclic. |
| `app/(app)/layout.tsx` | FR-029, FR-030 | One gate for four routes; App Router's documented mechanism. |
| `app/(auth)/login/page.tsx` | FR-022 | The public route, without the application chrome. |
| `components/auth-gate.tsx` | FR-030, FR-031 | A client component, so the layout stays a thin server file; also the single place a redirect can originate. |
| `components/login-form.tsx` | FR-017, FR-022, spec US-2 | Form state must be local; keeps the page a server component. |
| `components/user-menu.tsx` | FR-022, FR-024, FR-026 | Current user display and sign-out; the only consumer of the sign-out mutation. |
| `.env.example` | FR-002 | Documents the one setting; there is currently none. |

## Implementation Notes

### `apiFetch`

```ts
apiFetch<T>(path: string, options?: {
  method?: "GET" | "POST";
  body?: unknown;          // JSON-encoded, unless it is FormData
  signal?: AbortSignal;
}): Promise<T>
```

Behaviour, in order: build the URL from `NEXT_PUBLIC_API_URL`; set `Accept: application/json`; if
`body` is `FormData`, attach it with **no** `Content-Type` so the browser's boundary survives,
otherwise `JSON.stringify` it and set `Content-Type: application/json`; always
`credentials: "include"`; forward `signal`. Await `fetch` inside a `try` — a rejection that is not an
`AbortError` becomes `ApiError { kind: "network" }`; an `AbortError` is re-thrown untouched. Then
check `response.ok`: on failure read the body as text and `JSON.parse` it inside a nested `try`,
producing `ApiError { kind: "http", status, messages, body }` with a status-text fallback. On
success, return `undefined` for `204` or an empty body, otherwise the parsed JSON.

It contains no routing, no hooks, no notifications and no cache access (FR-008).

### `lib/auth.ts`

Endpoint functions — `login(input, signal)`, `logout(signal)`, `fetchMe(signal)` — each a two-line
`apiFetch` call. `fetchMe` is the one function that catches: an `ApiError` with `status === 401`
resolves to `null` (research Decision 7); everything else propagates.

`meQueryOptions()` returns `{ queryKey: authKeys.me(), queryFn: ({ signal }) => fetchMe(signal),
staleTime: 30_000 }`, so the same definition serves the gate, the user menu, and the login page's
"already signed in" check — one key, one definition, one in-flight request (FR-011).

`useLogin()` and `useLogout()` carry `mutationKey: ["auth", "login" | "logout"]` and `retry: false`.
The mutation key is what lets the central `MutationCache.onError` recognise that an auth mutation's
`401` is its own business (conventions § 4.3).

`useLogin().onSuccess` performs FR-023 in order: `await clearPrivateCache(qc)` →
`qc.setQueryData(authKeys.me(), data.user)` → `router.replace(safeReturnTo(param))`.

### `lib/session.ts`

```ts
clearPrivateCache(qc)      // await qc.cancelQueries(); qc.removeQueries({ predicate: notAuthKey })
endSession(qc)             // clearPrivateCache, then setQueryData(authKeys.me(), null)
safeReturnTo(value)        // allowlist lookup, default "/"
```

`endSession` is the whole 401 policy. It is idempotent, shows nothing, and navigates nowhere — the
gate observes the resulting `null` and navigates once (research Decision 6). `cancelQueries` aborts
in-flight requests through the forwarded `signal`, and `removeQueries` detaches the query objects, so
a response from a previous session has nowhere to land (FR-025).

`RETURN_TO` is the literal list `["/", "/projects", "/productivity", "/categories"]`; anything else
yields `"/"` (FR-027, research Decision 10).

### `app/providers.tsx`

The existing `useState(() => new QueryClient())` gains its configuration — the shared retry
predicate, `mutations: { retry: false }` — and the two cache callbacks:

- `QueryCache.onError(error, query)`: if `isApiError(error) && error.status === 401 &&
  query.queryKey[0] !== "auth"` → `endSession(qc)`. The `/auth/me` `401` never arrives here, because
  it resolved to `null`.
- `MutationCache.onError(error, _vars, _onMutateResult, mutation)`: same condition, keyed on
  `mutation.options.mutationKey?.[0] !== "auth"`. Note the v5.102.8 parameter order (conventions
  § 3.11).

The client and the caches are created together inside the one `useState` initialiser so the callbacks
can close over the client without a mutable reference.

### `components/auth-gate.tsx`

A client component reading `useQuery(meQueryOptions())` and rendering exactly one of four things:

| Condition | Render |
|---|---|
| `isPending` | the shell's skeleton — no private content, no form |
| `isError` | `ErrorState` with a retry that calls `refetch()`; **no navigation** |
| `data === null` | nothing, and `router.replace("/login?…")` from an effect |
| `data` | `children` |

The redirect fires from an effect guarded so it runs once per transition, and carries `returnTo`
(the current pathname, if it is on the allowlist) and, when the component had previously seen an
authenticated user, `reason=expired` — which is how the login page knows to say the session ended
rather than showing a bare form (spec US-4 scenario 3). Tracking that prior state in a ref inside the
gate avoids a second piece of global state.

### `components/login-form.tsx`

Local `useState` for email, password and visibility. Submits through `useLogin()`. Renders the
mutation's error by status: `401` → invalid credentials; `400` → the backend's field-prefixed
messages; `429` → rate limited, try again shortly; `403` → a configuration problem; `kind:
"network"` or `status >= 500` → cannot reach the service, retry. The submit button is disabled while
`isPending`. Standard `type="email"` / `type="password"` and `autoComplete` values so password
managers work.

### `components/user-menu.tsx`

Reads the same `meQueryOptions()` — the same key, so no extra request — and renders the email plus a
sign-out button. `useLogout().onSuccess` → `endSession(qc)` → `router.replace("/login")`. Its
`onError` renders an inline failure with a retry and performs **no** state transition (FR-026).

### Preserving FE-01

The four page files move into `(app)/` with their contents unchanged. `app/layout.tsx` keeps `<html>`,
`<body>`, the fonts, the metadata and `<Providers>`; the header, the two `<nav>` elements and
`<main>` move verbatim into `(app)/layout.tsx`, with the user menu added to the header's flex row.
`app/not-found.tsx`, `app/loading.tsx`, `app/error.tsx` and `globals.css` are untouched. Verifying
"the design is preserved" is then a matter of reading a rename diff.

## Security boundaries

| Boundary | Enforced by | Notes |
|---|---|---|
| Authentication | `apps/api` — `AuthService` + `express-session` | The frontend proves nothing; it asks. |
| Authorization | `apps/api` — `SessionAuthGuard` | The only real boundary (FR-032). |
| CSRF | `apps/api` — `OriginCheckGuard` | No frontend counterpart (research Decision 11). |
| Session confidentiality | the browser — `HttpOnly` | Never read by application code (FR-028). |
| Route visibility | `apps/web` — the client gate | **UX only.** Hides chrome and prevents pointless requests. |

The gate is knowingly the shape Next.js calls "not recommended" for authorization. It is acceptable
here for one reason that must remain true: **no route beneath it server-renders private data**
(FR-033, research Decision 3). The moment that changes, the check moves to the data access point.

## Deployment assumptions

- `apps/web` and `apps/api` are different origins in every environment; `apps/api` allowlists exactly
  the frontend origin and returns `Access-Control-Allow-Credentials: true`.
- `NEXT_PUBLIC_API_URL` is inlined at **build** time. Changing the API origin means rebuilding
  `apps/web` — a promotion pipeline that reuses one artifact across environments would need a
  different mechanism, which is out of scope here (research Decision 9).
- Production serves both over HTTPS, so the session cookie's `Secure` attribute applies. Over plain
  HTTP in production the cookie would never be delivered and the application would appear to be in a
  permanent signed-out state.
- The browser must allow the cookie. A third-party-cookie blocker matters only if the two
  applications end up on unrelated registrable domains; same-site subdomains are unaffected.

## Contract mismatches requiring backend coordination

**None.** Every requirement maps onto BE-02 as landed — see
[contracts/api-consumption.md § Contract review](contracts/api-consumption.md#contract-review-no-mismatches-found).

One forward-looking note for whoever implements BE-03: protected endpoints must signal expiry with
the same `401` body from `SessionAuthGuard`. This feature's central policy keys on that; an endpoint
that signalled expiry differently would bypass it silently.

## Complexity Tracking

No Constitution Check violations. Table intentionally empty.

## Phasing

1. Setup — environment setting, worktree dependencies.
2. Transport — `lib/api.ts`.
3. Auth data layer — `lib/auth.ts`, `lib/session.ts`.
4. Provider policy — `app/providers.tsx`.
5. Route boundaries — route groups, layouts, page moves.
6. UI — login form, gate, user menu.
7. Conventions document into `apps/web/README.md`.
8. Verification — lint, types, build, then the manual guide.

See [tasks.md](tasks.md). **Implementation begins only after this plan is reviewed.**
