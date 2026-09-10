# apps/web

Next.js frontend for the Margin Dashboard. Presentation and interaction only — every calculation,
validation and persistence decision belongs to `apps/api`, reached over HTTP.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then start apps/api on the same origin
pnpm --filter web dev
```

---

# Frontend API conventions

**Established by** spec `005-frontend-authentication` (FE-02). **This file is the maintained
source**; the spec directory points here rather than keeping a second copy.

Checked against the installed versions: `next@16.3.4`, `react@19.2.8`,
`@tanstack/react-query@5.102.8`, `zustand@5.0.15`.

Each rule is tagged **[library]** — documented behaviour of a dependency, with a source link — or
**[ours]** — a choice this project made, which a later spec may revisit by amending this file.

## 1. Talking to the API

**1.1 [ours] One transport.** Every request goes through `apiFetch` in `lib/api.ts`. No component,
hook or page calls `fetch` against the API or parses an API response itself.

**1.2 [ours] `apiFetch` does transport and nothing else.** No routing, no React hooks, no
notifications, no cache mutations.

**1.3 [ours] Endpoint functions live with their feature.** `lib/auth.ts` owns `/auth/*`. A future
projects feature gets `lib/projects.ts`. The transport knows no endpoints.

**1.4 [library] `fetch` does not throw on HTTP errors** — `response.ok` must be checked explicitly.
`apiFetch` does it once.
→ [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#checking_that_the_fetch_was_successful),
[TanStack](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions)

**1.5 [library] Never set `Content-Type` for a `FormData` body** — the browser generates the
multipart boundary and puts it in that header. `apiFetch` sets JSON headers only for JSON bodies.
→ [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch#body)

**1.6 [ours] `credentials: "include"` on every request**, set inside `apiFetch` so it cannot be
forgotten. The session is a cross-origin `HttpOnly` cookie.

**1.7 [ours] Status is checked before an empty result is returned.** `204` and `Content-Length: 0`
return `undefined` without parsing — but only after `response.ok` passed.

**1.8 [ours] One environment setting**: `NEXT_PUBLIC_API_URL`. **Inlined at build time** — changing
the API origin requires rebuilding `apps/web`.
→ [Next.js](https://nextjs.org/docs/app/guides/environment-variables)

## 2. Errors

**2.1 [ours] One error shape.** `ApiError` carries `kind` (`"http" | "network"`), `status`,
`messages` (the backend's array), `message` (the first entry) and `body`.

**2.2 [ours] A failure body that is not JSON must not cause a second failure.** The error path parses
inside a `try` and falls back to the status text.

**2.3 [ours] Three categories, not one.** HTTP failure → `ApiError` with a status. Network failure →
`ApiError` with `kind: "network"` and no status; **never** read as signed out. Cancellation → not an
`ApiError` at all; the platform `AbortError` propagates, recognised by `isAbortError`.

**2.4 [ours] Backend validation messages are preserved, not replaced.** BE-01 prefixes each `400`
entry with its field path.

**2.5 [ours] Expected failures belong in form or page state.** `error.tsx` is for uncaught rendering
failures only.

## 3. React Query

**3.1 [ours] One `QueryClient`**, created once in `app/providers.tsx`.

**3.2 [ours] One key per resource.** The current user is `["auth", "me"]`, defined in `lib/session.ts`
and imported everywhere.

**3.3 [library + ours] Keys contain every input that changes the result.**

**3.4 [ours] Reads are queries; writes are mutations.**

**3.5 [library] Query functions must throw.** `apiFetch` satisfies this.

**3.6 [library + ours] Forward `signal` to `fetch`.** Every query function takes `{ signal }` from
the `QueryFunctionContext` and passes it through, so `cancelQueries()` genuinely aborts requests
rather than only ignoring their results.
→ [TanStack](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions)

**3.7 [ours] Retry policy** (one predicate, set as the client default): cancelled → never; any 4xx
(covering `400`, `401`, `403`, `429`) → never; network failure or `5xx` → at most **one** retry.
Mutations: `retry: false`, restating the library default (`retry ?? 0` in `query-core/mutation.js`)
so the rule is visible. The library's own query default — *"silently retried 3 times, with
exponential backoff"* — is deliberately replaced.
→ [TanStack](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

**3.8 [ours] Freshness for `["auth", "me"]`**: `staleTime: 30_000`; `refetchOnMount`,
`refetchOnWindowFocus` and `refetchOnReconnect` left at their defaults (on).

**3.9 [ours] No polling.** `refetchInterval` is not used anywhere. Expiry is discovered on the next
real request. BE-02's session is rolling, so a poll would also keep an abandoned tab alive.

**3.10 [library] `networkMode` is left at its default `"online"`.** A retry is *paused* — the query
stays `pending` rather than becoming `error` — while the tab is hidden or the browser reports itself
offline, and resumes on focus. A first attempt is not affected. This is why a backend outage
discovered in a background tab shows the loading state until the tab is focused.
→ [TanStack](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

**3.11 [library] v5 API drift — read the installed types, not old examples.** `useQuery` has **no**
`onSuccess`/`onError`/`onSettled`. In `5.102.8` the mutation callbacks' third parameter is
`onMutateResult` (not `context`), and a fifth `context: MutationFunctionContext` was added:
`MutationCache.onError` is `(error, variables, onMutateResult, mutation, context)`.

## 4. Session and cache lifecycle

**4.1 [ours] `lib/session.ts` owns every session transition.** Three entry points, all idempotent:

| Function | Called when | Effect |
|---|---|---|
| `beginSession(qc, user)` | sign-in succeeded | new generation → cancel **all** queries → remove private → set `["auth","me"]` to the user |
| `endSession(qc)` | sign-out succeeded, or a protected `401` | new generation → cancel **all** queries → remove private → set `["auth","me"]` to `null` |
| `dropPrivateSession(qc)` | `/auth/me` itself answered `401` | new generation → cancel **private** queries → remove private (the me query already holds `null`) |

**4.2 [ours] A `401` from `/auth/me` performs the same cleanup as any other `401`.** `fetchMe`
resolving to `null` keeps "signed out" distinguishable from "backend down" — it does **not** exempt
that path from clearing private data. `QueryCache.onSuccess` routes it to `dropPrivateSession`.

**4.3 [ours] `dropPrivateSession` must not cancel the current-user query.** Cancelling the query that
just answered reverts it, its observer refetches, and the two loop. This is a real defect that was
caught in verification; the `includeCurrentUser` flag exists solely to prevent it.

**4.4 [ours] Signed out from the start is the same call with nothing to clean** — no message, no
navigation beyond the ordinary one, no refetch loop.

**4.5 [ours] Private data is identified by convention, not registration.** A key whose first segment
is `"auth"` is session metadata; every other key is private. A future `["projects", …]` feature is
cleared automatically.

**4.6 [ours] Which `401` means what.**

| Source | Meaning | Response |
|---|---|---|
| `POST /auth/login` | wrong credentials | inline message on the form; no transition |
| `GET /auth/me` | signed out | query resolves to `null`; cleanup runs; not an error |
| any other endpoint | session expired | `endSession` |

**4.7 [ours] `403` is not a sign-out.** Network failure and `5xx` are not a sign-out.

**4.8 [ours] The current-user query is the session state.** `undefined` (unresolved), `null` (signed
out), a user (signed in), plus `isError` (unavailable). No `isAuthenticated` flag, no Zustand auth
store, no user in `localStorage`.

**4.9 [ours] Private queries do not start while the session is unresolved or signed-out** — set
`enabled` from the resolved state.

**4.10 [ours] After sign-in, seed from the response** with `setQueryData`; do not trigger a second
`GET /auth/me`.

## 5. Protecting the current session from a previous one

**5.1 [library] `cancelQueries` does not cancel mutations.** A mutation started under a previous
session can still resolve after a new one began.

**5.2 [ours] Every private mutation stamps the session in `onMutate`:**

```ts
useMutation({
  mutationKey: ["reports", "generate"],
  onMutate: () => stampSession(),
  mutationFn: (input) => generateReport(input),
  onSuccess: (data, _variables, stamp) => {
    if (!isStampCurrent(stamp)) return;   // a previous session's response
    queryClient.setQueryData(["reports", "latest"], data);
  },
});
```

**5.3 [ours] Check the stamp before any session-sensitive callback** — a cache write, an
invalidation, a navigation, a notification. An unstamped mutation is treated as current, so the
stamp is not optional for private mutations.

**5.4 [ours] The central `MutationCache.onError` checks it too**, so an old mutation's `401` cannot
sign out the new user.

**5.5 [ours] A late transition cannot overwrite a newer one.** `rotate` re-checks the generation
after its `await`, so a slow sign-out cleanup cannot blank a newer successful sign-in.

**5.6 [ours] Cancellation aborts the browser's request. It does not undo work `apps/api` already
performed for it.** A cancelled mutation may still have changed server state.

## 6. Navigation ownership

**6.1 [ours] Exactly one owner per transition**, so two redirects can never race:

| Transition | Owner |
|---|---|
| signed out / expired, inside the app | `AuthGate` |
| signed in (fresh or already), on `/login` | `LoginForm` |

`useLogout` performs **no** navigation — it ends the session and lets `AuthGate` act on the state.

**6.2 [ours] Deliberate sign-out and expiry are distinguished** by a one-shot marker
(`markDeliberateSignOut` / `consumeDeliberateSignOut`). A deliberate sign-out reaches a plain
`/login`; an expiry reaches `/login?reason=expired` and shows the notice once.

**6.3 [ours] Only a session that existed can expire.** `AuthGate` tracks whether it has seen an
authenticated user, so a first signed-out visit never shows the expiry notice.

**6.4 [ours] Navigation follows cache state, not an event.** Several `401`s converge on one state, so
one navigation and one message result — verified with three concurrent `401`s.

**6.5 [ours] Return destinations come from a literal allowlist** (`safeReturnTo`). External and
protocol-relative targets fall back to `/`. Do not write a sanitiser.

## 7. Credentials

**7.1 [library] Mutation state retains `variables`.** A login mutation's state holds the submitted
password until the mutation is reset or garbage-collected. It is **not** true that the password never
enters a cache.

**7.2 [ours] What we do about it**: the login mutation sets `gcTime: 0`, and `LoginForm` calls
`reset()` and clears its local password state on success. Both drop the references we control.
Neither guarantees the string is erased from memory — JavaScript offers no such guarantee. Nothing is
logged, and nothing is persisted.

**7.3 [ours] Never read, decode, copy or store the session cookie.** It is `HttpOnly`. No second
session or token mechanism.

## 8. Next.js boundaries

**8.1 [library] The client gate is a UX boundary, never an authorization boundary.** Next.js is
explicit that a layout *"does not control whether the rest of the route renders"* and that returning
`null` from a top-level component *"is not recommended"* for authorization.
→ [Next.js](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks)

**8.2 [ours] Nothing private may be server-rendered behind only a client gate.** Routes under `(app)`
render public shell and placeholder markup.

**8.3 [library + ours] If server-side private fetching is introduced,** it verifies the session *at
that data access point* by calling the API with the incoming cookie and honouring its `401`.

**8.4 [ours] No `proxy.ts` to test for a cookie.** With an opaque signed identifier, presence proves
nothing and introduces a redirect path that can disagree with `/auth/me`.

**8.5 [ours] No auth framework, BFF, or duplicate API routes in Next.**

**8.6 [ours] Boundary placement follows the shell.** `app/(app)/loading.tsx` and
`app/(app)/error.tsx` sit beside `app/(app)/layout.tsx`, so a page's loading state or render failure
appears **inside** the shell and the user can still navigate. `app/error.tsx` and `app/loading.tsx`
remain the root fallbacks for the login page and for a failure in the `(app)` layout itself.
`app/not-found.tsx` stays at the root and brings its own page frame, because a 404 URL belongs to no
route group.

**8.7 [library] `useSearchParams` needs a `Suspense` boundary.** `LoginForm` is wrapped in one, which
keeps `/login` prerendered as static.

## 9. State ownership

**9.1 [constitution] React Query owns all API data. Zustand holds shared UI state only** and must
never duplicate API data. No Zustand store exists today.

**9.2 [library] If one is ever needed,** follow the documented Next.js pattern: a store factory
behind a Context provider, per request, never read or written from a Server Component.
→ [Zustand](https://zustand.docs.pmnd.rs/learn/guides/nextjs.html)

**9.3 [ours] Form state is local.** Field values, password visibility and inline submission errors
live in the form's `useState`.

**9.4 [ours] The session generation counter is request-lifecycle bookkeeping, not a store.** Nothing
renders from it; `["auth", "me"]` remains the only thing the UI reads.

## 10. Adding a new API-backed feature

1. Add `lib/<feature>.ts`: duplicated response types, endpoint functions calling `apiFetch`, exported
   query keys, and query/mutation option factories.
2. Every query function takes `{ signal }` and forwards it.
3. Private queries set `enabled` from the resolved authenticated state.
4. Private mutations stamp the session in `onMutate` and check it before session-sensitive callbacks.
5. Handle `400` and `429` where the request is made. Do **not** handle `401` — the central policy does.
6. Change `providers.tsx` only when the *policy* changes, and amend this file when it does.

## 11. Presentation conventions

**Added by** spec `006-frontend-design-migration` (FE-03).

**11.1 [ours] Design values are tokens, not literals.** The approved design's palette, type scale,
radii and shadows live in `app/globals.css` and reach components as Tailwind utilities. A hex value
in a component is a defect.

**11.2 [ours] Colours that failed WCAG AA as text were darkened, not copied.** The design's
`--ink-3` (#9b9cb8, 2.51:1), `--neg` (#e14b3c, 3.73:1) and `--warn` (#b8730a, 3.58:1) are used
there for small text. `globals.css` carries darker equivalents with the measured ratio beside each.

**11.3 [ours] Two percent formatters, deliberately.** `formatPercent` is signed and is for a
*result* — margin, profitability. `formatShare` is unsigned and is for a *portion* — productivity,
share of hours. Both take a **ratio (0–1)**, matching the API's number contract. The design
prototype used percentage points; that is not this codebase's unit.

**11.4 [ours] An absent value is never a zero.** `MissingValue` renders the em dash with an
accessible label. Every formatter returns `ABSENT` for `null`/`undefined` and a formatted zero
for `0`.

**11.5 [ours] Period selection lives in the URL**, not in a store. `safeReturnTo` allowlists
pathnames, so an expiry returns to a screen's default period — see the comment in `lib/session.ts`.

**11.6 [ours] No preview data remains.** The Dashboard reads `GET /periods` and `GET /dashboard`
through `lib/analytics.ts`. The sample module that stood in while those endpoints were unlanded has
been deleted. If preview data is ever needed again, the rule it followed applies: one clearly named
module, labelled on screen wherever it appears, never reachable through `apiFetch`, and performing
no arithmetic — `apps/api` owns the cost model.

**11.7 [ours] Every screen reads its own endpoint.** No screen renders a permanent empty state. An
empty state means the API answered and had nothing for that period — which is a fact about the
data, not about the frontend.

**11.8 [ours] The period filter's options come from the API, not from a constant.** `GET /periods`
decides which years and months can be chosen, so an out-of-range period is only reachable by URL —
where the `/dashboard` query's `enabled` gate keeps it from issuing a request at all.

**11.9 [ours] A data-quality warning is shown in the scope it describes.** `GET /periods` reports
standing issues for the *default year*; those belong on the uploads screen, beside the files that
produced them. A period-scoped screen shows that period's own `completeness.issues` and nothing
else, because a warning about March is misleading on a page showing July.

**11.10 [ours] Changing the year cannot leave an impossible month selected.** Not every year holds
every month. Where the selected month is not in the new year, the selection falls back to the whole
year rather than leaving the filter disagreeing with the figures.

**11.11 [ours] Uploads use the existing transport.** `apiFetch` passes a `FormData` body through
untouched, so the three import endpoints need no second transport and no `Content-Type` of their
own. Both write paths — importing and saving assumptions — stamp the session in `onMutate`, check
it before writing to the cache, and then invalidate `["analytics"]`: the API recalculates, the
frontend does not.

**11.12 [ours] `usePeriodScope` owns the period-scoped screens' shared shape.** Five screens need
the same loaded periods, the same URL-backed selection, the same filter and the same four states. A
sixth screen with those needs uses it; one without them does not.
