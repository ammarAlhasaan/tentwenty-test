# Tasks: FE-02 — Frontend Authentication and API Foundation

**Branch**: `005-frontend-authentication` · **Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]** — may run in parallel with other `[P]` tasks in the same phase (different files, no
  ordering dependency).
- **[Story]** — the user story from [spec.md](spec.md) this task serves, where it maps to one.

## Path Conventions

All paths are relative to the repository root and all of them are under `apps/web/`. Work happens in
the worktree at
`/Users/ammaralhasan/Documents/claude-worktree/tentwenty-test/frontend-authentication`.

## No tests

Spec FR-037 excludes automated tests. **No** test file, test dependency, mock, fixture, test
configuration or test script is created by any task below. Verification is Phase 8: `lint`, `tsc`,
`build`, and the manual guide in [quickstart.md](quickstart.md), each with its real output reported
(Constitution Principle VIII).

---

## Phase 1: Setup

- [x] **T001** Install workspace dependencies in this worktree: `pnpm install --frozen-lockfile`
      from the worktree root. No `package.json` is edited; the lockfile must be unchanged afterwards
      (`git status` clean for `pnpm-lock.yaml`).
- [ ] **T002** Create `apps/web/.env.example` containing only
      `NEXT_PUBLIC_API_URL=http://localhost:4000`, with a one-line comment saying it is the origin of
      `apps/api` and that the value is inlined at build time.
- [ ] **T003** Create the local, untracked `apps/web/.env.local` with the same value. Confirm
      `.env*.local` is already ignored by the repository's `.gitignore`; if it is not, add it —
      do not commit an env file.
- [ ] **T004** Confirm the baseline before changing anything: run `pnpm --filter web lint`,
      `pnpm --filter web exec tsc --noEmit` and `pnpm --filter web build`, and record that they pass
      on the untouched FE-01 code. A later failure is then attributable.

---

## Phase 2: Foundational — the transport (blocking prerequisite)

**Blocks everything after it.** No UI task may begin until `lib/api.ts` exists.

- [ ] **T005** Create `apps/web/lib/api.ts` with the API base URL read once from
      `process.env.NEXT_PUBLIC_API_URL`, and the duplicated `ApiErrorBody` type (FR-002).
- [ ] **T006** In the same file, add the `ApiError` class — `kind`, `status`, `messages`, `body`,
      with `message` set from `messages[0]` — plus `isApiError` and `isAbortError` helpers
      (FR-005, FR-006).
- [ ] **T007** In the same file, implement `apiFetch<T>(path, { method, body, signal })`:
      `credentials: "include"` unconditionally; `Accept: application/json`; `Content-Type:
      application/json` with `JSON.stringify` **only** for non-`FormData` bodies, and no
      `Content-Type` at all for `FormData`; `signal` forwarded to `fetch`
      (FR-002, FR-003, FR-007).
- [ ] **T008** In the same file, implement the response handling: `response.ok` checked explicitly;
      `204` and empty bodies return without parsing; failures read as text and `JSON.parse`d inside a
      `try` so a non-JSON body still yields an `ApiError` with the right status and a status-text
      fallback; a `fetch` rejection becomes `kind: "network"` while an `AbortError` is re-thrown
      unchanged (FR-004, FR-005, FR-006).
- [x] **T009** Comment only the non-obvious decisions in `lib/api.ts` — there is no target number
      (Constitution Principle III).

### Dependency guard — must pass before Phase 3

- [ ] **T010** `apps/web/lib/api.ts` contains no `import` from `next/*` or `react`, no reference to
      any query client, and no `window` access. Verify by reading the file's import block. If any is
      present, FR-008 is violated and the file must be corrected before continuing.

---

## Phase 3: Auth data layer

- [ ] **T011** [US1] Create `apps/web/lib/auth.ts` with the duplicated `AuthUser`, `AuthResponse` and
      `LoginInput` types, and the `authKeys` object exporting `authKeys.me()` as `["auth", "me"]`
      (FR-011).
