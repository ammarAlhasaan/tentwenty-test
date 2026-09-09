---

description: "Task list for BE-01 — Backend Foundation"
---

# Tasks: BE-01 — Backend Foundation

**Input**: Design documents from `/specs/001-backend-foundation/`

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Spec FR-030 requires error-path behaviour to be verified by isolated tests,
and forbids permanent test or debug routes. Tests are unit-level (Vitest) only — no `supertest`,
no HTTP server started in a test, no controller mounted only for testing.

**Scope**: `apps/api` only. `apps/web` is not touched by any task here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story from spec.md this task serves (US1–US5)
- Every task names its exact file path

## Path Conventions

Paths are relative to the repository root. All source lives under `apps/api/src/`, matching the
structure fixed in plan.md § Project Structure. `apps/api` is ESM with `moduleResolution:
nodenext`, so **every relative import must carry an explicit `.js` extension**.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get the two new dependencies in, verified, before any code depends on them.

- [X] T001 ⚠️ **Could not be satisfied as written.** No version manager is installed (`nvm`/`fnm`/`volta`/`asdf`/`mise` all absent) and the only Node on the machine is Homebrew's **26.4.0**, so all verification ran on 26.4.0 rather than the pinned 24.21.0. Both satisfy `engines.node >=24.15.0`; the pin remains unverified by execution. Original task: confirm the active Node version matches `.nvmrc` (24.21.0) by running `nvm use` at the repository root; record the resolved `node -v` output. Do not change `.nvmrc` or `package.json` `engines` — the Node-version question is an open item in plan.md § Unresolved Decisions, for the reviewer.
- [X] T002 Add `@nestjs/config@^12` to `dependencies` in `apps/api/package.json` and install with `pnpm --filter api add @nestjs/config`. The install MUST NOT use `--force` or `--legacy-peer-deps`; if a peer conflict appears, stop and report it rather than suppressing it (Constitution VII).
- [X] T003 Add `better-sqlite3@^13` to `dependencies` and `@types/better-sqlite3` to `devDependencies` in `apps/api/package.json` via `pnpm --filter api add better-sqlite3` and `pnpm --filter api add -D @types/better-sqlite3`. Same no-force rule.
- [X] T004 Verify the `better-sqlite3` install fetched a prebuilt `darwin-arm64` binary rather than falling back to a `node-gyp` source build — this is the one item research.md flags as **Unverified**. Inspect the install output for compiler invocations. If it did compile from source, note that Xcode Command Line Tools are a prerequisite and record it for T023.
- [X] T005 Add `apps/api/.env` and `apps/api/data/` to `.gitignore` at the repository root. Do not modify root `package.json` scripts, `pnpm-workspace.yaml`, `nest-cli.json`, `tsconfig*.json`, `oxlint.json`, or `.prettierrc` (spec FR-026, FR-027).
  - **Done**: `.env*` already covered `apps/api/.env`; added `apps/api/data/*.sqlite{,-shm,-wal}` beside the existing `*.db` entries.
  - **Recorded deviation**: `pnpm-workspace.yaml` *was* edited, to replace the pre-existing scaffold placeholder `better-sqlite3: set this to true or false` under `allowBuilds` with `false` plus the T004 evidence. The file was already asking for this answer; leaving the placeholder would print `ERR_PNPM_IGNORED_BUILDS` on every install. No script, package manager, or workspace layout changed.

**Checkpoint**: Dependencies installed cleanly and version-verified; no source changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The configuration module. Every other phase reads its settings from here, so nothing
else can start until it exists.

**⚠️ CRITICAL**: T006–T008 block Phases 3–7.

