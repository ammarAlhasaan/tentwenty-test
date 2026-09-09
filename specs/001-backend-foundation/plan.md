# Implementation Plan: BE-01 — Backend Foundation

**Branch**: `001-backend-foundation` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-backend-foundation/spec.md`

## Summary

Turn the bare `apps/api` scaffold into a foundation the next two backend specs can build on,
without adding anything they do not yet need. Five concerns are settled once: environment
configuration validated at startup with Zod through `@nestjs/config`; request validation through
Nest 12's built-in `StandardSchemaValidationPipe` (also Zod, no new dependency); one error
response shape from a single `@Catch()` filter registered via `APP_FILTER`; a SQLite connection
from `better-sqlite3` behind a small injectable service with path resolution anchored to the app
directory and a clean shutdown; and CORS locked to one configured frontend origin with
credentials enabled so BE-02's session cookie needs no change here.

Net addition: two runtime dependencies (`@nestjs/config`, `better-sqlite3`), one dev dependency
(`@types/better-sqlite3`), three new source files, edits to three existing ones, and README/env
documentation. `GET /health` is the only endpoint, and stays the only endpoint.

Full version verification and the roadmap-wide dependency evaluation are in
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6.0.3, ESM (`"type": "module"`, `moduleResolution: nodenext` —
relative imports carry an explicit `.js` extension). Node 24.21.0 per `.nvmrc` (root `engines`
`>=24.15.0`).

**Primary Dependencies**: NestJS 12.0.1 (`common` / `core` / `platform-express`, default Express
adapter over the bundled `express@5.2.1`); Zod 4.5.4; **new:** `@nestjs/config@^12`,
`better-sqlite3@^13`, `@types/better-sqlite3` (dev).

**Storage**: One local SQLite file via `better-sqlite3`. Path from configuration, relative paths
anchored to `apps/api`. **No tables created by this spec.**

**Testing**: None. Vitest, `vite-tsconfig-paths`, `@nestjs/testing` and `vitest.config.ts` were
removed from `apps/api` on 2026-09-09 at the owner's direction. `oxlint` and `tsc --noEmit` are the
only automated gates; behaviour is verified by the manual checks in `quickstart.md`.

**Target Platform**: Local macOS development, Node process on port 4000. No cloud account, API
key, or paid service.

**Project Type**: Web service (backend half of a two-app repository; `apps/web` is untouched).

**Performance Goals**: Not applicable. Single local user, no throughput or latency target in the
brief.

**Constraints**: Preserve the existing scaffold, Express adapter, per-app scripts, root scripts,
and pnpm. No dependency installed with `--force` or `--legacy-peer-deps`. No placeholder code for
BE-02/BE-03.

**Scale/Scope**: ~6 source files in `apps/api/src`, one endpoint, one database connection.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see below.*

| Principle | Assessment |
|---|---|
| **I. Simple, Conventional Code** | PASS. Every mechanism is the documented Nest one: `ConfigModule.forRoot`, `useGlobalPipes`, `APP_FILTER`, `OnModuleDestroy` + `enableShutdownHooks`, `enableCors`. Nothing is hand-rolled where the framework ships an answer — notably the validation pipe, which is built in as of 12.0.1. |
| **II. No Speculative Structure** | PASS. Six files total. No repository, no base class, no interface with one implementation, no barrel file. `common/` holds exactly one file and `database/` exactly two; neither is created empty. No table, migration, seed, or service is added for BE-02/BE-03. |
| **III. Comments Explain the Non-Obvious** | PASS. Comments are written only where a decision cannot be read off the code — the likely spots are why the path anchor is `import.meta.url` rather than `process.cwd()`, why the unexpected-error branch never touches the thrown value, and why the CORS origin is an array with `credentials: true` before any cookie exists. No comment count is mandated in either direction: the rule is few and only where needed. |
| **IV. HTTP-Only Boundary** | PASS. `apps/api` only. No package is shared with `apps/web`; the Zod schemas here are not exported anywhere. The CORS origin is the only coupling, and it is a configuration string. |
| **V. One Side Per Spec** | PASS. Backend exclusively; `apps/web` is in the spec's Out of Scope list. |
| **VI. One Spec At A Time** | PASS. This turn produces artifacts only. Implementation waits for review. |
| **VII. Libraries That Remove Complexity** | PASS. Two runtime dependencies, each earning its place: `@nestjs/config` replaces hand-written `.env` loading, precedence, and caching; `better-sqlite3` replaces a hand-written driver. Rejected: `nestjs-zod`, `joi`, `class-validator`/`class-transformer`, `supertest`, `pino`, an ORM. `@nestjs/throttler` is **not** installed because its peer range excludes Nest 12 and the only way in is `--force` — see research.md § Proposed substitution 2. |
| **VIII. Verified Results Only** | PASS. Every version claim in research.md was read from the installed tree or the registry; unverified items (the darwin-arm64 prebuild fetch) are labelled and given verification task T004. `tasks.md` phase 5 is verification, and its results are reported as run. |

**Result: no violations. Complexity Tracking table is empty and omitted.**

**Post-Phase-1 re-check**: still PASS. The design added no file beyond the six above and no
abstraction; `data-model.md` records zero tables, confirming II is not eroded by the persistence
work.

## Project Structure

### Documentation (this feature)

```text
specs/001-backend-foundation/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 — version verification + roadmap dependency evaluation
├── data-model.md        # Phase 1 — configuration schema; deliberately no tables
├── quickstart.md        # Phase 1 — runnable verification guide
├── contracts/
│   ├── health.md        # GET /health
│   └── errors.md        # The one error response shape
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/api/
├── package.json                        # MODIFIED — add 2 deps + 1 devDep; drop vitest, vite-tsconfig-paths, @nestjs/testing and the test scripts
├── .env.example                        # NEW
├── README.md                           # NEW — local setup
├── vitest.config.ts                    # DELETED — test suite removed
└── src/
    ├── main.ts                         # MODIFIED — global pipe, CORS, shutdown hooks, config-driven port
    ├── app.module.ts                   # MODIFIED — import ConfigModule + DatabaseModule, provide APP_FILTER
    ├── app.controller.ts               # unchanged — GET /health stays exactly as it is
    ├── config.ts                       # NEW — Zod env schema, path anchor, typed accessor
    ├── common/
    │   └── http-exception.filter.ts    # NEW — the single global filter
    └── database/
        ├── database.module.ts          # NEW — @Global, provides + exports DatabaseService
        └── database.service.ts         # NEW — open on init, close on destroy

