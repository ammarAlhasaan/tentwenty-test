# Implementation Plan: BE-02 — Authentication

**Branch**: `002-authentication` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Base commit**: `ad9f520` (merge of BE-01, `001-backend-foundation`)

**Input**: Feature specification from `/specs/002-authentication/spec.md`

## Summary

Put a login boundary in front of the API and give BE-03 one reusable way to require it.

`express-session` — the middleware the NestJS documentation prescribes — holds session state on the
server, backed by a small store over the `better-sqlite3` connection BE-01 already opens, so
sessions survive a restart in the one database file the project already has. Passwords are verified
with Argon2id through `@node-rs/argon2`, which ships prebuilt binaries and so keeps BE-01's promise
that no compiler toolchain is needed. Login is rate-limited by `express-rate-limit`, because no
release of `@nestjs/throttler` supports NestJS 12. Request forgery is handled without a dependency by
verifying `Origin` against the origin BE-01 already allowlists, plus a `SameSite=Lax` cookie. Three
endpoints — `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` — and one `SessionAuthGuard`,
which `GET /auth/me` is the first real consumer of.

Every BE-01 mechanism is reused unchanged: the Zod config schema gains two rows, the validation pipe
gains two schemas, the error filter and the CORS block are not touched at all.

## Technical Context

**Language/Version**: TypeScript 6.0.3, ESM (`"type": "module"`, `nodenext`), Node 24.21.0 pinned
(`engines.node >=24.15.0`); this machine runs 26.4.0 — mismatch inherited from BE-01

**Primary Dependencies**: NestJS 12.0.1 on `@nestjs/platform-express` 12.0.1 (Express 5.2.1),
`better-sqlite3` 13.0.3, `zod` 4.5.4. **New**: `express-session@^1.19.0`,
`@node-rs/argon2@^2.2.0`, `express-rate-limit@^8.7.0`, `@types/express-session@^1.19.0` (dev)

**Storage**: the existing single SQLite file (`DATABASE_PATH`, default `apps/api/data/margin.sqlite`),
through the existing `DatabaseService`. Two new tables: `users`, `sessions`

**Testing**: **None.** No automated test suite, framework, file, mock, fixture, configuration, or
script (spec FR-033). Verification is lint + `tsc --noEmit` + build + the manual checks in
[quickstart.md](./quickstart.md)

**Target Platform**: local macOS, `pnpm dev`, no cloud account, API key, or paid service

**Project Type**: web service (`apps/api`), backend half of a two-application repository

**Performance Goals**: not applicable. One reviewer, a handful of sessions. The only deliberate cost
is Argon2id verification (~19 MiB, 2 passes) on the login path, which is the point of the algorithm

**Constraints**: `apps/web` untouched; HTTP-only boundary; no shared code or types with the frontend;
no `--force` / `--legacy-peer-deps`; no Swagger; pnpm and the existing scaffold preserved

**Scale/Scope**: 3 endpoints, 1 guard, 2 tables, 2 configuration settings, 8 new source files

## Constitution Check

*GATE: passed before Phase 0 research; re-checked after Phase 1 design. Constitution v1.0.0.*

| Principle | Assessment |
|---|---|
| **I. Simple, conventional code** | ✅ Nest module / controller / service / guard, plus `app.use()` middleware in `main.ts` — the arrangement the NestJS session documentation shows. The one custom piece, the session store, implements a documented third-party interface rather than replacing a framework feature |
| **II. No speculative structure** | ✅ No repository, base class, single-implementation interface, or barrel file. `auth/` holds seven files, each required by a numbered requirement. No dummy protected endpoint (FR-022). `all`/`length`/`clear` are left off the store because nothing needs them |
| **III. Comments explain the non-obvious** | ✅ Comments go where a reader would otherwise be misled — the regenerate-then-assign order, why the `Origin` check permits a missing `Origin`, why `secure` is conditional, why the demo seed is gated on `NODE_ENV`, why `SameSite=Lax` works across ports. No target count: comment where it earns its place, nowhere else |
| **IV. HTTP-only boundary** | ✅ No package, type, or schema is shared with `apps/web`. The contract is published as documentation in [contracts/auth.md](./contracts/auth.md) for the frontend to duplicate |
| **V. One side per spec** | ✅ `apps/api` only. FR-031 forbids touching `apps/web`, and Decision 5 was chosen partly because the alternative would have required a frontend change |
| **VI. One spec at a time** | ✅ BE-01 is complete and merged at `ad9f520`. No BE-03 code is written here — the guard is delivered, but applying it to a business endpoint is BE-03's work |
| **VII. Libraries that remove complexity** | ✅ Four dependencies, each with registry-verified peer compatibility in [research.md](./research.md). Two candidates were rejected *for* compatibility (`@nestjs/throttler`, `connect-better-sqlite3`), one on licence (`better-sqlite3-session-store`), one on architecture (`connect-sqlite3`). No `--force`, no `--legacy-peer-deps` |
| **VIII. Verified results only** | ✅ Registry facts, licences and peer ranges were read, not recalled; two runtime behaviours were observed by running code and are labelled **Observed**; the unverified item (`express-session` on Express 5) is labelled **Unverified** and gated by task T012 |