- [ ] **T012** [US1] In the same file, add the three endpoint functions — `login(input, signal)`,
      `logout(signal)`, `fetchMe(signal)` — each calling `apiFetch` and each accepting and forwarding
      an `AbortSignal` (FR-009, FR-025).
- [ ] **T013** [US6] Make `fetchMe` resolve to `null` for an `ApiError` with `status === 401`, and
      propagate everything else. Comment *why* — this is the line that keeps "signed out" and
      "backend down" apart (FR-019, research Decision 7).
- [ ] **T014** [US1] Add `meQueryOptions()` returning the shared `{ queryKey, queryFn: ({ signal })
      => fetchMe(signal), staleTime: 30_000 }`. No `refetchInterval` (FR-011, FR-015).
- [ ] **T015** Create `apps/web/lib/session.ts` with `clearPrivateCache(queryClient)`:
      `await cancelQueries()` then `removeQueries({ predicate: q => q.queryKey[0] !== "auth" })`
      (FR-023, FR-024, FR-025).
- [ ] **T016** [US4] In the same file, add `endSession(queryClient)` — `clearPrivateCache`, then
      `setQueryData(authKeys.me(), null)`. It must show nothing and navigate nowhere (FR-018,
      FR-020).
- [ ] **T017** [P] [US1] In the same file, add the `RETURN_TO` allowlist —
      `["/", "/projects", "/productivity", "/categories"]` — and `safeReturnTo(value)` returning `"/"`
      for anything not literally in it (FR-027).
- [ ] **T018** [US1] Add `useLogin()` to `lib/auth.ts`: `mutationKey: ["auth", "login"]`,
      `retry: false`, and an `onSuccess` that runs `clearPrivateCache` → `setQueryData(authKeys.me(),
      data.user)` → `router.replace(safeReturnTo(...))`, **in that order** (FR-014, FR-023).
- [ ] **T019** [US3] Add `useLogout()`: `mutationKey: ["auth", "logout"]`, `retry: false`, and an
      `onSuccess` that runs `endSession` then navigates to `/login`. It must have no `onError` state
      transition — a failed sign-out changes nothing (FR-014, FR-024, FR-026).

---

## Phase 4: Central policy in the provider

- [ ] **T020** [US4] In `apps/web/app/providers.tsx`, keep the single
      `useState(() => new QueryClient(...))` and add the shared retry predicate as the query default:
      never for a cancelled request, never for a 4xx, at most one retry otherwise; plus
      `mutations: { retry: false }` (FR-010, FR-014).
- [ ] **T021** [US4] In the same initialiser, construct the client with a `QueryCache` whose
      `onError(error, query)` calls `endSession` when the error is an `ApiError` with `status === 401`
      **and** `query.queryKey[0] !== "auth"` (FR-018, FR-019).
- [ ] **T022** [US4] Add the matching `MutationCache` `onError`. Use the installed v5.102.8 signature
      `(error, variables, onMutateResult, mutation, context)` and key the exclusion on
      `mutation.options.mutationKey?.[0] !== "auth"`. Do not copy a v4 or early-v5 example
      (FR-018, FR-019, conventions § 3.11).
- [ ] **T023** Confirm the login `401`, the `/auth/me` `401`, `403`, `400`, `429`, `5xx` and network
      failures all reach the correct branch by reading the two callbacks against the table in
      [spec.md](spec.md) FR-019. Every path not routed to `endSession` must fall through to the
      caller untouched (FR-019, FR-021).

---

## Phase 5: Route boundaries

- [ ] **T024** [US1] Create the route group `apps/web/app/(app)/` and `git mv` `page.tsx`,
      `projects/page.tsx`, `productivity/page.tsx` and `categories/page.tsx` into it. **Do not edit
      their contents** — the diff must show renames only (FR-035).
- [ ] **T025** [US1] Create `apps/web/app/(app)/layout.tsx` holding the header, both `<nav>` elements
      and `<main>` moved verbatim out of `app/layout.tsx`, wrapped in the gate, with the user menu
      added to the header's flex row (FR-029, FR-030).
