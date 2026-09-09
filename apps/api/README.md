# API — NestJS backend

Calculations, validation, and persistence for the Margin Dashboard. Runs entirely locally: no
cloud account, no API key, no paid service.

## Requirements

- **Node 24.21.0** — the version pinned in `.nvmrc` at the repository root (`nvm use`).
  Node 26 also works; both satisfy the repository's `engines.node` of `>=24.15.0`.
- **pnpm 11.9.0** — `corepack enable`.

No compiler toolchain is needed. `better-sqlite3` ships prebuilt N-API binaries and runs no build
script on install.

## Setup

From the repository root:

```bash
pnpm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

Every setting has a working local default, so the copied file needs no edits.

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

A single SQLite file via `better-sqlite3`, opened at startup and closed on shutdown by
[`src/database/database.service.ts`](src/database/database.service.ts). WAL journaling and foreign
keys are on.

Each table is added by the feature that needs it, created with `CREATE TABLE IF NOT EXISTS` when
that feature's module starts. There is no migration framework: **changing a column means deleting
`data/margin.sqlite` and restarting.**

| Owner | Tables |
|---|---|
| Authentication | `users`, `sessions` |
| Ingestion | `employees`, `salaries`, `projects`, `timesheet_entries`, `imports` |
| Assumptions | `settings` |

**Adding the assessment tables does not require deleting the database.** They are created
alongside the authentication tables, never over them — verified by opening a database holding only
`users` and `sessions` and confirming both survived with their rows intact.

`salaries.amount` is `NOT NULL` and a blank cell is skipped rather than stored, so **"no row"
means unknown and `0` means a genuine zero salary**. The two are treated differently everywhere.

## The assessment API

Full request and response contracts, with real captured responses, are in
[`specs/004-assessment-backend/contracts/`](../../specs/004-assessment-backend/contracts/). Every
endpoint below needs a session; `GET /health` and `/auth/*` are unchanged.

| Endpoint | Purpose |
|---|---|
| `POST /imports/timesheet` | upload a timesheet workbook (multipart `file`) |
| `POST /imports/salaries` | upload a salary overview (multipart `file`, optional `year`) |
| `POST /imports/projects` | upload a project price list (multipart `file`) |
| `POST /imports/sample` | load the three bundled sample workbooks in one call |
| `GET /imports` | import history and what is loaded |
| `GET /periods` | which years and months have data |
| `GET /dashboard?year=&month=` | hours, billable hours, cost, revenue, margin, reconciliation |
| `GET /projects?year=&month=` | project list for the period |
| `GET /projects/:refCode` | one project's full picture — not period-filtered |
| `GET /departments?year=&month=` | departments with their people nested |
| `GET /productivity?year=&month=` | billable ÷ total hours per employee |
| `GET /categories?year=&month=` | hours per category and the billable/internal split |
| `GET /settings` · `PUT /settings` | the two changeable assumptions |

### Sample data

The three supplied workbooks are tracked at [`sample-data/`](sample-data/) so a clean checkout has
them. Load all three with one request:

```bash
curl -b jar.txt -X POST http://localhost:4000/imports/sample
```

It reads those files and feeds them through the same parsing, validation and persistence used by
an ordinary upload — there is no separate path. The one-click button in the UI is delivered by the
frontend upload spec.

### Assumptions the reviewer should know about

Two are changeable at runtime through `PUT /settings`, with no restart:

| Assumption | Default |
|---|---|
| Billable categories | `Projects`, `Enhancements`, `Hosting` — the three the brief names |
| Monthly overhead | `0`, so the brief's self-check passes out of the box |

Three are decisions this backend made where the brief was silent:

- **`allocatedRevenue` is a reporting allocation, not revenue recognition.** A project has one
  price and up to five months of hours, and the brief does not say how to split it. A period is
  credited `price x (its hours on the project / the project's hours across every loaded period)` —
  the same hour-share idea the brief itself uses for employee revenue share. The field is named
  `allocatedRevenue` rather than `revenue` to keep that distinction visible, and `bookedRevenue`
  (price by sales month) is reported alongside it. **Loading more hours for a project revises the
  allocated revenue previously reported for earlier periods.** Project profitability keeps the
  brief's exact formula, `(price − cost) / price`, and is unaffected.
- **Unknown is never zero.** A missing salary leaves a direct rate unknown, which leaves that
  month's indirect pool incomplete, which makes every allocated cost in that month partial. A
  missing price leaves revenue unknown. In both cases profit and margin are withheld as `null`,
  and a `completeness` block on every response says which inputs are partial and why.
- **Arithmetic balance and dataset completeness are reported separately.** `reconciliation.balances`
  says the cost model ties over the inputs that exist; `reconciliation.salariesComplete` says
  whether those are all of them. A balanced reconciliation never implies a complete dataset.

Margins and profitability are unbounded and often negative — they are never clamped. Undefined
ratios are `null`, never `0`, `NaN` or `Infinity`.

### The self-check

With the sample data loaded and overhead at `0`, the full year reports total cost **AED
2,400,000** — exactly total salaries — and every individual month reconciles to its own salary
bill. See [the verification record](../../specs/004-assessment-backend/quickstart.md).

## Scripts

```bash
pnpm --filter api dev       # watch mode
pnpm --filter api build     # compile to dist/
pnpm --filter api lint      # oxlint
```

There is no test suite in this app by decision — behaviour is verified by running it. See
[the verification guide](../../specs/001-backend-foundation/quickstart.md) for the commands.
