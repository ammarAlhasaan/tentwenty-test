# Margin Dashboard

Two independent applications in one repository. They share no code and communicate only over HTTP.

- `apps/web` — Next.js 16 frontend (port 3000)
- `apps/api` — NestJS 12 backend (port 4000)

## Prerequisites

- Node.js **24.15 or later** (pinned to 24.21.0 in `.nvmrc`)
- pnpm **11.9.0** (`corepack enable`)

## Setup

```bash
pnpm install
```

The API needs an environment file before its first run:

```bash
cp apps/api/.env.example apps/api/.env
```

Every setting has a working local default, so no edits are needed.

Then create the database schema:

```bash
pnpm --filter api db:deploy
```

If you already have a database from before Prisma was introduced, baseline it first so its data is
kept: `pnpm --filter api db:adopt && pnpm --filter api db:deploy`. See
[apps/api/README.md](apps/api/README.md) for the full settings list, the error-response shape, and
database details.

## Run

```bash
pnpm dev
```

Starts both apps in parallel:

| App | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:4000 |

Health check: `curl http://localhost:4000/health` → `{"status":"ok"}`

## Sign in

The API requires a session. A demo user is created automatically on first start:

| email | password |
|---|---|
| `demo@tentwenty.local` | `demo-password-2026` |

No SQL and no seed command — the password is hashed with Argon2id on creation. See
[apps/api/README.md](apps/api/README.md#authentication) for the endpoints and session behaviour.

To run one app on its own:

```bash
pnpm --filter web dev
pnpm --filter api dev
```

## Build

```bash
pnpm build
```