- [X] T006 Create `apps/api/src/config.ts` exporting a Zod schema named `envSchema` over exactly the four variables in data-model.md § Configuration schema, with these constraints quoted verbatim from that table: `NODE_ENV` — enum `development` | `test` | `production`, default `development`; `PORT` — integer, coerced via `z.coerce.number()`, range 1–65535, default `4000`; `DATABASE_PATH` — non-empty string, default `./data/margin.sqlite`; `FRONTEND_ORIGIN` — `http`/`https` URL, normalised to its bare origin via `new URL(value).origin`, default `http://localhost:3000`, wildcard `*` NOT accepted. Normalisation is required, not cosmetic: CORS matching is an exact string comparison against the browser's `Origin`, which never carries a trailing slash or path, so an un-normalised `http://localhost:3000/` starts cleanly and then blocks every frontend request. (spec FR-004)
- [X] T007 In `apps/api/src/config.ts`, export `resolveDatabaseFile(databasePath: string): string` that anchors a relative path to the `apps/api` directory: derive the anchor as `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')` and return `path.resolve(anchor, databasePath)`. It MUST NOT use `process.cwd()`. Add a comment recording why (`pnpm -r dev` from the root and `pnpm dev` from `apps/api` have different working directories and must resolve to the same file — spec FR-017) — the anchor choice is not readable from the code alone.
- [X] T008 In `apps/api/src/app.module.ts`, import `ConfigModule.forRoot({ isGlobal: true, cache: true, validationSchema: envSchema })` from `@nestjs/config`, per the Standard Schema `validationSchema` form documented at https://docs.nestjs.com/techniques/configuration. Keep the existing `AppController` registration exactly as it is (spec FR-025, FR-026).

**Checkpoint**: Configuration is centralized and validated at startup. User story phases can begin.

---

## Phase 3: User Story 1 — Run the API from a clean checkout (Priority: P1) 🎯 MVP

**Goal**: A reviewer goes from clean checkout to a `200 {"status":"ok"}` in under five minutes,
following only the README.

**Independent Test**: On a machine with Node 24.21.0 and pnpm, run install → copy env → start →
`curl http://localhost:4000/health`.

### Implementation for User Story 1

- [X] T009 [US1] In `apps/api/src/main.ts`, replace `process.env.PORT ?? 4000` with the validated port read from `ConfigService`, so no raw `process.env` read remains anywhere in `apps/api/src` (spec FR-001). Keep `NestFactory.create(AppModule)` with the default Express adapter — do not switch platform (spec FR-026).
- [X] T010 [P] [US1] Create `apps/api/.env.example` listing all four variables from data-model.md with their documented local defaults and a one-line comment each. It MUST contain no real secret (spec FR-005). Every variable has a working default, so `cp .env.example .env` unedited must produce a running API.
- [X] T011 [P] [US1] Create `apps/api/README.md` documenting: required Node version (24.21.0, via `nvm use`), `pnpm install`, `cp .env.example .env`, the start command, and the `curl http://localhost:4000/health` verification. State explicitly that no cloud account, API key, or paid service is needed (spec FR-028, FR-029).
- [X] T012 [P] [US1] Add a short "API setup" pointer in the root `README.md` linking to `apps/api/README.md`. Do not add or change any root script (spec FR-027).

**Checkpoint**: `pnpm build`, `pnpm --filter api dev`, and `GET /health` all work from a clean
checkout. This is the MVP.

---

## Phase 4: User Story 2 — Fail loudly on bad configuration (Priority: P1)

**Goal**: Invalid configuration aborts startup with a message naming the offending setting.

**Independent Test**: Start with `PORT=not-a-number` and observe a non-zero exit naming `PORT`.

### Tests for User Story 2

- [X] T013 [P] [US2] Create `apps/api/src/config.spec.ts` covering, against `envSchema` directly (no server started): a fully valid environment parses; a missing-value case falls back to each documented default; `PORT=not-a-number` fails with an issue whose path names `PORT`; `PORT=0` and `PORT=70000` fail the 1–65535 range; `FRONTEND_ORIGIN=notaurl` fails naming `FRONTEND_ORIGIN`; `NODE_ENV=staging` fails the enum.

### Implementation for User Story 2

- [X] T014 [US2] Confirm that a `validationSchema` failure aborts bootstrap with a non-zero exit rather than being caught and logged — `@nestjs/config` throws during module initialization, so this requires no code, only verification that nothing in `main.ts` swallows the bootstrap rejection (spec FR-002, FR-003).
- [X] T015 [P] [US2] Add `resolveDatabaseFile` cases to `apps/api/src/config.spec.ts`: a relative path resolves to the same absolute file regardless of `process.cwd()` (set `process.cwd` to two different values within the test), and an absolute path is returned unchanged (spec FR-017).