.gitignore                              # MODIFIED — ignore apps/api/.env and the SQLite file
README.md                               # MODIFIED — point at the API setup section
```

Untouched: `apps/web/**`, root `package.json` scripts, `nest-cli.json`, `oxlint.json`,
`.prettierrc`. `pnpm-workspace.yaml` answers its own `allowBuilds` placeholder for
`better-sqlite3`; `apps/api/tsconfig.json` drops `vitest/globals` from `types`.

**Structure Decision**: The target structure given in the task brief is adopted **unchanged** —
`main.ts`, `app.module.ts`, `config.ts`, `common/http-exception.filter.ts`,
`database/database.module.ts`, `database.service.ts`. It already matches Nest's own conventions
(feature folder for the database module, flat `common/` for the cross-cutting filter, a single
flat `config.ts` rather than a `config/` folder holding one file), so no simplification is
available. `app.controller.ts` keeps the health route where it is.

## Key Design Points

**`config.ts`** — a Zod object schema over the raw environment (`NODE_ENV`, `PORT`,
`DATABASE_PATH`, `FRONTEND_ORIGIN`, each with a coercion and, where sensible, a default), passed to
`ConfigModule.forRoot({ isGlobal: true, cache: true, validationSchema })`. `@nestjs/config` throws
on a validation failure during module initialisation, which aborts bootstrap with a non-zero exit
and Zod's per-field messages — FR-002 and FR-003 with no extra code. The same file exports the
resolved absolute database path, computed from `import.meta.url` rather than `process.cwd()`.

**`http-exception.filter.ts`** — `@Catch()`, injects `HttpAdapterHost` and holds a `Logger`.
Branches once on `exception instanceof HttpException`. The `HttpException` branch reuses
`getStatus()` and normalises `getResponse()` into the common shape; the other branch produces
`500` / `"Internal server error"` built from constants only, and is the only branch that logs.

**`database.service.ts`** — `onModuleInit` resolves the path, `mkdirSync(dirname, { recursive:
true })`, opens `new Database(path)`, sets `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys =
ON`; `onModuleDestroy` calls `close()`. `main.ts` adds `app.enableShutdownHooks()` so a SIGINT/
SIGTERM actually reaches it. The service exposes the `Database` instance directly — no query
wrapper, per Constitution II.

It is verified by the quickstart restart probe only. That probe opens its own connection to a
hard-coded file, so it proves SQLite persists rather than proving the service uses the configured
file and closes its handle — a known gap, accepted when the test suite was removed.

**`main.ts`** — reads port and origin from `ConfigService`, then
`app.useGlobalPipes(new StandardSchemaValidationPipe())`, `app.enableCors({ origin:
[frontendOrigin], credentials: true })`, `app.enableShutdownHooks()`, `app.listen(port)`.

The CORS origin is a **single-element array, not a bare string**. In the installed `cors@2.8.6`, a
string origin emits `Access-Control-Allow-Origin` unconditionally without consulting the request's
`Origin`; only the array form omits the header for a non-matching origin, which is the behaviour
FR-024 and SC-009 are written against. See research.md Decision 5.

## Unresolved Decisions

Carried to review; none blocks BE-01 implementation.

1. **Node version pin.** `.nvmrc` says 24.21.0; the current machine runs 26.4.0. Both satisfy
   `engines`, and every chosen dependency supports both. Recommendation: keep 24.21.0 (LTS, widest
   native prebuild coverage) and verify on it. BE-01 changes neither file either way.
2. **BE-02 session store.** `better-sqlite3-session-store` is rejected — GPL-3.0-only, last
   published 2022, built against `better-sqlite3` 7. **What replaces it is open**: a small store
   over the existing `DatabaseService`, `connect-sqlite3` (MIT, but adds a second SQLite driver),
   or a re-check for a maintained alternative. Decide in BE-02.
3. **BE-02 rate limiting.** `@nestjs/throttler@6.5.0` has no `^12` peer range and cannot be
   installed without `--force`. **Open**: re-check for a Nest 12 release when BE-02 starts, write
   a small guard for the login route, or drop rate limiting for a local exercise. The only firm
   conclusion is not to force the install.
4. **`argon2` and `express-session` install verification** is deferred to BE-02 by design — both
   must be install-verified against Node 24/26 and `express@5.2.1` at that point rather than
   assumed now.

## Complexity Tracking

Not applicable — the Constitution Check records no violations.
