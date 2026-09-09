# Data Model: FE-02 — Frontend Authentication and API Foundation

`apps/web` persists nothing. There is no database, no `localStorage`, no `sessionStorage`, no
cookie written by application code. The only state that outlives a render is the React Query cache,
which lives in memory and dies with the tab.

What follows is therefore the *client-side shape* of data that the API owns.

## Duplicated types

Per Constitution Principle IV these mirror `apps/api` and are re-declared in `apps/web`, not
imported.

```ts
// apps/web/lib/auth.ts
type AuthUser = { id: number; email: string };
type AuthResponse = { user: AuthUser };
type LoginInput = { email: string; password: string };
```

```ts
// apps/web/lib/api.ts
type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string[];
  path: string;
  timestamp: string;
};
```

## `ApiError`

One class for every failed request. Not a discriminated union of several classes — one shape with a
`kind` field, so a single `instanceof ApiError` check narrows and callers branch on data.

| Field | Type | Notes |
|---|---|---|
| `kind` | `"http" \| "network"` | `"network"` when `fetch` itself rejected |
| `status` | `number \| null` | `null` for `kind: "network"` |
| `messages` | `string[]` | the backend's `message` array, or a one-entry fallback |
| `message` | `string` | inherited from `Error`; set to `messages[0]` |
| `body` | `ApiErrorBody \| null` | present when the failure body parsed as the expected shape |

Cancellation is deliberately **not** an `ApiError`. An aborted request rejects with the platform's
`AbortError`, which propagates unchanged and is recognised by an `isAbortError` helper. Making
cancellation an error *shape* would invite it to be rendered; leaving it as the platform's own
signal keeps it something you check for and ignore.

## The current-user query — the only session state

Key: `["auth", "me"]`. There is no other representation of "is someone signed in".

| Query state | `data` | Meaning | UI |
|---|---|---|---|
| `pending` | `undefined` | the check has not answered | loading |
| `success` | `null` | the API answered `401` — signed out | login page |
| `success` | `AuthUser` | signed in | application shell |
| `error` | — | network failure or `5xx` | recoverable error + retry |

`null` is a *successful* result, not an error. That is what keeps "signed out" and "backend down"
from collapsing into one state (research Decision 7).

### Lifecycle

| Event | Effect on `["auth", "me"]` | Effect on other private keys |
|---|---|---|
| first mount | fetch | none start (gated by `enabled`) |
| window focus / reconnect, data older than 30 s | refetch | refetch per their own settings |
| sign-in succeeds | `setQueryData` ← the login response's `user` | cancelled and removed first |
| sign-out succeeds | `setQueryData` ← `null` | cancelled and removed |
| any protected request returns `401` | `setQueryData` ← `null` | cancelled and removed |
| sign-in / sign-out / any request fails otherwise | unchanged | unchanged |

Settings: `staleTime: 30_000`, `gcTime` default (5 min), no `refetchInterval`.

## Key namespace

```ts
export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};
```

**Convention that the central policy depends on**: a key whose first segment is `"auth"` is session
metadata; every other key is private business data. "Clear private data" is therefore
`removeQueries({ predicate: q => q.queryKey[0] !== "auth" })`, followed by an explicit write to
`["auth", "me"]`. Written as one predicate in one file so later features inherit it by naming their
keys normally — a projects feature keys on `["projects", …]` and is cleared automatically, with no
registration step to forget.

There are no private keys yet; BE-03 has not landed. The predicate is nonetheless implemented and
exercised, because retrofitting cache isolation after private data exists is how the previous-account
leak happens.

## Login form state — deliberately not in any cache

`email`, `password`, and password visibility are `useState` in the form component. The submission
error comes from the mutation's own `error`. None of it is API data, none of it is shared, and the
password never reaches a cache, a store, or a URL.

## What is absent, and must stay absent

- No Zustand store of any kind in this feature.
- No `isAuthenticated` boolean anywhere.
- No user object in `localStorage` or `sessionStorage`.
- No copy of the session identifier, in any form.
- No session expiry timestamp mirrored client-side — the cookie lifetime is rolling and server-owned;
  a client-side countdown would be wrong within one request.