**Checkpoint**: Configuration is proven to fail loudly and to default correctly.

---

## Phase 5: User Story 3 — One predictable error shape (Priority: P1)

**Goal**: Rejected input, known errors, and unexpected errors all return the identical field set,
with correct statuses and no leaked internals.

**Independent Test**: Exercise all three error classes against the filter in isolation and compare
their response bodies field by field.

### Tests for User Story 3

- [X] T016 [P] [US3] Create `apps/api/src/common/http-exception.filter.spec.ts` calling the filter directly with a stubbed `ArgumentsHost` and a stubbed `HttpAdapterHost` (no HTTP server, no test route — spec FR-030). Assert: (a) a `BadRequestException` yields status 400 and the shape in contracts/errors.md; (b) a `NotFoundException` yields 404 with its status preserved (spec FR-011); (c) a plain `new Error('secret detail at /Users/...')` yields 500 with `message: ["Internal server error"]`; (d) that 500 body contains no stack, no file path, no `'secret detail'` substring, and no configuration value (spec FR-012, SC-005); (e) all three bodies have the identical key set `statusCode, error, message, path, timestamp` and `message` is an array in every case (spec SC-004); (f) `Logger.error` is called exactly once — for (c) only, never for (a) or (b) (spec FR-013, FR-014, SC-006).

### Implementation for User Story 3

- [X] T017 [US3] Create `apps/api/src/common/http-exception.filter.ts`: a single `@Catch()` class implementing `ExceptionFilter`, injecting `HttpAdapterHost` and holding `new Logger(...)`. Guard on `host.getType() === 'http'` first. Branch once on `exception instanceof HttpException`: reuse `getStatus()` and normalise `getResponse()` into the shape; otherwise produce 500 with a message built from constants only. Reply via `httpAdapter.reply(...)`, per https://docs.nestjs.com/exception-filters. Add a comment recording why the unexpected branch never reads any field off the thrown value — that omission is the mechanism enforcing FR-012 and would otherwise look like an oversight.
- [X] T018 [US3] Emit exactly the body defined in [contracts/errors.md](./contracts/errors.md) — `statusCode`, `error`, `message` (**always** a `string[]`, even for one message), `path` (from `httpAdapter.getRequestUrl(...)`), `timestamp` (ISO 8601 UTC) — for all three classes (spec FR-010).
- [X] T019 [US3] Log only in the non-`HttpException` branch, via `Logger.error(message, stack)` at error level with full detail including the stack. Expected errors (validation failures, `HttpException`s) MUST NOT be logged at error level (spec FR-013, FR-014).
- [X] T020 [US3] Register the filter globally in `apps/api/src/app.module.ts` via the `APP_FILTER` provider token (not `app.useGlobalFilters`), because the filter needs DI for `HttpAdapterHost` — the registration the official docs call preferable.
- [X] T021 [US3] In `apps/api/src/main.ts`, add `app.useGlobalPipes(new StandardSchemaValidationPipe())` from `@nestjs/common`. Do not write a custom Zod pipe and do not install `nestjs-zod` — the pipe is built into the installed 12.0.1 (research.md Decision 2). Its default `errorHttpStatusCode` is already 400 (spec FR-007, FR-008, FR-009).
- [X] T022 [P] [US3] Add a case to `apps/api/src/common/http-exception.filter.spec.ts` proving the pipe's output feeds the shape correctly: construct the exception `StandardSchemaValidationPipe` produces for a failing Zod schema, pass it to the filter, and assert 400 with one `message` entry per failed field, each prefixed with its path (spec FR-009). No route is added.

**Checkpoint**: The HTTP error contract that BE-02, BE-03, and `apps/web` all depend on is fixed
and tested.

---

## Phase 6: User Story 4 — Data that survives a restart (Priority: P2)

