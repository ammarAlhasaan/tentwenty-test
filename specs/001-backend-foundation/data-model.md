# Phase 1 Data Model: BE-01 — Backend Foundation

**Date**: 2026-09-09 | **Plan**: [plan.md](./plan.md)

## Database tables

**None. This is deliberate.**

BE-01 establishes the SQLite *connection* and nothing that lives inside it. Per spec FR-021 and
Constitution Principle II, every table belongs to the spec that needs it:

| Table | Owning spec |
|---|---|
| users, sessions | BE-02 — Authentication |
| uploads, timesheet rows, salaries, project prices | BE-03 — Ingestion & calculations |

No migration mechanism is introduced either. BE-02 is the first spec that creates a table and
chooses how schema creation is applied at that point, with one real table as evidence rather than
zero.

Persistence is still verified in BE-01 (spec SC-007) using an ad-hoc scratch table created and
dropped inside the manual restart check in [quickstart.md](./quickstart.md) — it is never written
into application source.

## Configuration schema

The one "model" BE-01 defines. Validated by Zod at startup through
`ConfigModule.forRoot({ validationSchema })`; startup aborts non-zero if any row fails.

| Variable | Type / rule | Required | Default | Purpose |
|---|---|---|---|---|
| `NODE_ENV` | enum: `development` \| `test` \| `production` | no | `development` | Runtime environment name |
| `PORT` | integer, coerced, 1–65535 | no | `4000` | API listen port |
| `DATABASE_PATH` | non-empty string | no | `./data/margin.sqlite` | SQLite file. Relative paths resolve against `apps/api`, never `process.cwd()` |
| `FRONTEND_ORIGIN` | URL string | no | `http://localhost:3000` | The single browser origin permitted by CORS, with credentials |

Notes:

- Every variable has a working local default, so `cp .env.example .env` with no edits produces a
  running API (spec SC-001). Defaults are declared in the Zod schema, which is what makes them
  visible in one place rather than scattered as `??` fallbacks.
- `PORT` uses `z.coerce.number()` because environment values are always strings.
- A wildcard `FRONTEND_ORIGIN` is not accepted: `credentials: true` and `*` are mutually exclusive
  (spec FR-022).
- Nothing secret lives here yet. BE-02 adds `SESSION_SECRET`, which is why `.env` is gitignored
  from the start.

## Derived values

Computed in `config.ts`, not read from the environment:

| Value | Derivation | Why |
|---|---|---|
| `databaseFile` | `path.resolve(appDir, DATABASE_PATH)` where `appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')` | Spec FR-017: `pnpm -r dev` from the root and `pnpm dev` from `apps/api` have different working directories and must resolve to the same file |

## Error response shape

The other contract BE-01 fixes. Full definition in [contracts/errors.md](./contracts/errors.md).
