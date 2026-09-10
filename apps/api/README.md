# API — NestJS backend

Calculations, validation, and persistence for the Margin Dashboard. Runs entirely locally: no
cloud account, no API key, no paid service.

## Requirements

- **Node 24.21.0** — the version pinned in `.nvmrc` at the repository root (`nvm use`).
  Node 26 also works; both satisfy the repository's `engines.node` of `>=24.15.0`.
- **pnpm 11.9.0** — `corepack enable`.

No compiler toolchain is needed. Prisma 7 runs the WASM query compiler through a driver adapter,
so no database engine is downloaded, and `better-sqlite3` (which the adapter uses) ships prebuilt
N-API binaries.

## Setup

From the repository root:

```bash
pnpm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

Every setting has a working local default, so the copied file needs no edits. `pnpm install`
generates the Prisma client automatically (`postinstall`).

Then create the database schema:

```bash
pnpm --filter api db:deploy
```

**Upgrading a database created before Prisma** (one that already holds imported spreadsheets):
mark the pre-Prisma schema as the baseline first, then apply the rest. Nothing is reset or
recreated and every row is kept.

```bash
pnpm --filter api db:adopt && pnpm --filter api db:deploy
```

`pnpm --filter api db:status` reports which migrations a database has.

## Run

```bash
pnpm --filter api dev
```

Verify it is up:

```bash
curl http://localhost:4000/health
```

Expected: `{"status":"ok"}`.

To build and run the compiled output instead:

```bash
pnpm --filter api build && pnpm --filter api start:prod
```

## Configuration

All settings are read through `@nestjs/config` and validated by a Zod schema in
[`src/config.ts`](src/config.ts) at startup. An invalid value aborts startup with a non-zero exit
and a message naming the offending variable — there are no silent fallbacks.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | One of `development`, `test`, `production` |
| `PORT` | `4000` | Integer, 1–65535 |
| `DATABASE_PATH` | `./data/margin.sqlite` | Relative paths resolve against `apps/api`, **not** the directory you started the process from |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | The single browser origin allowed to call this API, with credentials. `http`/`https` only, and normalised to a bare origin — `http://localhost:3000/` and `https://example.com/path` become `http://localhost:3000` and `https://example.com`, because that is the form a browser sends in `Origin` |
| `SESSION_SECRET` | a development value | Signs the session cookie. Left unset in `.env.example` so the development default applies. **In production it must be set** to a real secret of at least 32 characters, or startup aborts: `openssl rand -base64 48` |
| `SESSION_TTL_HOURS` | `12` | Session lifetime in hours (1–720). The window slides — it is refreshed on every response, so an active user is not signed out mid-session |
| `MAX_UPLOAD_BYTES` | `10485760` (10 MB) | Largest spreadsheet upload accepted. Enforced before the file is buffered, so an oversized upload costs nothing |

`.env` is gitignored. `.env.example` is the tracked reference and holds no secrets.

## Authentication

Cookie-based, with sessions held server-side in SQLite. Sign in with the demo user:

| | |
|---|---|
| email | `demo@tentwenty.local` |
| password | `demo-password-2026` |

These are a local convenience, not a secret. The user is created automatically on first start
against an empty database, with its password hashed using Argon2id — there is no SQL to run and no
seed command. It is **not** created when `NODE_ENV=production`.

| Endpoint | Auth | Returns |
|---|---|---|
| `POST /auth/login` | public, rate-limited | `200` + `{ user: { id, email } }`, and sets the session cookie |
| `GET /auth/me` | session required | `200` + `{ user: { id, email } }`, or `401` |
| `POST /auth/logout` | public | `204`, always — safe to call with no session |
| `GET /health` | public | unchanged |

```bash
curl -c jar.txt -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}'
```

```bash
curl -b jar.txt http://localhost:4000/auth/me
```

A wrong password and an unknown email return the same generic `401` — the API does not reveal which
accounts exist. After 10 failed attempts in 15 minutes a client gets `429`; successful logins do not
count against that allowance.

### Sessions and the cookie

The `sid` cookie carries only a signed session identifier — never the user's identity. It is
`HttpOnly`, `SameSite=Lax`, has a 12-hour sliding expiry, and is marked `Secure` when
`NODE_ENV=production`. Sessions live in the `sessions` table, so they survive an API restart, and
logout deletes the row rather than only clearing the browser's copy.