**Result: PASS.** One entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-authentication/
├── plan.md              # This file
├── spec.md              # Product requirements
├── research.md          # Phase 0: dependency decisions and compatibility evidence
├── data-model.md        # Phase 1: tables and configuration
├── quickstart.md        # Phase 1: the manual verification guide
├── contracts/
│   └── auth.md          # Phase 1: the HTTP contract apps/web will consume
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2: implementation tasks
```

### Source code (repository root)

```text
apps/api/
├── .env.example                          # MODIFIED: + SESSION_SECRET, SESSION_TTL_HOURS
├── README.md                             # MODIFIED: + auth, demo credentials, new settings
├── package.json                          # MODIFIED: + 3 dependencies, + 1 dev dependency
└── src/
    ├── main.ts                           # MODIFIED: + app.use(session(...)); CORS untouched
    ├── app.module.ts                     # MODIFIED: + AuthModule, + APP_GUARD for CSRF
    ├── config.ts                         # MODIFIED: + 2 rows in the Zod schema
    ├── app.controller.ts                 # UNCHANGED — GET /health stays public
    ├── common/
    │   ├── http-exception.filter.ts      # UNCHANGED
    │   └── origin-check.guard.ts          # NEW: CSRF — Origin verification on unsafe methods
    ├── database/                          # UNCHANGED — reused as-is
    └── auth/                              # NEW
        ├── auth.module.ts                # Module + schema DDL + demo seed on init
        ├── auth.controller.ts            # POST /auth/login, GET /auth/me, POST /auth/logout
        ├── auth.service.ts               # User lookup, Argon2id hash/verify
        ├── auth.schema.ts                # Zod schema for the login body
        ├── session-auth.guard.ts         # The reusable guard BE-03 will apply
        ├── sqlite-session.store.ts       # express-session Store over DatabaseService
        └── session.d.ts                  # SessionData augmentation: userId
```

**Structure Decision**: one conventional Nest feature folder, `apps/api/src/auth/`, holding seven
files. The CSRF guard lives in `common/` beside the existing error filter because it applies to every
request, not only authenticated ones. Nothing else moves. No `scripts/` directory is created
(research Decision 6), no `entities/`, `dto/`, `interfaces/`, or `constants/` subfolder is created,
and no empty folder is left behind.

## Design

### Request flow

```text
Request
  │
  ├─ cors           (BE-01, unchanged)  → non-allowlisted origin gets no ACAO header
  ├─ session        (NEW)               → reads `sid` cookie, loads the row from SQLite
  ├─ rate limiter   (NEW, /auth/login only)
  │
  ├─ OriginCheckGuard   (NEW, global)   → unsafe method + foreign Origin → 403
  ├─ SessionAuthGuard   (NEW, per-route)→ no req.session.userId → 401
  ├─ StandardSchemaValidationPipe (BE-01, unchanged) → bad body → 400
  │
  └─ handler  →  HttpExceptionFilter (BE-01, unchanged) shapes every error
