# Phase 1 Data Model: BE-02 — Authentication

**Date**: 2026-09-09 | **Plan**: [plan.md](./plan.md)

BE-01 created the SQLite connection and no tables, deferring the choice of a schema mechanism to
"the first spec that creates a table … with one real table as evidence rather than zero". That spec
is this one. It creates two tables and chooses the mechanism for the whole backend.

## Schema creation mechanism

`AuthModule.onModuleInit` executes the DDL below with `CREATE TABLE IF NOT EXISTS`, through the
existing `DatabaseService`. There is **no migration framework, no migration state table, and no
migration command** — see research Decision 7. BE-03 follows this same pattern for its own tables
rather than introducing a second one.

**Accepted limitation**: `IF NOT EXISTS` creates but never alters. Changing a column during the
assessment means deleting `apps/api/data/margin.sqlite` and restarting. That is acceptable for a
local app whose real data is re-uploaded from spreadsheets, and it is documented in the README
instead of being engineered around.

**Ordering dependency (verify at implementation)**: this DDL runs in `AuthModule.onModuleInit`, which
requires `DatabaseService.onModuleInit` to have already opened the connection. `DatabaseModule` is
`@Global` and imported by `AppModule` ahead of `AuthModule`, so Nest initialises it first — but this
ordering is an assumption about the framework, not a guarantee this project has observed. Task T011
checks it explicitly; if it does not hold, the DDL moves into `DatabaseService`-consuming code paths
lazily rather than being reordered by hand.

## Table: `users`

