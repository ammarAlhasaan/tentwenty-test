# Research: FE-02 — Frontend Authentication and API Foundation

**Date**: 2026-09-10 · **Branch**: `005-frontend-authentication`

Installed versions this research was checked against, read from the lockfile-resolved packages in
`apps/web/node_modules`:

| Package | Installed |
|---|---|
| `next` | 16.3.4 |
| `react` / `react-dom` | 19.2.8 |
| `@tanstack/react-query` (`query-core`) | 5.102.8 |
| `zustand` | 5.0.15 |

No dependency is added by this feature.

---

## Decision 1 — Native `fetch` behind one `apiFetch`, no HTTP client library

**Decision**: Use the platform `fetch` inside a single `apiFetch` function. No Axios, no interceptor
chain, no generated SDK, no repository layer, no configurable transport.

**Rationale**: The entire surface this project needs is: a base URL, credentials, JSON in, JSON or
`204` out, and a normalized failure. That is roughly forty lines. Constitution Principle VII admits a
dependency when it *removes* meaningful complexity; a client library here would add a second error
model on top of the one BE-01 already defined, and Principle II rules out the interceptor/repository
scaffolding outright.

**Two behaviours of `fetch` that force explicit code** (both from MDN, and the second is restated by
TanStack Query — see Decision 4):

1. `fetch` rejects only on network failure. A `401` or `500` resolves normally, so `response.ok` must
   be checked by hand.
2. Setting `Content-Type` manually on a `FormData` body destroys the multipart boundary the browser
   would otherwise generate. The header must be omitted for `FormData` and set only for JSON.

**Alternatives rejected**: Axios (adds a dependency and a second error shape for no gain);
`openapi-fetch` + a generator (there is no OpenAPI document, and generating one would put a build
step between the two applications that Principle IV exists to avoid); a `BaseRepository` (Principle II).