- [ ] **T026** [US1] Reduce `apps/web/app/layout.tsx` to `<html>`, `<body>`, the fonts, the metadata
      and `<Providers>`. `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx` and `globals.css` are
      not touched — `not-found.tsx` in particular must stay at the root (FR-029).
- [ ] **T027** [US1] Create `apps/web/app/(auth)/login/page.tsx`: a server component rendering the
      page frame and `<LoginForm />`, with page metadata and no application chrome (FR-022, FR-029).

---

## Phase 6: The authenticated experience

- [ ] **T028** [US1] [US6] Create `apps/web/components/auth-gate.tsx` as a client component reading
      `useQuery(meQueryOptions())` and rendering exactly one of: a loading state while pending; a
      recoverable `ErrorState` with a `refetch` retry on `isError` — **no navigation**; nothing while
      redirecting when `data === null`; `children` when signed in (FR-030, FR-031, FR-019).
- [ ] **T029** [US4] In the gate, perform the redirect from an effect guarded to fire once per
      transition, carrying `returnTo` (the current pathname, only if it is on the allowlist) and
      `reason=expired` when the component had previously observed an authenticated user (FR-031,
      spec US-4 scenario 3).
- [ ] **T030** [US1] Add a comment at the top of the gate stating that it is a UX boundary and that
      `SessionAuthGuard` in `apps/api` is the authorization boundary (FR-032, Constitution
      Principle III).
- [ ] **T031** [P] [US1] [US2] Create `apps/web/components/login-form.tsx`: local `useState` for
      email, password and visibility; submit through `useLogin()`; submit control disabled while
      pending; standard `type` and `autoComplete` attributes; the error rendered by status —
      `401` invalid credentials, `400` the backend's field-prefixed messages, `429` rate limited,
      `403` configuration, network/`5xx` cannot reach the service (FR-017, FR-019, FR-021).
- [ ] **T032** [US4] In the login page, read `reason=expired` and show a "your session ended, please
      sign in again" notice above the form. It must appear once and only for that reason
      (FR-020).
- [ ] **T033** [US1] In the login page, redirect an already-signed-in visitor into the application
      using the same `meQueryOptions()` — the same key, so no extra request (spec US-1 scenario 5).
- [ ] **T034** [P] [US3] Create `apps/web/components/user-menu.tsx`: the current email from
      `meQueryOptions()` and a sign-out button wired to `useLogout()`, with an inline failure and a
      retry on error and no state transition on failure (FR-022, FR-026).
- [ ] **T035** [US6] Extend `apps/web/components/error-state.tsx` with an optional message prop **only
      if** the gate cannot express its recoverable-error case with the component as it stands. If it
      can, skip this task and record that it was skipped (Constitution Principle II).

---

## Phase 7: Conventions document

- [ ] **T036** Copy [contracts/frontend-api-conventions.md](contracts/frontend-api-conventions.md)
      into `apps/web/README.md` (or `apps/web/docs/api-conventions.md` if the README grows unwieldy),
      adjusting only the links so they resolve from the new location. Every rule keeps its
      **[library]** / **[ours]** tag and its source link (FR-038).
- [ ] **T037** Add one line to `apps/web/README.md` pointing later work at the conventions as the
      reference for all API and React Query decisions.

---

## Phase 7a: Corrections applied during implementation

- [x] **T045** `/auth/me` expiry runs the same cleanup as a protected `401`, via
      `QueryCache.onSuccess` → `dropPrivateSession` (FR-019a).
- [x] **T046** `dropPrivateSession` leaves the current-user query uncancelled. Cancelling it reverts
      the query, its observer refetches, and the two loop — a defect found in verification (FR-019a).
- [x] **T047** Session generation counter plus `stampSession` / `isStampCurrent`, checked in
      `useLogout.onSuccess` and in the central `MutationCache.onError` (FR-019b).