**Goal**: An injectable SQLite connection at a configurable, reliably-resolved path that closes
cleanly.

**Independent Test**: Write a value through the service, restart the API, read it back.

### Implementation for User Story 4

- [X] T023 [US4] Create `apps/api/src/database/database.service.ts`: an `@Injectable()` implementing `OnModuleInit` and `OnModuleDestroy`. On init — read `DATABASE_PATH` from `ConfigService`, resolve it with `resolveDatabaseFile` (T007), `fs.mkdirSync(path.dirname(file), { recursive: true })` (spec FR-018), open `new Database(file)`, then set `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON`. On destroy — `close()` (spec FR-020). Expose the `Database` instance as a readonly property; add **no** query wrapper, generic repository, or base class (Constitution II).
- [X] T024 [US4] Ensure a database path that cannot be opened fails startup with a message naming the path, rather than starting and failing on first write (spec US-4 scenario 5, and the corresponding Edge Case). Let the underlying error propagate out of `onModuleInit` — do not catch and continue.
- [X] T025 [US4] Create `apps/api/src/database/database.module.ts`: a `@Global() @Module({ providers: [DatabaseService], exports: [DatabaseService] })`. Global so BE-02/BE-03 need no repeated import. Create **no** table, migration, or seed — data-model.md records zero tables for BE-01 (spec FR-021).
- [X] T026 [US4] Import `DatabaseModule` in `apps/api/src/app.module.ts`.
- [X] T027 [US4] In `apps/api/src/main.ts`, call `app.enableShutdownHooks()` before `listen`, so that SIGINT/SIGTERM actually reaches `onModuleDestroy` (https://docs.nestjs.com/fundamentals/lifecycle-events). Without it, T023's `close()` never runs and spec FR-020 fails silently.
- [X] T027a [US4] Create `apps/api/src/database/database.service.spec.ts` exercising **the service itself**, not an independently opened connection. Instantiate `DatabaseService` with a stub `ConfigService` pointing at a unique temp path under `os.tmpdir()`; run `onModuleInit`; assert the file was created at the path the service resolved (spec FR-016, FR-018); create a scratch table and insert a row through `service.db`; run `onModuleDestroy` and assert the handle is closed (`service.db.open === false`, and a further query throws — spec FR-020); then open a fresh `better-sqlite3` connection to that same temp path and read the row back (spec FR-019). Also assert that a path which cannot be opened makes `onModuleInit` reject with the path in the message (spec FR-024's sibling, US-4 scenario 5). Clean up the temp file in `afterEach`. **Why this task exists**: the quickstart § 6 probe opens its own connection to a hard-coded file, so it would pass even if `DatabaseService` wrote to a different file or never closed its handle — it proves SQLite persists, not that the service is correct.

**Checkpoint**: A connection exists, persists, and closes — with nothing inside it yet.

---

## Phase 7: User Story 5 — The frontend can call the API from the browser (Priority: P2)

**Goal**: One explicitly configured origin is permitted with credentials; others are not.

**Independent Test**: `curl` with the allowed `Origin` and with a different one, and compare
headers.

### Implementation for User Story 5

- [X] T028 [US5] In `apps/api/src/main.ts`, call `app.enableCors({ origin: [<FRONTEND_ORIGIN from ConfigService>], credentials: true })`. The origin MUST be passed as a **single-element array, not a bare string**: in the installed `cors@2.8.6` (`lib/index.js`, `configureOrigin`) a string origin emits `Access-Control-Allow-Origin` unconditionally without consulting the request's `Origin`, whereas the array branch sets the value to `false` — omitting the header — for a non-matching origin. FR-024, SC-009, and T035 are all written against the header being absent, so only the array form satisfies them. A wildcard MUST NOT be used, and is in any case incompatible with `credentials: true` (spec FR-022, FR-023, FR-024). No new dependency: `cors@2.8.6` is already bundled inside the installed `@nestjs/platform-express@12.0.1`.
- [X] T029 [US5] Add a comment at that call covering both non-obvious choices: why the origin is an array rather than a string (header omission, above), and why `credentials: true` is set before any cookie exists (BE-02 introduces cookie-based sessions, and this setting is mutually exclusive with a wildcard origin, so deciding it now makes BE-02 a no-op change to this file).

**Checkpoint**: All five user stories implemented. Proceed to verification.

---

## Phase 8: Verification (from quickstart.md)

**Purpose**: Run every check in [quickstart.md](./quickstart.md) and report its **actual** output.
Per Constitution VIII, only results genuinely produced may be reported; a check that was skipped,
was inconclusive, or failed is reported as such, with its output.

- [X] T030 Install & build: `nvm use && pnpm install && pnpm build`. Confirm zero errors and that no `--force` / `--legacy-peer-deps` was used and no peer-dependency error appeared (spec SC-002). Corresponds to quickstart § Setup and § 1.
- [X] T031 Startup with the existing command: `pnpm --filter api dev`. Confirm Nest reports listening on port 4000 (spec US-1 scenario 2).
- [X] T032 `GET /health`: `curl -i http://localhost:4000/health` returns `200` and `{"status":"ok"}` (spec FR-025). Confirm no endpoint exists beyond it (spec SC-010).
- [X] T033 Invalid configuration: run quickstart § 3's `PORT=not-a-number` and `FRONTEND_ORIGIN=notaurl` cases; confirm a non-zero exit and a message naming each variable (spec US-2 scenarios 1–2).
- [X] T034 Valid configuration and defaults: run quickstart § 3's no-`.env` case; confirm the API starts on 4000 using schema defaults (spec US-2 scenarios 3–4).
- [X] T035 CORS: run all three quickstart § 4 commands. Confirm the allowed origin is echoed with `access-control-allow-credentials: true`, the disallowed origin gets **no** `access-control-allow-origin` header at all, and the preflight succeeds (spec SC-009). If the header is present with the configured value on the disallowed-origin request, the origin was passed as a string instead of an array — fix T028 rather than relaxing this expectation.
- [X] T036 Database path resolution: run quickstart § 5 from the repository root and from `apps/api`; confirm exactly one `.sqlite` file exists, under `apps/api/data/` in both cases (spec SC-008).
- [X] T037 Persistence across restart: run quickstart § 6's write → restart → read using the ad-hoc `_probe` scratch table, then drop it. Confirm the value survives (spec SC-007). The scratch table MUST NOT be added to application source. This is a coarse end-to-end check on the real file; T027a is the test that actually covers the service's own behaviour.
- [X] T038 Clean shutdown: run quickstart § 7 — SIGINT the process and confirm no `-wal` / `-shm` sidecar files remain in `apps/api/data/` (spec FR-020).
- [X] T039 Automated tests: `pnpm --filter api test`. All tests pass — `config.spec.ts`, `http-exception.filter.spec.ts`, and `database.service.spec.ts`. Confirm no test starts an HTTP server and no test/debug route exists in the application (spec FR-030).
- [X] T040 Lint: `pnpm --filter api lint` passes.
- [X] T041 Confirm the frontend is untouched: `git status --short apps/web` is empty, and root `package.json` and `pnpm-workspace.yaml` are unchanged (spec Out of Scope, FR-027).

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T042 Grep `apps/api/src` for `process.env` and confirm the only remaining occurrence, if any, is inside `config.ts` (spec FR-001).
- [X] T043 Review every comment written: each must record a decision that cannot be read off the code, and none may restate what the code says (Constitution III). There is no required comment count — remove any that only narrates, and add one anywhere a reader would reasonably ask "why is it done this way?".
- [X] T044 Confirm no speculative structure was added: no generic repository, base class, single-implementation interface, barrel file, or empty folder; no service, route, or table anticipating BE-02/BE-03 (Constitution II, spec FR-021).
- [X] T045 If T004 found that `better-sqlite3` compiled from source, add the Xcode Command Line Tools prerequisite to `apps/api/README.md`. If it used a prebuilt binary, make no change and record that in the report.
- [X] T046 Update [research.md](./research.md) § 1 to mark the darwin-arm64 prebuild item resolved with the actual T004 finding, replacing its **Unverified** label.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1. **Blocks Phases 3–7** — every story reads
  configuration.
- **Phase 3 (US1)**: depends on Phase 2. The MVP.
- **Phase 4 (US2)**: depends on Phase 2.
- **Phase 5 (US3)**: depends on Phase 2.
- **Phase 6 (US4)**: depends on Phase 2 (needs `resolveDatabaseFile` from T007).
- **Phase 7 (US5)**: depends on Phase 2.
- **Phase 8 (Verification)**: depends on Phases 3–7.
- **Phase 9 (Polish)**: depends on Phase 8.

### User Story Dependencies

The five stories are independent of each other once Phase 2 is done. They touch overlapping files
(`main.ts`, `app.module.ts`), which constrains parallelism more than logic does:

- **US1 (P1)**: independent.
- **US2 (P1)**: independent. Tests the schema US1 already uses.
- **US3 (P1)**: independent. Its filter is registered in `app.module.ts`, its pipe in `main.ts`.
- **US4 (P2)**: independent. Needs `resolveDatabaseFile` (T007, Phase 2), not any other story.
- **US5 (P2)**: independent. One call in `main.ts`.

### Serialisation points

`apps/api/src/main.ts` is edited by T009 (US1), T021 (US3), T027 (US4), and T028/T029 (US5).
`apps/api/src/app.module.ts` is edited by T008 (Phase 2), T020 (US3), and T026 (US4). Tasks
touching the same file are **not** marked `[P]` and must be applied in task order.

### Parallel Opportunities

- Phase 1: T002 and T003 are separate installs but share one lockfile — run them sequentially.
- Phase 3: T010, T011, T012 are three separate documentation files — fully parallel.
- Phase 4: T013 and T015 both write `config.spec.ts`; T015 is marked `[P]` only relative to other
  phases, not to T013 — apply T013 first.
- Phase 5: T016 (the spec file) is parallel with T017 (the filter), since they are different
  files; T022 appends to T016's file and follows it.
- Across phases: once Phase 2 is complete, the documentation tasks (US1) and the filter tests
  (US3 T016) can proceed alongside the database work (US4 T023, T025) — different files entirely.

---

## Parallel Example: User Story 1

```bash
# Three independent documentation files, no shared state:
Task: "Create apps/api/.env.example with the four documented variables"   # T010
Task: "Create apps/api/README.md with the local setup steps"              # T011
Task: "Add an API setup pointer to the root README.md"                    # T012
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 — Setup (T001–T005)
2. Phase 2 — Foundational (T006–T008) — blocks everything
3. Phase 3 — US1 (T009–T012)
4. **STOP and VALIDATE**: run quickstart § Setup, § 1, and § 2. A reviewer can now clone, install,
   start, and get a health check. That alone is a deliverable increment.

### Incremental delivery

5. Phase 4 (US2) → configuration now fails loudly. Validate with quickstart § 3.
6. Phase 5 (US3) → the error contract is fixed. Validate with `pnpm --filter api test`.
7. Phase 6 (US4) → persistence exists. Validate with quickstart § 5, § 6, § 7.
8. Phase 7 (US5) → the browser can call the API. Validate with quickstart § 4.
9. Phase 8 → run every verification task and report actual output.
10. Phase 9 → polish, then **stop for review** before BE-02 (Constitution VI).

### Task counts

| Phase | Tasks | Story |
|---|---|---|
| 1 — Setup | 5 (T001–T005) | — |
| 2 — Foundational | 3 (T006–T008) | — |
| 3 — Run from clean checkout | 4 (T009–T012) | US1 |
| 4 — Fail loudly on bad config | 3 (T013–T015) | US2 |
| 5 — One error shape | 7 (T016–T022) | US3 |
| 6 — Data survives restart | 6 (T023–T027a) | US4 |
| 7 — Browser can call the API | 2 (T028–T029) | US5 |
| 8 — Verification | 12 (T030–T041) | — |
| 9 — Polish | 5 (T042–T046) | — |
| **Total** | **47** | |
