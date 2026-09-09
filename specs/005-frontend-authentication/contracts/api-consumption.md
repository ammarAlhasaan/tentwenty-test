# Contract consumption: what `apps/web` relies on from BE-02

This file records exactly which parts of the landed backend contract this feature depends on, so a
future backend change can be checked against a list rather than against the source. The authoritative
documents are [BE-02 § auth](../../002-authentication/contracts/auth.md) and
[BE-01 § errors](../../001-backend-foundation/contracts/errors.md). Per Constitution Principle IV
nothing there is importable; the types below are **duplicated** on the frontend side.

## Endpoints consumed

| Method | Path | Auth | Used by |
|---|---|---|---|
| `POST` | `/auth/login` | public, rate-limited | sign-in mutation |
| `GET` | `/auth/me` | `SessionAuthGuard` | current-user query |
| `POST` | `/auth/logout` | public | sign-out mutation |

`GET /health` is not consumed. No BE-03 / spec-004 endpoint is consumed.

## Types duplicated in `apps/web`

```ts
// mirrors the API's User — id and email only, no hash, no session id
type AuthUser = { id: number; email: string };

// mirrors the 200 body of POST /auth/login and GET /auth/me
type AuthResponse = { user: AuthUser };

// mirrors BE-01's single error body
type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string[];   // always an array, even for one message
  path: string;
  timestamp: string;
};
```

## Status codes this feature must handle

| Endpoint | Status | Meaning per contract | Frontend behaviour |
|---|---|---|---|
| `POST /auth/login` | `200` | session created, `{ user }` returned | seed `["auth","me"]` from this body, then navigate |
| | `400` | validation failure, `message` names the field | inline field/form message |
| | `401` | wrong credentials — **identical body for unknown email and wrong password** | inline "Invalid email or password"; no sign-out transition, no redirect |
| | `403` | foreign `Origin` | inline error naming a configuration problem; not a sign-out |
| | `429` | >10 failed attempts in 15 min | inline rate-limit message; **no automatic retry** |
| `GET /auth/me` | `200` | `{ user }` | signed in |
| | `401` | every unauthenticated case, indistinguishable | resolve the query to `null` — signed out, *not* an error |
| `POST /auth/logout` | `204` | session destroyed — **also returned when no session existed** | clear private cache, set current user to signed out, navigate to `/login` |
| | `403` | foreign `Origin` | report failure; do **not** claim sign-out succeeded |
| any | network failure / `5xx` | — | recoverable error, stay signed in, offer retry |

## Behaviours relied upon

1. **`credentials: "include"` is sufficient.** The API sets `Access-Control-Allow-Credentials: true`
   for exactly one allowlisted origin. No preflight-triggering custom headers are added by
   `apiFetch` beyond `Content-Type: application/json`, which is already required for the login body.
2. **No CSRF token.** Unsafe methods pass an `Origin` check the browser satisfies automatically.
   `apiFetch` sends no CSRF header and fetches no token.
3. **Login and `/auth/me` share one response shape**, so one parser and one `AuthUser` type serve
   both.
4. **The session id is regenerated on login**, so a cookie held before sign-in cannot become an
   authenticated one. The frontend does not need — and must not attempt — any cookie handling of its
   own.
5. **Logout is idempotent and unguarded** (`204` with or without a session), so it may be called
   unconditionally. This feature nonetheless does *not* call it as part of expiry handling: expiry
   already produced a `401`, the server row is gone, and an extra request would buy nothing.
6. **`message` is always an array**, so error normalization needs no shape check.
7. **The cookie lifetime slides** (`rolling: true`, `Expires` moved forward on each response). An
   active user is not signed out mid-session. This is why no polling is needed to keep a session
   alive, and why a background poll would be actively harmful — it would keep an abandoned tab's
   session alive indefinitely.

## Contract review — no mismatches found

Each requirement in this spec was checked against the landed contract. Nothing requires backend
coordination:

- Distinct handling of login `401` versus protected `401` — supported: they are different endpoints,
  and the spec's policy keys on which one answered.
- Rate-limit feedback — supported: `429` carries a human-readable `message`, plus `RateLimit-*`
  headers this feature does not need to read.
- Validation feedback — supported: `400` `message` entries are prefixed with the field path.
- Distinguishing "session ended" from "backend down" — supported: `401` is an HTTP answer; a down
  backend produces no HTTP answer at all.
- Cancellation — purely client-side; no server involvement.

**One asymmetry worth stating, not a defect**: because the API returns the same `401` body for an
unknown email and a wrong password by design, the frontend cannot and must not offer a
"no such account" message. The contract is explicit that consumers must not try to distinguish them.

**One item for whoever writes BE-03**: any endpoint it protects must return the same `401` body via
`SessionAuthGuard`, unchanged. This feature's central expiry policy keys on `status === 401` from a
non-auth endpoint. An endpoint that signalled expiry some other way — a `200` with an `error` field,
a `403`, a redirect — would silently bypass it. This is already the documented BE-03 pattern; it is
repeated here because this feature now depends on it.
