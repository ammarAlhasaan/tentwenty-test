# Contract: Authentication endpoints

The HTTP contract `apps/web` will consume. Per Constitution Principle IV it is **documentation, not
code** — the frontend duplicates these types on its own side; nothing here is importable.

Error bodies follow [BE-01's error contract](../../001-backend-foundation/contracts/errors.md)
unchanged: every non-2xx response carries `statusCode`, `error`, `message` (always an array), `path`,
and `timestamp`. BE-02 adds no second error shape.

Base URL in local development: `http://localhost:4000`.

## Session cookie

One cookie carries the whole session. The client never reads or constructs it; the browser sends it
automatically when the request is made with credentials.

| Attribute | Development | Production |
|---|---|---|
| name | `sid` | `sid` |
| value | signed session identifier — opaque | same |
| `HttpOnly` | yes | yes |
| `SameSite` | `Lax` | `Lax` |
| `Secure` | **no** — with `Secure` set, a browser on plain HTTP would not receive the cookie at all | **yes** (requires HTTPS) |
| lifetime | `Expires`, computed as now + `SESSION_TTL_HOURS` (default 12 h) | same |
| `Path` | `/` | `/` |

The cookie value contains only a signed identifier. It never carries the user's id, email, or any
claim (spec FR-011).

### What the frontend must do

Every request to this API — including `GET /auth/me` — must be made with credentials, or the browser
will not attach the cookie:

```ts
fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  credentials: 'include',            // required: cross-origin cookie
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
```

`credentials: 'include'` is required because the frontend (`localhost:3000`) and the API
(`localhost:4000`) are different origins. It works because BE-01 already sets
`Access-Control-Allow-Credentials: true` for exactly one allowlisted origin.

---

## POST /auth/login

Exchanges an email and password for a session. Public. Rate-limited.

### Request

```http
POST /auth/login
Content-Type: application/json
Origin: http://localhost:3000
```

```json
{ "email": "demo@tentwenty.local", "password": "demo-password-2026" }
```

| Field | Type | Rules |
|---|---|---|
| `email` | string | Required. Trimmed and lowercased before lookup. Must be a syntactically valid email. Max 254 characters |
| `password` | string | Required. Min 1, **max 256** characters — the cap keeps an oversized body from reaching the Argon2id hasher (spec Edge Cases) |

Unknown properties are rejected by the schema rather than ignored, so a typo'd field name fails loudly
instead of silently authenticating on the two fields that did match.

### 200 OK

```json
{ "user": { "id": 1, "email": "demo@tentwenty.local" } }
```

```http
Set-Cookie: sid=s%3A<signed-id>; Path=/; HttpOnly; SameSite=Lax; Expires=Wed, 10 Sep 2026 06:00:00 GMT
```

The lifetime appears as **`Expires`**, not `Max-Age`: `express-session`'s `cookie.maxAge` is the value
used *to calculate* `Expires` from the current server time, not a literal header. With
`rolling: true`, `Expires` moves forward on each response.

The body carries **only** `id` and `email`. No password hash, no session identifier, no secret
(spec FR-004, SC-003).

The session identifier is regenerated before the user is attached, so the `sid` issued here always
differs from any the client held before (spec FR-009, SC-006).

### 400 Bad Request — invalid input

Produced by BE-01's validation pipe before the handler runs.

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["email: Invalid email address"],
  "path": "/auth/login",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

### 401 Unauthorized — wrong credentials

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": ["Invalid email or password"],
  "path": "/auth/login",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

**Identical for an unknown email and for a wrong password** — same status, same message, same fields;
only `timestamp` differs (spec FR-008, SC-002). No `Set-Cookie` is sent. The frontend must not try to
distinguish the two cases, because the API does not distinguish them.

The API verifies against a dummy hash when no user is found, so the two paths take comparable time.

### 429 Too Many Requests — rate limited

After more than **10 failed** attempts from one client in **15 minutes**. Successful logins do not
count toward the limit.

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": ["Too many login attempts, please try again later"],
  "path": "/auth/login",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

Carries `RateLimit-*` headers (IETF draft-7). The window is in-memory and resets if the API restarts
(research Decision 4).

### 403 Forbidden — foreign origin

See [§ Request forgery](#request-forgery).

---

## GET /auth/me

Returns the currently signed-in user. **Protected** — the first consumer of `SessionAuthGuard`.

### Request

```http
GET /auth/me
Cookie: sid=s%3A<signed-id>
```

### 200 OK

```json
{ "user": { "id": 1, "email": "demo@tentwenty.local" } }
```

Same shape as the login response, so the frontend can share one parser.

### 401 Unauthorized

Returned for **every** unauthenticated case, with no way to tell them apart: no cookie; an unknown
`sid`; a tampered cookie that fails its signature; an expired session; a session destroyed by logout.

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": ["Unauthorized"],
  "path": "/auth/me",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

This is the endpoint the frontend calls on load to decide whether to show the dashboard or the login
form. A 401 here is a normal, expected answer — not an error to surface to the user.

---

## POST /auth/logout

Ends the current session. Public — deliberately callable without a session.

### Request

```http
POST /auth/logout
Cookie: sid=s%3A<signed-id>
Origin: http://localhost:3000
```

No body.

### 204 No Content

```http
Set-Cookie: sid=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

The server-side row is **deleted**, not merely hidden: replaying the captured `sid` afterwards returns
401 (spec FR-018, SC-005).

**204 is also returned when no session was present** (spec FR-019), so the frontend may call logout
unconditionally — for example after receiving a 401 — without handling a failure case. This is why the
endpoint is not behind `SessionAuthGuard`: putting it there would make logging out of an
already-expired session fail with 401, which is the opposite of useful.

### 403 Forbidden — foreign origin

See below.

---

## Request forgery

Every **unsafe** method (`POST`, `PUT`, `PATCH`, `DELETE`) passes a global `OriginCheckGuard`:

- `Origin` present and equal to `FRONTEND_ORIGIN` → allowed.
- `Origin` present and different → **403**, before any state changes.
- `Origin` absent → allowed. Browsers always send `Origin` on cross-origin requests, so this only
  admits non-browser clients such as `curl` — which is not the CSRF threat model, and is what makes
  the manual verification in [quickstart.md](../quickstart.md) possible.

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": ["Request origin is not allowed"],
  "path": "/auth/login",
  "timestamp": "2026-09-09T12:34:56.789Z"
}
```

`GET` and `HEAD` are not checked — they change no state, and none of BE-02's endpoints uses a
state-changing `GET`.

There is **no CSRF token to fetch and no header to echo**. The frontend needs no change beyond
`credentials: 'include'` (research Decision 5).

---

## Public vs protected, complete list

| Endpoint | Guard | Rate-limited |
|---|---|---|
| `GET /health` | none — **stays public** (spec FR-023) | no |
| `POST /auth/login` | `OriginCheckGuard` only | **yes** |
| `GET /auth/me` | `OriginCheckGuard` + `SessionAuthGuard` | no |
| `POST /auth/logout` | `OriginCheckGuard` only | no |

## For BE-03: protecting a business endpoint

BE-03 protects an endpoint by applying the guard — it does not re-check the session itself:

```ts
import { Controller, Get, Session, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';

@UseGuards(SessionAuthGuard)          // whole controller, or a single @Get()
@Controller('projects')
export class ProjectsController {
  @Get()
  list(@Session() session: SessionData) {
    session.userId;                   // number — guaranteed present past the guard
  }
}
```

Anything the guard rejects returns exactly the 401 body shown above, so the frontend has one
unauthenticated response shape across the whole API.

**No such endpoint exists yet.** BE-02 adds no placeholder or demo route to illustrate this
(spec FR-022); `GET /auth/me` is the working example.