```sql
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Stable internal identifier. The only user field, besides `email`, that ever reaches a response body |
| `email` | TEXT, UNIQUE, `COLLATE NOCASE` | `NOCASE` puts spec FR-002's case-insensitive uniqueness in the index itself, so two rows differing only in case cannot exist even if application code forgets to normalise. The application still lowercases and trims on input — the collation is the backstop, not the primary mechanism |
| `password_hash` | TEXT | A PHC-encoded Argon2id string from `@node-rs/argon2`, e.g. `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<tag>`. Algorithm, version, parameters **and** salt all live inside this one string, which is why no separate salt or parameter column exists |
| `created_at` | TEXT | ISO-ish UTC via SQLite's `datetime('now')`. Present for orientation when reading the table by hand; nothing branches on it |

**No** `role`, `status`, `is_active`, `last_login_at`, `updated_at`, `name`, or `deleted_at` column.
Each would be speculative structure (Constitution Principle II) — spec FR-030 excludes roles, and no
requirement reads any of the others.

`password_hash` never appears in a `SELECT` that feeds a response. `AuthService` reads it only inside
the verification path (spec FR-004, SC-003).

## Table: `sessions`

Written and read exclusively by the `express-session` store in
`apps/api/src/auth/sqlite-session.store.ts`. Its shape is dictated by that interface.

```sql
CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
```

| Column | Type | Notes |
|---|---|---|
| `sid` | TEXT PK | The session identifier `express-session` generates via `uid-safe` — 24 bytes of `crypto.randomBytes`, base64url. The **unsigned** value is stored; the client's cookie carries the same value signed with `SESSION_SECRET`, so a tampered cookie fails its signature before any lookup happens (spec FR-015) |
| `data` | TEXT | The serialised session, `JSON.stringify` of what `express-session` hands the store — `{ "cookie": {...}, "userId": 1 }`. `userId` is the only application field BE-02 puts in it |
| `expires_at` | INTEGER | Absolute expiry as epoch milliseconds. Stored as its own column rather than being parsed out of `data`, so expiry is a `WHERE` clause and the sweep is one `DELETE` |

**No foreign key to `users`.** `data` is opaque to SQL, so `userId` is not a column that could carry
one; the session simply stops resolving when the user it names is gone. Adding a `user_id` column
purely to hang a constraint on would duplicate state that already lives in `data`.

### Lifecycle

| Event | Effect |
|---|---|
| Anonymous request | Nothing written — `saveUninitialized: false` |
| Successful login | `regenerate()` deletes the old row if one existed, then a new row is inserted with a fresh `sid` (spec FR-009) |
| Authenticated request | With `rolling: true`, `touch` moves `expires_at` forward by the TTL |
| Logout | `destroy` deletes the row; the cookie is cleared (spec FR-017, FR-018) |
| Expiry passes | `get` finds the row expired, deletes it, and reports no session (spec FR-013) |
| API restart | Rows are untouched — this is what makes sessions survive a restart (spec FR-012, SC-004) |
| Startup | One `DELETE FROM sessions WHERE expires_at <= ?` sweep clears rows abandoned while the process was down |

Opportunistic deletion plus a startup sweep is deliberate: with one reviewer and a handful of
sessions, a timer or background job would be machinery without a workload.

## Configuration schema additions

Two rows are added to the existing Zod schema in `apps/api/src/config.ts`. Nothing else in that file
changes. The four BE-01 settings — `NODE_ENV`, `PORT`, `DATABASE_PATH`, `FRONTEND_ORIGIN` — are
unchanged and are not restated here.

| Variable | Type / rule | Required | Default | Purpose |
|---|---|---|---|---|
| `SESSION_SECRET` | string, min 32 chars | **In production only** | A fixed development value; **rejected when `NODE_ENV=production`** | Signs the session cookie, so a client-edited `sid` fails its signature |
| `SESSION_TTL_HOURS` | integer, coerced, 1–720 | no | `12` | Session lifetime. With `rolling: true` it is a sliding window refreshed on each response |

### Why `SESSION_SECRET` has a conditional default

BE-01's SC-001 promises that `cp .env.example .env` with no edits produces a running API, and every
setting has a working local default. A secret with a shipped default contradicts that promise's
spirit the moment the app leaves a laptop.

Both properties are kept with one `superRefine` on the schema: the default applies when `NODE_ENV` is
not `production`, and startup **aborts** if `NODE_ENV=production` and `SESSION_SECRET` is absent or
still the development value. A reviewer runs `pnpm dev` with no edits; a production deployment cannot
start on a published secret. The example file documents both halves.

### Settings deliberately *not* added

| Not added | Why |
|---|---|
| `SESSION_COOKIE_NAME` | Nothing needs to vary it; `'sid'` is a constant |
| `SESSION_COOKIE_SECURE` | Derived from `NODE_ENV`. A separate switch would let the two disagree |
| `SESSION_COOKIE_SAMESITE` | One deployment shape, decided in research Decision 5 |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | The demo user is a fixed, documented, non-production convenience (research Decision 6). Two environment variables to vary a credential nobody needs to vary is speculative structure |
| `RATE_LIMIT_WINDOW` / `RATE_LIMIT_MAX` | Constants in the limiter. No requirement asks an operator to tune them |
| `ARGON2_*` cost parameters | `@node-rs/argon2`'s defaults match the OWASP Argon2id baseline; no requirement argues for others |

Spec FR-029 asks for only the settings actually required. Two is the number actually required.

## Demo user

Seeded by `AuthModule.onModuleInit` when `NODE_ENV !== 'production'` **and** `SELECT COUNT(*) FROM
users` is `0` (research Decision 6). Idempotent by that emptiness condition (spec FR-028); inert in
production by the `NODE_ENV` condition.

| Field | Value |
|---|---|
| email | `demo@tentwenty.local` |
| password | `demo-password-2026` |
| stored as | Argon2id PHC string via `argon2.hash()` — never plaintext (spec FR-027, US4 scenario 3) |

Both values are constants in `auth.module.ts` and are published in `apps/api/README.md`. They are a
local convenience, not a secret (spec Assumptions). The email is logged once at startup so a reviewer
who missed the README still sees it; **the password is not logged**.

## Data not stored

Recorded so a reviewer can see the omissions were decisions:

- **No plaintext password**, anywhere, at any point beyond the request body it arrived in.
- **No login attempt log or failure counter.** Rate limiting is in-memory in the limiter (research
  Decision 4); spec FR-030 excludes account lockout, which is what a persisted counter would be for.
- **No CSRF token table.** Research Decision 5 uses `Origin` verification, which is stateless.
- **No password reset token, email verification token, or remember-me token table.** All excluded by
  spec FR-030.