- [x] **T048** `rotate` re-checks the generation after its `await`, so late cleanup cannot overwrite a
      newer sign-in (FR-019c).
- [x] **T049** One navigation owner per transition: `AuthGate` for signed-out and expiry, `LoginForm`
      for signed-in. `useLogout` navigates nowhere. Deliberate sign-out marked one-shot (FR-019c).
- [x] **T050** `app/(app)/loading.tsx` and `app/(app)/error.tsx` beside the shell layout; root
      `app/error.tsx` and `app/loading.tsx` re-created as fallbacks; `app/not-found.tsx` given its own
      page frame (FR-029a).
- [x] **T051** Login mutation `gcTime: 0`; `LoginForm` calls `reset()` and clears the local password on
      success. Documented as dropping our references, not as guaranteed erasure (FR-017a).

## Phase 8: Verification

Constitution Principle VIII: report the real output of each command. A skipped or inconclusive check
is reported as such.

- [ ] **T038** `pnpm --filter web lint` — passes with no new warnings.
- [ ] **T039** `pnpm --filter web exec tsc --noEmit` — passes.
- [x] **T040** `pnpm --filter web build` — passes. Confirm the route list shows `/login` and the four
      application routes, and record each route's actual rendering mode with the reason for anything
      that is not static. A route is **not** to be forced static to match a table.
- [ ] **T041** Grep gates, each reported with its output:
      - `fetch(` appears in exactly one file under `apps/web`;
      - no `document.cookie`, no `sid`, no `localStorage`, no `sessionStorage`;
      - `["auth", "me"]` is constructed in exactly one file;
      - no `refetchInterval` anywhere;
      - no new dependency in `apps/web/package.json` and no change to `pnpm-lock.yaml`;
      - no test file, test dependency or test script anywhere in the diff.
- [ ] **T042** Confirm `git diff --stat` shows the four moved pages as renames with no content change
      (FR-035).
- [ ] **T043** Work through [quickstart.md](quickstart.md) against the reviewed API on an **isolated
      verification database**. Record each result, including any that fail.
- [ ] **T044** Record any finding from T043 in the "Notes found while running these checks" section of
      the quickstart rather than silently fixing and moving on.

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8.
- Phase 2 is a hard block: `lib/api.ts` and the T010 guard gate everything.
- Phase 4 depends on Phase 3 (`endSession` and `authKeys` must exist).
- Phase 6 depends on Phase 5 (the components need the routes that host them).
- Phase 8 depends on everything.

### Task dependencies inside phases

- T005 → T006 → T007 → T008 → T009 → T010, all one file, in order.
- T011 → T012 → T013 → T014; T015 → T016; T017 is independent; T018 and T019 need T014–T017.
- T020 → T021 → T022 → T023, all one file, in order.
- T024 → T025 → T026 (the shell must move out before the root layout is reduced); T027 independent
  of them.
- T028 → T029 → T030, one file; T031 and T034 are `[P]`; T032 and T033 need T027 and T031.

### User story coverage

| Story | Tasks |
|---|---|
| US1 — sign in and reach the dashboard | T011–T014, T018, T024–T028, T031, T033 |
| US2 — login failures explained | T031, plus the policy in T023 |
| US3 — sign out and stay out | T019, T034, and the isolation from T015 |
| US4 — expiry handled once | T016, T020–T023, T029, T032 |
| US5 — never the previous account's data | T015, T018, T012 (signal forwarding) |
| US6 — signed out vs broken | T013, T028, T035 |

### Parallel opportunities

Genuinely few — the work is a chain of small files that build on each other. `[P]` is marked only on
T017, T031 and T034. Everything else touches a file another task in the same phase also touches, or
depends on its output.

## Implementation Strategy

Build the chain bottom-up and stop at the T010 guard: if the transport has crept beyond transport,
that is far cheaper to fix before three modules import it. The first end-to-end moment worth pausing
at is the end of Phase 6 with T031 — sign-in works, and every subsequent task is about the paths
where it does not.
