# Quickstart & Verification: BE-01 — Backend Foundation

**Date**: 2026-09-09 | **Plan**: [plan.md](./plan.md)

Runnable checks that prove BE-01 meets its acceptance criteria. Everything here is a command a
reviewer can execute; nothing here is implementation code. Run these **after** implementation —
they are the source for `tasks.md` phase 5, and their real output is what gets reported.

## Prerequisites

- Node **24.21.0** (the `.nvmrc` pin): `nvm use`
- pnpm 11.9.0: `corepack enable`
- No cloud account, API key, or paid service.

## Setup

```bash
nvm use
pnpm install
cp apps/api/.env.example apps/api/.env
```

`pnpm install` must complete with **no** `--force` and **no** `--legacy-peer-deps`, and with no
peer-dependency error (spec SC-002). Watch for `node-gyp` output during `better-sqlite3`
installation — a prebuilt binary should be downloaded instead of compiled.

## 1. Build and start (spec US-1)

```bash
pnpm build
```

```bash
pnpm --filter api dev
```

Expected: Nest logs its route mappings and reports listening on port 4000.

## 2. Health check (spec FR-025, SC-010)

```bash
curl -i http://localhost:4000/health
```

Expected: `200 OK`, body `{"status":"ok"}`.

## 3. Configuration validation (spec US-2)

Invalid value — must refuse to start:

```bash
cd apps/api && PORT=not-a-number pnpm start; echo "exit=$?"
```

Expected: startup aborts, a non-zero exit code, and a Zod message naming `PORT`.

Invalid origin:

```bash
cd apps/api && FRONTEND_ORIGIN=notaurl pnpm start; echo "exit=$?"
```

Expected: aborts, message names `FRONTEND_ORIGIN`.

Defaults apply with no `.env` at all:

```bash
cd apps/api && mv .env .env.bak && pnpm start; mv .env.bak .env
```

Expected: starts on 4000 using the schema defaults (spec US-2 scenario 4).

## 4. CORS (spec US-5)

Allowed origin, credentialed:

```bash
curl -i -H "Origin: http://localhost:3000" http://localhost:4000/health
```

Expected: `access-control-allow-origin: http://localhost:3000` and
`access-control-allow-credentials: true`.

Disallowed origin:

```bash
curl -i -H "Origin: http://evil.example" http://localhost:4000/health
```

Expected: **no** `access-control-allow-origin` header at all (spec FR-024).

> If this header comes back carrying the configured origin, the CORS `origin` option was passed as
> a bare string. In `cors@2.8.6` a string origin emits the header unconditionally; only the
> single-element **array** form omits it for a non-matching origin. Fix the configuration, not this
> expectation.

Preflight:

```bash
curl -i -X OPTIONS http://localhost:4000/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Expected: 204 with the allow headers present.

No `Origin` header at all (command-line client) is served normally — check 2 already proves this.

## 5. Database path resolution (spec FR-017, SC-008)

Start once from the repository root and once from `apps/api`, and confirm one file:

```bash
pnpm --filter api start   # from repo root
```

```bash
cd apps/api && pnpm start
```

```bash
find . -name "*.sqlite" -not -path "*/node_modules/*"
```

Expected: exactly one database file, under `apps/api/data/`, in both cases.

## 6. Persistence across restart (spec SC-007)

Uses a scratch table created and dropped by the check itself — no table is added to application
source (see data-model.md).

> **Scope of this check.** It opens its *own* connection to a hard-coded path, so it proves SQLite
> persists across a restart — it does **not** prove `DatabaseService` uses the configured file or
> closes its handle. Direct automated coverage of the service is deferred until the final
> backend testing stage.

```bash
cd apps/api
node -e "const D=require('better-sqlite3');const db=new D('data/margin.sqlite');db.exec('CREATE TABLE IF NOT EXISTS _probe (v TEXT)');db.prepare('INSERT INTO _probe VALUES (?)').run('survived');db.close()"
```

Stop and restart the API, then:

```bash
cd apps/api
node -e "const D=require('better-sqlite3');const db=new D('data/margin.sqlite');console.log(db.prepare('SELECT v FROM _probe').all());db.exec('DROP TABLE _probe');db.close()"
```

Expected: `[ { v: 'survived' } ]`, then the scratch table is dropped.

## 7. Clean shutdown (spec FR-020)

With the API running, press `Ctrl+C` (SIGINT).

```bash
ls apps/api/data/
```

Expected: the process exits cleanly, and no `-wal` / `-shm` sidecar files are left behind — a
closed WAL connection checkpoints and removes them.

## 8. Static checks

The API has **no test suite** — removed by decision (see spec § Testing). Everything in this
document is therefore a manual check, and these two are the only automated gates:

```bash
pnpm --filter api lint
```

```bash
cd apps/api && npx tsc --noEmit -p tsconfig.json
```

Both must exit 0.

> Because nothing here is automatic, the error-shape behaviour in § 3 and the CORS behaviour in
> § 4 have to be re-run by hand after any change to `config.ts`,
> `common/http-exception.filter.ts`, or `main.ts`. A 500 leaking a stack trace is the regression
> to watch for; it is invisible until someone looks at a real error response.

## 9. Frontend untouched (spec Out of Scope)

```bash
git status --short apps/web
```

Expected: empty.