Note that with `Secure` set, a browser on plain HTTP is not sent the cookie at all — which is why it
is conditional on the environment rather than always on.

### Cross-origin and CSRF

The frontend must send `credentials: 'include'` on every request. A state-changing request declaring
an origin other than `FRONTEND_ORIGIN` is refused with `403` before it reaches a handler; combined
with `SameSite=Lax`, that is the CSRF defence. There is no CSRF token to fetch or echo.

### Protecting a new endpoint

```ts
@UseGuards(SessionAuthGuard)
@Controller('projects')
export class ProjectsController {}
```

The guard is not global, because `GET /health` stays public.

## Error responses

Every non-2xx response has the same shape, so a client needs one error handler:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["month: Invalid input: expected number, received NaN"],
  "path": "/example",
  "timestamp": "2026-09-09T19:02:23.456Z"
}
```

`message` is always an array. Unexpected failures return a generic 500 that exposes no stack
trace, file path, or internal message; the full error is written to the server log instead.

## Database

A single SQLite file, accessed through **Prisma ORM 7.10.0** with the official
`@prisma/adapter-better-sqlite3` driver adapter.

- [`prisma/schema.prisma`](prisma/schema.prisma) is the one place the tables are described. Every
  model maps onto the existing snake_case columns with `@map`/`@@map`, so the schema Prisma
  manages is the schema BE-03 already had.
- [`src/prisma/prisma.service.ts`](src/prisma/prisma.service.ts) extends `PrismaClient`, resolves
  `DATABASE_PATH` to an absolute path before opening it, and disconnects on shutdown.
- The client is generated into `src/generated/prisma` and is **not** committed; `pnpm install`
  and `pnpm --filter api build` both regenerate it.
- Migrations live in [`prisma/migrations`](prisma/migrations). There is no `CREATE TABLE` at
  runtime any more — the schema is applied by `db:deploy` before the API starts.

| Owner | Tables |
|---|---|
| Authentication | `users`, `sessions` |
| Ingestion | `employees`, `salaries`, `projects`, `timesheet_entries`, `imports` |
| Assumptions | `settings` |

Two details worth knowing:

- `salaries.amount` is `NOT NULL` and a blank cell is skipped rather than stored, so **"no row"
  means unknown and `0` means a genuine zero salary**.
- `sessions.expires_at` is milliseconds since the epoch, modelled as `BigInt` because the value
  exceeds Prisma's 32-bit `Int`.

The only raw SQL left in the application is two `PRAGMA` statements (`journal_mode = WAL`,
`foreign_keys = ON`) in `PrismaService.onModuleInit`. They are SQLite connection settings with no
Prisma equivalent, and `foreign_keys = ON` is what makes the schema's relations actually enforced.

## Scripts

```bash
pnpm --filter api dev          # watch mode
pnpm --filter api build        # prisma generate + compile to dist/
pnpm --filter api lint         # oxlint
pnpm --filter api test         # vitest — the cost model suite
pnpm --filter api db:deploy    # apply migrations
pnpm --filter api db:adopt     # baseline a database created before Prisma
pnpm --filter api db:status    # which migrations a database has
pnpm --filter api db:generate  # regenerate the Prisma client
```

## Tests

```bash
cd apps/api && pnpm test
```

Nine cases over the cost model in [`src/analytics/cost-model.ts`](src/analytics/cost-model.ts) —
the reconciliation the brief asks us to self-check (with overhead at zero, total cost must equal
total salaries to the dirham), each rate formula pinned to its stated definition, and the
missing-data behaviour. They run in about 150 ms, need no database, no network and no spreadsheet,
and their expected figures are derived by hand in
[data-model.md](../../specs/009-cost-model-tests/data-model.md) rather than copied from what the
code returns.

**What is deliberately not covered**: spreadsheet parsing, `AnalyticsService` (it needs a
database), the HTTP endpoints, authentication, and the whole of `apps/web`. The brief asks for
tests "where they earn their keep"; the calculation layer is where they do, because that is where a
wrong number is invisible. Everything else is verified by running the application — see
[the verification guide](../../specs/001-backend-foundation/quickstart.md).
