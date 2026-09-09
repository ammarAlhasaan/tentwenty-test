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

`.env` is gitignored. `.env.example` is the tracked reference and holds no secrets.

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

**This module creates no tables.** Each table is added by the feature that needs it.

## Scripts

```bash
pnpm --filter api dev       # watch mode
pnpm --filter api build     # compile to dist/
pnpm --filter api test      # vitest
pnpm --filter api lint      # oxlint
```