```

Order matters in two places. The session middleware must be registered in `main.ts` **before** the
app starts handling routes, so `req.session` exists by the time any guard reads it — Express
middleware runs ahead of Nest guards, so `app.use(session(...))` before `app.listen(...)` is
sufficient. And `OriginCheckGuard` must run before `SessionAuthGuard`, so a forged cross-origin
request is refused as 403 without revealing whether a session was valid; global guards registered via
`APP_GUARD` run before route-level guards.

### Login

1. `StandardSchemaValidationPipe` validates the body against `loginSchema`; failure → 400.
2. `AuthService.findByEmail(email)` — a single `SELECT` on the `NOCASE` unique index.
3. `argon2.verify(user.password_hash, password)`. If the user was not found, **verify against a
   fixed dummy hash anyway**, so a missing account and a wrong password take comparable time.
4. Either failure → `UnauthorizedException('Invalid email or password')`. One message, one code path,
   so FR-008's byte-identical requirement holds by construction rather than by care.
5. **Regenerate, then attach.** `req.session.regenerate(cb)` issues a new `sid` before any user data
   exists on the session — that ordering is what defeats session fixation (FR-009).
6. **Attach onto the new session object.** `regenerate` does not mutate the old session in place: the
   official documentation states that once it completes, "a new SID and `Session` instance will be
   initialized at `req.session`". So `req.session.userId = user.id` must read `req.session` *after*
   the callback fires. A reference captured beforehand — including an injected `@Session()` parameter
   — still points at the discarded object, which would leave the new session anonymous and make
   `/auth/me` return 401 right after a "successful" login.
7. `req.session.save(cb)`, then return `{ user: { id, email } }`.

`regenerate`, `save` and `destroy` are **callback-based; none of them returns a promise**, so
`await session.regenerate()` awaits `undefined` and proceeds too early. Each is wrapped in a small
promise at the call site:

```ts
await new Promise<void>((resolve, reject) =>
  req.session.regenerate((err) => (err ? reject(err) : resolve())),
);
req.session.userId = user.id;   // the NEW session
```

A rejection propagates to BE-01's filter as the generic 500.

### The guard, and how BE-03 will use it

`SessionAuthGuard` reads `req.session?.userId`. Absent → `UnauthorizedException`. Present → it
attaches nothing new; handlers read `@Session()` themselves. BE-03 protects an endpoint with:

```ts
@UseGuards(SessionAuthGuard)
@Controller('projects')
export class ProjectsController { /* ... */ }
```

It is **not** registered globally, because `GET /health` must stay public (FR-023) and BE-03's
endpoints are not all written yet. `GET /auth/me` is its first and only consumer in this spec — no
placeholder endpoint is added to demonstrate it (FR-022).

### Session store

Implements `get`, `set`, `destroy`, `touch` — the required three plus the one `rolling: true` needs.
`all`, `length`, `clear` are omitted deliberately. It is written at whatever length reads clearly;
there is no line budget on it.

The contract is callback-based and is honoured exactly: `get` calls back `(null, null)` when the
session is absent **or expired** — absence is not an error — while `set`, `destroy` and `touch` call
back with an error argument only. `better-sqlite3` is synchronous and throws, so each method body is
wrapped in `try/catch` and the caught error is handed to the callback rather than being allowed to
escape the store, where it would bypass the request's error path. Deleting a row that is already gone
is a success. A `data` column that fails to parse is treated as not-found rather than thrown. Expired rows are deleted opportunistically: `get`
deletes a row it finds expired and reports no session, and a single `DELETE FROM sessions WHERE
expires_at <= ?` sweep runs at startup. No timer, no cron, no background job.

### Cookie

| Attribute | Value | Why |
|---|---|---|
| name | `sid` | Shorter than the default `connect.sid`, and does not advertise the middleware |
| `httpOnly` | `true` | FR-014 — unreachable from page script |
| `sameSite` | `'lax'` | Blocks cross-site unsafe methods. Works across ports because SameSite is scoped to the registrable domain, so `localhost:3000` → `localhost:4000` is same-site |
| `secure` | `NODE_ENV === 'production'` | Always-on would make local sign-in impossible: with `secure` set and the site served over HTTP, the cookie is not set at all. The brief requires the app to run locally over plain HTTP. Observing the literal `Secure` attribute therefore needs an HTTPS origin and is deferred (quickstart § 10) |
| `maxAge` | `SESSION_TTL_HOURS × 3600 × 1000` | FR-013. Note this emits an **`Expires`** attribute, not a literal `Max-Age` header — `maxAge` is documented as the value used *to calculate* `Expires` from the current server time |
| `path` | `'/'` | Sent to every endpoint, including future BE-03 routes |

With `rolling: true`, an active session's expiry slides forward on each response; `resave: false` and
`saveUninitialized: false` keep anonymous requests from writing rows.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| A hand-written `express-session` store instead of a published one — arguably against Principle VII | Sessions must persist in **the existing** SQLite file through **the existing** `DatabaseService` (FR-012, FR-032), and the store contract is four callback-based methods over `db.prepare()` | `connect-sqlite3` is maintained but drives the **`sqlite3`** package — a second native driver and a second database file, which is more complexity than it removes. `better-sqlite3-session-store` uses the right driver but is **`GPL-3.0-only`**, a licensing commitment not to make silently on a submitted take-home, and has been unpublished since 2022 pinning `date-fns@2.16.1`. `connect-better-sqlite3` requires `better-sqlite3@^7` against the installed 13.0.3. Full evidence: research Decision 2 |

Two further deviations were considered and are **not** violations:

- **`express-rate-limit` rather than the first-party `@nestjs/throttler`** — not a choice. No published
  `@nestjs/throttler` release accepts `@nestjs/common@12`; using it would require `--legacy-peer-deps`,
  which Principle VII forbids. Reporting the conflict and proposing an alternative is what that
  principle prescribes.
- **No CSRF library** — the OWASP-endorsed `Origin`-verification defence for a strict-allowlist JSON
  API is a guard, not an omission. Adding `csrf-csrf` would require changing `apps/web`, which
  Principle V forbids in a backend spec.

## Verification

No automated tests (FR-033). The gates are:

| Gate | Command | Expected |
|---|---|---|
| Install | `pnpm install` | Completes with no `--force`, no `--legacy-peer-deps`, no peer warning |
| Lint | `pnpm --filter api lint` | exit 0 |
| Types | `cd apps/api && npx tsc --noEmit -p tsconfig.json` | exit 0 |
| Build | `pnpm --filter api build` | exit 0 |
| Behaviour | [quickstart.md](./quickstart.md) §§ 1–14 | Every check as documented |
| Frontend untouched | `git status --short apps/web` | empty |

Nothing in the API is added to make these possible: no debug route, no test-only endpoint, no
environment switch that relaxes a check.
