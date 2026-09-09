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

Every setting has a working local default, so no edits are needed. See
[apps/api/README.md](apps/api/README.md) for the full list, the error-response shape, and database
details.

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

To run one app on its own:

```bash
pnpm --filter web dev
pnpm --filter api dev
```

## Build

```bash
pnpm build
```