**Sources**: [MDN — Using the Fetch API, checking that the fetch was
successful](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#checking_that_the_fetch_was_successful);
[MDN — `FormData` and
`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch#body).

---

## Decision 2 — The session stays entirely in the cookie; the frontend never touches it

**Decision**: `credentials: "include"` on every request, and nothing else. No cookie reads, no token
storage, no mirrored `isAuthenticated` flag.

**Rationale**: BE-02's contract specifies an `HttpOnly` cookie whose value is an opaque signed
identifier carrying no claim. `HttpOnly` means `document.cookie` cannot see it — so any frontend
attempt to inspect it would be reading the wrong thing or reading nothing. The *only* honest way for
the frontend to learn whether a session exists is to ask the API: `GET /auth/me`.

Next.js states the same principle from the server side: cookies "should be set on the server to
prevent client-side tampering", and `HttpOnly` "prevents client-side JavaScript from accessing the
cookie". Our cookie is set by Nest, not by Next, but the property is the same one.

**Consequence for this spec**: the current-user query is not a convenience — it *is* the session
state. There is no second source to disagree with it.

**Sources**: [Next.js — Authentication § Setting cookies (recommended
options)](https://nextjs.org/docs/app/guides/authentication#3-setting-cookies-recommended-options);
[BE-02 contract § Session cookie](../002-authentication/contracts/auth.md).

---

## Decision 3 — Client-side gate only; the API's guard is the authorization boundary

**Decision**: `GET /auth/me` is checked in a client component that wraps the authenticated routes.
No `proxy.ts`, no Data Access Layer in `apps/web`, no server-side session verification — because no
private data is server-rendered in this spec.

**Rationale**: The Next.js authentication guide is unusually direct about the limits of the pattern
we are using, and its warnings define the boundaries this spec commits to:

- On layouts: *"A layout also does not control whether the rest of the route renders. Route segments
  and parallel route slots are rendered by the router, so a layout that hides or swaps them does not
  stop them from running or from appearing in the RSC Payload."*
- On the SPA pattern specifically: *"A common pattern in SPAs is to `return null` in a layout or a
  top-level component if a user is not authorized. This pattern is **not recommended** since Next.js
  applications have multiple entry points, which will not prevent nested route segments and Server
  Actions from being accessed."*
- On proxy checks: *"While Proxy can be useful for initial checks, it should not be your only line of
  defense in protecting your data. The majority of security checks should be performed as close as
  possible to your data source."*

We are deliberately using the not-recommended shape — and it is safe here for one specific reason,
which must stay true: **no route under the gate server-renders anything private.** The pages the gate
wraps are FE-01's static placeholder screens. If a route segment leaked into the RSC payload, it would
leak public placeholder markup.

The moment a page fetches private data, the check has to move to that data access point:

- fetched in the browser → it goes through the gated query layer, which does not start while the
  session is unresolved or signed-out, and the API's guard rejects it regardless; or
- fetched on the server → that server code must call the API itself with the incoming cookie and act
  on its `401`. It may not infer authorization from the cookie's presence.

Adding `proxy.ts` today would buy nothing: with an opaque signed identifier, the only optimistic
check available is "is a cookie present", which is exactly the check Next.js warns is not a defence,
and it would introduce a redirect path that can disagree with `GET /auth/me`.

**Alternatives rejected**: NextAuth/Auth.js or another auth framework (there is nothing left for it to
do — Nest owns credentials, sessions and CSRF); a BFF or Route Handler proxy in Next (a second server
hop, a second error shape, and a violation of the spirit of Principle IV); a `proxy.ts` cookie-presence
check (see above).

**Sources**: [Next.js — Authentication § Layouts and auth
checks](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks); [§ Optimistic
checks with Proxy
(Optional)](https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional);
[§ Creating a Data Access Layer
(DAL)](https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal).

---

## Decision 4 — Query functions throw; `signal` is forwarded to `fetch`

**Decision**: `apiFetch` throws on a non-`ok` response, and every query function receives the
`QueryFunctionContext` `signal` and passes it through to `fetch`.

**Rationale**: TanStack Query's query-functions guide is explicit: *"the query function **must throw**
or return a **rejected Promise**"*, and it calls out `fetch` by name as a utility that *"[doesn't]
throw by default"*, with this exact remedy:

```tsx
const response = await fetch('/todos/' + todoId)
if (!response.ok) {
  throw new Error('Network response was not ok')
}
```

The context object passed to every query function is, per the installed v5.102.8 types:

```ts
type QueryFunctionContext<TQueryKey, TPageParam> = {
  client: QueryClient
  queryKey: TQueryKey
  signal: AbortSignal
  meta: QueryMeta | undefined
}
```

Forwarding `signal` is what makes `queryClient.cancelQueries()` actually abort in-flight network
requests rather than merely ignore their results — which is the mechanism FR-025 depends on for
"an old session's response must not repopulate private data".

**Sources**: [TanStack Query — Query
Functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions); installed
types at `@tanstack/query-core@5.102.8/build/modern/hydration-*.d.ts`.

---

## Decision 5 — Retry policy, written against the documented v5 defaults

**Documented defaults** we are deviating from, from the important-defaults guide:

| Default | Value | Our choice |
|---|---|---|
| `staleTime` | `0` — data is stale immediately | `30_000` for `["auth", "me"]` |
| `gcTime` | 5 minutes for inactive queries | unchanged |
| `refetchOnMount` / `OnWindowFocus` / `OnReconnect` | on, for stale queries | unchanged (all three left on) |
| query `retry` | *"failed queries are silently retried 3 times, with exponential backoff delay"* | replaced by a predicate, ≤ 1 retry |
| structural sharing | on | unchanged |

Mutation retry is **not** covered by that guide. The installed source settles it: `mutation.js`
resolves `retry: this.options.retry ?? 0`, so mutations do not retry by default. We still set
`retry: false` explicitly on the sign-in and sign-out mutations, because FR-014 is a rule a later
reader must be able to see rather than infer from a library default that could change.

**Our predicate** (a project choice, not library behaviour):

- cancelled → never retry;
- an HTTP status in the 4xx range — which covers the required `400`, `401`, `403`, `429` — → never
  retry, because the request will fail identically on a second attempt and `429` in particular would
  make things worse;
- anything else (network failure, `5xx`) → at most one retry.

Three retries with backoff is the wrong shape for this application: the session check runs on every
mount and window focus, and a down backend would otherwise mean four requests and several seconds
before the user is told anything.

**No polling.** `refetchInterval` is not set anywhere. Session expiry is discovered on the next real
request, which is when it matters; a background poll would burn requests to learn nothing and would
keep sliding BE-02's rolling session TTL forward for an idle tab.

**Sources**: [TanStack Query — Important
Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults); installed
`@tanstack/query-core@5.102.8/build/modern/mutation.js`.

---

## Decision 6 — Central expiry handling via `QueryCache` / `MutationCache`, not an event bus

**Decision**: Put the shared 401 policy in the `QueryCache` and `MutationCache` `onError` callbacks
passed to the one `QueryClient`, and let the resulting cache state — not a message — drive the
redirect.

**Rationale**: v5 removed the per-query `onSuccess` / `onError` / `onSettled` callbacks from
`useQuery`; the installed `QueryObserverOptions` has none. The cache-level callbacks are the
supported place for cross-cutting error handling, and they exist on both caches in v5.102.8:

```ts
interface QueryCacheConfig {
  onError?: (error: DefaultError, query: Query<unknown, unknown, unknown>) => void
  onSuccess?: (data: unknown, query: Query<unknown, unknown, unknown>) => void
  onSettled?: (...) => void
}

interface MutationCacheConfig {
  onError?: (
    error: DefaultError, variables: unknown, onMutateResult: unknown,
    mutation: Mutation<unknown, unknown, unknown>, context: MutationFunctionContext,
  ) => Promise<unknown> | unknown
  // onSuccess / onMutate / onSettled likewise
}
```

> **API-drift note for the implementer.** In this version the mutation callbacks' third parameter is
> named `onMutateResult` (the value returned by `onMutate`) and a *fifth* parameter `context:
> MutationFunctionContext` was added. Older v5 examples found online show the third parameter as
> `context`. Read the installed types, not a blog post. The `mutation` argument is what we use, to
> read `mutation.options.mutationKey`.

**Why this removes duplication rather than hiding it**: the callback does not show anything. It
performs one idempotent state transition — cancel private queries, remove private cached data, set
`["auth", "me"]` to signed-out. Three simultaneous `401`s perform that same transition three times and
converge on one cache state, so the gate that observes it navigates once and the login page shows one
message. That is the whole reason for choosing a state transition over a notification.

**Alternatives rejected**: a custom `EventTarget` / emitter (explicitly excluded, and it would need
its own de-duplication); per-page `onError` handlers (FR-020, and v5 removed the per-query hook
anyway); `throwOnError` into `error.tsx` (an expired session is an expected outcome, not an uncaught
rendering failure — FR-021).

**Sources**: installed `@tanstack/query-core@5.102.8` type definitions; [TanStack Query —
Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).

---

## Decision 7 — `GET /auth/me` returns `null` for 401 instead of throwing

**Decision**: The current-user query function catches exactly one case — an `ApiError` with status
`401` from `GET /auth/me` — and resolves to `null`. Everything else throws.

**Rationale**: This is what makes User Story 6 mechanical rather than a matter of care. The query's
result becomes a three-way answer that maps one-to-one onto the states in the spec:

| Query state | Meaning | UI |
|---|---|---|
| `isPending`, `data === undefined` | unresolved | loading |
| `data === null` | signed out (the API said `401`) | login page |
| `data === { id, email }` | signed in | application |
| `isError` | unavailable — network or `5xx` | recoverable error + retry |

If `401` threw instead, "signed out" and "backend down" would both arrive as `isError` and the code
would have to re-inspect the error at every consumer to tell them apart — the exact
misclassification that produces the redirect loop. BE-02's contract already frames it this way: *"A
401 here is a normal, expected answer — not an error to surface to the user."*

It also removes retries and error-callback noise from the ordinary signed-out path: a `null` result
is a success, so the cache-level `onError` never fires for it, and Decision 5's predicate is never
consulted.

**Sources**: [BE-02 contract § `GET /auth/me`](../002-authentication/contracts/auth.md).

---

## Decision 8 — Zustand is not used

**Decision**: No store is added. FR-016 forbids an auth store, and this feature introduces no shared
UI state that two unrelated subtrees must agree on.

**Rationale**: Beyond the constitutional rule that Zustand "MUST NOT duplicate API data", the
Next.js integration guide's own constraints argue against reaching for it here. The guide requires a
per-request store created by a factory behind a Context provider, because *"a Next.js server can
handle multiple requests simultaneously"* and *"React Server Components should not read from or write
to the store"*. Session state is per-request data owned by the server — precisely the thing that
provider dance exists to keep out of a module-level singleton. React Query already solves it
correctly, so adding Zustand would mean maintaining a second, weaker copy.

Form field values and password visibility stay in `useState` inside the form (FR-017): they are
neither API data nor shared.

**Sources**: [Zustand — Setup with
Next.js](https://zustand.docs.pmnd.rs/learn/guides/nextjs.html); Constitution § Repository Boundaries.

---

## Decision 9 — One environment setting, inlined at build time

**Decision**: `NEXT_PUBLIC_API_URL`, read in one module and exported as a constant.

**Rationale**: The browser must reach the API directly (Decision 3 rules out a proxy), so the value
has to be present in client bundles, which in Next.js means the `NEXT_PUBLIC_` prefix. There is
nothing secret about it — it is a public origin the browser will announce in every request anyway.

**Deployment consequence, stated so it is not discovered later**: `NEXT_PUBLIC_*` values are inlined
at **build** time, not read at runtime. A deployment that changes the API origin requires a rebuild
of `apps/web`. That is acceptable here and is recorded in the plan's deployment assumptions.

**Sources**: [Next.js — Environment Variables § Bundling for the
browser](https://nextjs.org/docs/app/guides/environment-variables).

---

## Decision 10 — Post-sign-in destination: allowlist, not sanitisation

**Decision**: `returnTo` is compared against a literal list of in-app paths. A value not in the list
is ignored and the user goes to `/`.

**Rationale**: Open-redirect defences that filter — stripping `//`, checking for `http`, rejecting a
leading backslash — are a category of bug with a long history, because the browser's URL parser and
the filter disagree about inputs like `//evil.example`, `/\evil.example`, `https:/evil.example` and
percent-encoded variants. An allowlist has no such gap: the set of valid destinations in this
application is four routes and is known at build time. It is also less code.

**Sources**: [OWASP — Unvalidated Redirects and Forwards Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html).

---

## Decision 11 — No CSRF work on the frontend

**Decision**: Nothing is added for CSRF.

**Rationale**: BE-02 chose an `Origin`-checking guard over a token: *"There is no CSRF token to fetch
and no header to echo. The frontend needs no change beyond `credentials: 'include'`."* Browsers set
`Origin` on cross-origin requests automatically. Adding a token exchange would be work with no
counterpart on the server.

**Sources**: [BE-02 contract § Request
forgery](../002-authentication/contracts/auth.md#request-forgery).

---

## Open questions

None. Every behaviour this spec depends on is defined in BE-02's landed contract, and no contract
mismatch was found — see [contracts/api-consumption.md § Contract
review](contracts/api-consumption.md#contract-review-no-mismatches-found).
