# Phase 0 Research: BE-01 — Backend Foundation

**Date**: 2026-09-09
**Spec**: [spec.md](./spec.md)

All version facts below were read from the installed tree in `apps/api/node_modules` or from the
npm registry on 2026-09-09, and cross-checked against official documentation. Anything not
actually verified is labelled **Unverified** and carries a verification task in `tasks.md`.

## 1. Installed baseline (verified)

Read from `apps/api/node_modules/*/package.json` and the repository root:

| Package / tool | Installed | Note |
|---|---|---|
| `@nestjs/common` | 12.0.1 | |
| `@nestjs/core` | 12.0.1 | |
| `@nestjs/platform-express` | 12.0.1 | bundles `express@5.2.1`, `cors@2.8.6`, `multer@2.2.0` |
| `zod` | 4.5.4 | implements Standard Schema v1 |
| `read-excel-file` | 9.3.10 | unused until BE-03 |
| `vitest` | 4.1.11 | `apps/api/vitest.config.ts`, `**/*.spec.ts` |
| `typescript` | 6.0.3 | |
| `@nestjs/cli` | 12.x | |
| pnpm | 11.9.0 | `packageManager` field, root |
| Node (`.nvmrc`) | 24.21.0 | root `engines.node` is `>=24.15.0` |
| Node (this machine) | 26.4.0 | **mismatch with `.nvmrc`** — see Decision 8 |

`apps/api` is ESM (`"type": "module"`) with `module`/`moduleResolution` set to `nodenext`, so
every relative import must carry an explicit `.js` extension — the existing scaffold already does
this (`./app.module.js`).

## 2. Decisions

### Decision 1 — Configuration: `@nestjs/config` 12.0.0 with a Zod `validationSchema`

**Decision**: Install `@nestjs/config@^12`. Register `ConfigModule.forRoot({ isGlobal: true, cache:
true, validationSchema: <zod schema>, envFilePath: <resolved .env> })` in `AppModule`, with the Zod
schema and a small typed accessor living in `apps/api/src/config.ts`.

**Verified**: `@nestjs/config@12.0.0` declares
`peerDependencies: { "@nestjs/common": "^11.0.0 || ^12.0.0", "rxjs": "^7.1.0" }` — a clean match for
the installed Nest 12.0.1 and rxjs 7.8, so no `--force` or `--legacy-peer-deps` is needed. Its own
dependencies are `dotenv@17.4.2`, `dotenv-expand@13.0.0`, `es-toolkit@1.51.0`, and
`@standard-schema/spec@1.1.0`.

**Rationale**: The official configuration docs now state that `validationSchema` accepts *"A
Standard Schema compatible schema … Any library implementing the specification works — Zod,
Valibot, ArkType, and others"*, and give a Zod example directly. That means the already-installed
Zod 4.5.4 validates the environment with no extra dependency: no `joi`, no `class-validator`, no
`class-transformer`. `@standard-schema/spec` arriving transitively is the same spec interface the
validation pipe uses, so config validation and request validation share one mechanism (FR-001,
FR-002, FR-003).

**Alternatives considered**:
- *A hand-written `validate()` function with Zod, no `@nestjs/config`* — would still need `.env`
  loading, precedence, and caching written by hand. Rejected: adds code to avoid one well-scoped
  first-party dependency (Constitution VII).
- *`joi` via `validationSchema`* — the classic Nest example, but it is a second schema library
  alongside Zod. Rejected as duplicated complexity.

### Decision 2 — Request validation: `StandardSchemaValidationPipe` (built in, no new dependency)

**Decision**: Register `app.useGlobalPipes(new StandardSchemaValidationPipe())` in `main.ts`.
Route handlers attach Zod schemas at the parameter decorator, e.g.
`@Body({ schema: someZodSchema })`.

**Verified**: `StandardSchemaValidationPipe` is present in the *installed* `@nestjs/common@12.0.1`
— exported from `node_modules/@nestjs/common/pipes/index.js` with types in
`pipes/standard-schema-validation.pipe.d.ts`. Its options are `transform` (default `true`),
`validateCustomDecorators` (default `false`), `validateOptions`, `errorHttpStatusCode` (default
`HttpStatus.BAD_REQUEST`), and `exceptionFactory`. Its protected `toValidate(metadata)` skips any
parameter with no schema attached, so registering it globally is safe for `GET /health`, which
declares no schema.

**Rationale**: This is the framework's own answer to "my schemas are Zod, not class DTOs" — the
official validation docs describe it as the recommended path *"when your schemas already live
outside of class-based DTOs."* Using it means zero new dependencies, no custom pipe, and a
default 400 status that already matches FR-008. The pipe's `formatIssueMessages` prefixes each
issue with its path, which satisfies FR-009 (identify which inputs failed and why).

**Alternatives considered**:
- *A hand-written `ZodValidationPipe`* — about 25 lines, and the near-universal pattern in older
  Nest+Zod tutorials. Rejected: Nest 12 ships the same thing, better tested, with prototype-
  pollution key stripping built in (Constitution I).
- *`nestjs-zod`* — a third-party wrapper. Rejected: it duplicates a now-built-in feature.
- *The class-validator `ValidationPipe`* — would require `class-validator` + `class-transformer`
  and a parallel set of DTO classes alongside the Zod schemas BE-03 needs for spreadsheet parsing.
  Rejected as two validation systems.

**Open point (recorded, not blocking)**: BE-01 adds no route with a request body, so the pipe is
registered and proven by isolated test only (FR-030). The first real consumer is BE-02.

### Decision 3 — Error shape: one `@Catch()` filter registered via `APP_FILTER`

**Decision**: One file, `apps/api/src/common/http-exception.filter.ts`, holding a single
`@Catch()`-everything filter registered in `AppModule` through the `APP_FILTER` token. Response
body:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["email: Invalid email"], "path": "/x", "timestamp": "..." }
```

`message` is always an array of strings. For an unexpected error it is the single generic string
`"Internal server error"`.

**Verified against**: the official exception-filters documentation, which shows the
`@Catch()`-with-no-arguments "catch everything" filter, the `HttpAdapterHost`/`ArgumentsHost`
pattern for platform-agnostic replies, the default `{ "statusCode": 500, "message": "Internal
server error" }` body for unrecognised exceptions, and both registration methods — noting
`APP_FILTER` is *"preferable since it enables full dependency injection within the module
system"*, which this filter needs in order to inject `Logger`.

**Rationale**:
- `exception instanceof HttpException ? exception.getStatus() : 500` preserves the status of every
  deliberately raised Nest exception, including the 400 the validation pipe throws (FR-011).
- Only the non-`HttpException` branch logs, at `Logger.error(message, stack)` — expected errors
  never reach the error log (FR-013, FR-014).
- The non-`HttpException` branch never reads anything off the thrown value into the response body,
  which is what actually guarantees FR-012; hiding details is a property of the code path, not of
  a `NODE_ENV` check.
- Using `httpAdapter.reply(...)` rather than `res.status().json()` keeps the filter honest about
  the adapter, per the documented pattern.
- `host.getType() === 'http'` is checked first so a non-HTTP context (none today) cannot crash the
  filter.

**Alternatives considered**:
- *Two filters — one `@Catch(HttpException)`, one `@Catch()`* — the common blog pattern. Rejected:
  the spec asks for "one small global exception filter", and one filter with one branch is less
  code than two files (Constitution II).
- *An interceptor* — wrong tool; interceptors do not see errors thrown before the handler, which
  is exactly where validation failures happen.

### Decision 4 — Persistence: `better-sqlite3` 13.x behind a tiny `DatabaseService`

**Decision**: Install `better-sqlite3@^13` and `@types/better-sqlite3` (dev). A
`DatabaseModule` (global) provides a `DatabaseService` that opens the connection in
`onModuleInit` and closes it in `onModuleDestroy`, exposing the raw `Database` instance as a
readonly property. `main.ts` calls `app.enableShutdownHooks()`.

**Verified**: `better-sqlite3@13.0.3`, `engines: { node: ">=22" }`, dependency
`node-addon-api@^8`. v13.0.0 migrated the addon to **N-API**, and the maintainers state prebuilt
binaries *"should theoretically work across different versions of Node.js and Electron"* and are
now published directly with the package. v12.10.0 release notes record *"support for Node.js v26
prebuilds and remove EOL builds (Node.js v20, v23)"*. So both `.nvmrc`'s Node 24 and this
machine's Node 26 are in scope.

**Unverified**: that a `darwin-arm64` prebuild is actually fetched on this machine rather than
falling back to a `node-gyp` source build. This is checked by task **T004** — the install must
complete with no compiler invocation. If it does fall back, Xcode Command Line Tools are the
documented prerequisite and go in the README.

**Path resolution (FR-017)**: the anchor is the API application directory, derived from
`import.meta.url` — `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')` from
`config.ts`, then `path.resolve(anchor, DATABASE_PATH)`. `process.cwd()` is deliberately not used:
`pnpm -r --parallel dev` from the root and `pnpm dev` from `apps/api` have different working
directories, and the spec requires both to resolve to one file. `fs.mkdirSync(dirname, {
recursive: true })` before opening satisfies FR-018.

**Rationale**: `better-sqlite3` is synchronous, which removes the entire async/callback layer for
a single-process local app, and it is the standard non-ORM SQLite choice for Node. No table is
created here (FR-021).

**Alternatives considered**:
- *`node:sqlite`* — built into Node 22+, zero dependencies, and genuinely tempting. Rejected for
  now: on the pinned Node 24.21.0 it is still flagged experimental and emits a runtime warning, and
  its API is a moving target across 22/24/26 — a poor foundation for a spec that must run
  identically on two Node majors. Worth revisiting once the project pins a single Node version.
- *An ORM (Prisma, Drizzle, TypeORM)* — explicitly out of scope, and BE-03's queries are
  aggregations that read better as SQL.

### Decision 5 — CORS: `app.enableCors()` with an explicit origin and credentials

**Decision**: `app.enableCors({ origin: [config.frontendOrigin], credentials: true })` in
`main.ts` — the origin passed as a **single-element array, not a bare string**, with
`FRONTEND_ORIGIN` a validated configuration value defaulting to `http://localhost:3000`.

**Verified**: the official CORS docs show `app.enableCors()` taking *"an optional configuration
object argument"* and note Nest *"makes use of the Express cors … package"* — that is the
`cors@2.8.6` already vendored inside the installed `@nestjs/platform-express@12.0.1`, so no new
dependency.

**The string-vs-array distinction matters, and an earlier draft of this plan got it wrong.** Read
from the installed `cors@2.8.6` source (`lib/index.js`, `configureOrigin`):

- A **string** `origin` takes the `isString(options.origin)` branch, which pushes
  `Access-Control-Allow-Origin: <that string>` **unconditionally** — the request's own `Origin` is
  never even consulted. The header is therefore present on a response to *any* origin. The browser
  still blocks the cross-origin read, because the echoed value does not match the requesting
  origin, so the security outcome is correct — but the header is there.
- An **array** `origin` takes the `else` branch, which calls `isOriginAllowed(requestOrigin,
  options.origin)` and sets the header value to `isAllowed ? requestOrigin : false`. A `false`
  value means the header is **omitted entirely**.

FR-024 and SC-009 are written in terms of the header being absent for a disallowed origin, and the
verification step greps for exactly that. Only the array form produces that observable behaviour,
so the array form is what is specified — configuration, documentation, and verification now agree.
`credentials: true` emits `Access-Control-Allow-Credentials: true` in both forms (FR-022, FR-023).

**Rationale**: `credentials: true` is required now, not in BE-02, because it is mutually exclusive
with a wildcard origin — deciding it here is what makes BE-02's session cookie a no-op change to
this file (FR-023).

### Decision 6 — Logging: the built-in Nest `Logger`

**Decision**: `new Logger(HttpExceptionFilter.name)` inside the filter. No logging dependency.

**Rationale**: FR-013 asks for the framework's logging facility, and the default logger already
prints level, timestamp, and context. A structured logger (`pino`, `winston`) removes no
meaningful complexity for a locally run exercise (Constitution VII), and the spec's Assumptions
explicitly say structured output is not required.

### Decision 7 — Testing: existing Vitest, isolated tests only

**Decision**: Reuse `apps/api/vitest.config.ts` unchanged. Error-path behaviour is tested by
calling the filter with a stubbed `ArgumentsHost`/`HttpAdapterHost` and by validating Zod schemas
directly. Config validation is tested by running the schema against good and bad objects.
`DatabaseService` is tested directly against a temporary file. No `supertest`, no HTTP-level e2e
in BE-01, and **no permanent test or debug route** (FR-030).

**Rationale**: BE-01 exposes one endpoint that has no inputs and cannot fail; the behaviour worth
testing is the filter's branching, the config schema, and the database service, all of which are
pure units. Adding `supertest` plus a throwing controller mounted only in tests would be more
machinery than the thing it tests.

**On the database check specifically**: the `quickstart.md` restart probe opens its **own**
`better-sqlite3` connection to a hard-coded path. That proves SQLite persists, which is not in
doubt — it does **not** prove `DatabaseService` writes to the file the configuration names, since
the probe would pass identically if the service opened a different file or never closed its
handle. So the real check is a unit test that drives `DatabaseService` itself: point it at a temp
path, write through it, run `onModuleDestroy`, assert the handle is closed, re-open, and read the
value back. The quickstart probe is kept as a coarse end-to-end sanity check on the real file, but
the service test is the one that actually covers FR-016, FR-019, and FR-020.

The CORS criteria (SC-009) remain verified by documented commands against a running process,
since response headers are a property of the live server.

### Decision 8 — Node version: document 24.21.0, verify on it

**Decision**: The README documents Node **24.21.0** (the `.nvmrc` pin, an LTS line) as the
supported version. Verification tasks run under `nvm use`, not under whatever Node happens to be
active.

**Finding**: this machine currently runs Node **v26.4.0** while `.nvmrc` says `24.21.0`. Both
satisfy the root `engines.node: ">=24.15.0"`, and every selected dependency supports both, so this
is not blocking — but a reviewer following `.nvmrc` and a developer on 26 would otherwise be
verifying different things, and native modules are precisely where that difference bites.

**Unresolved — for the reviewer**: whether to keep `.nvmrc` at 24.21.0 (recommended: LTS, widest
prebuild coverage) or move the repository to Node 26. Recorded in `plan.md` § Unresolved
Decisions; no file is changed by BE-01 either way.

## 3. Roadmap dependency evaluation

Requested evaluation of every candidate across BE-01/02/03. **Only the BE-01 column is installed
by this spec.**

| Package | Latest | Verdict | Evidence |
|---|---|---|---|
| `@nestjs/config` | 12.0.0 | **Install in BE-01** | Peer `@nestjs/common ^11 \|\| ^12` — matches 12.0.1. Standard Schema `validationSchema` takes Zod directly. |
| `better-sqlite3` | 13.0.3 | **Install in BE-01** | `engines >=22`; N-API since 13.0.0; Node 26 prebuilds added in 12.10.0. Prebuild fetch on darwin-arm64 unverified → T004. |
| `@types/better-sqlite3` | latest | **Install in BE-01 (dev)** | `better-sqlite3` ships no types. |
| Zod | 4.5.4 | **Already installed — keep** | Serves config validation, request validation, and BE-03 row parsing from one library. |
| Vitest | 4.1.11 | **Already installed — keep** | Config and script already in place; no change. |
| `read-excel-file` | 9.3.10 | **Already installed — defer to BE-03** | Handles `.xlsx` with messy headers/blank cells, matching the brief's data. Not imported in BE-01. |
| Nest Multer integration | bundled | **Defer to BE-03 — no install** | `multer@2.2.0` already ships inside `@nestjs/platform-express@12.0.1`; `FileInterceptor` needs only `@types/multer` (dev) when BE-03 lands. |
| `argon2` | 0.45.1 | **Defer to BE-02 — verify then** | `engines >=16.17.0`; ships prebuilds "regardless of the platform" since 0.40.0; 0.45.0 dropped Node 18/20. No published statement of a Node 26 ABI, and it uses `node-gyp-build` fallback — must be install-verified in BE-02, not assumed. |
| `express-session` | 1.19.0 | **Defer to BE-02 — verify then** | 1.19.0 (Jan 2026) added per-request dynamic cookie options. Declares no Express peer range; Express 5 support is widely relied upon but not stated in its own docs, so BE-02 must verify against the installed `express@5.2.1`. |
| `better-sqlite3-session-store` | 0.1.0 | **Do not use — substitute** | See below. |
| `@nestjs/throttler` | 6.5.0 | **Do not install — blocked** | See below. |

### Proposed substitution 1 — `better-sqlite3-session-store`

**Problem**: `better-sqlite3-session-store@0.1.0` was last published 2022-06-25, is developed
against `better-sqlite3@7.1.1` and `express-session@1.17.1` (we would run 13.x and 1.19.0), pins
`date-fns@2.16.1` as its only runtime dependency, and — most consequentially — is licensed
**GPL-3.0-only**. Linking a GPL-3.0 library into a take-home submission imposes copyleft
obligations on the whole backend, which is not a trade the exercise asks for.

**What is decided here**: only that this package is not used. **What replaces it is an open
question for BE-02**, not a choice adopted now.

Candidates to weigh when BE-02 starts, neither pre-selected:

- A small store over the existing `DatabaseService` (`get` / `set` / `destroy`, plus expiry
  cleanup). `express-session`'s store contract is small and documented, and we already hold the
  SQLite handle — but it is still code to own.
- `connect-sqlite3` (MIT) — a maintained package, at the cost of a *second*, non-N-API SQLite
  driver (`sqlite3`) alongside `better-sqlite3`: worse on dependency count and native-build risk.
- Re-check whether a maintained, permissively-licensed `better-sqlite3` store has appeared.

**This is a BE-02 decision. BE-01 changes nothing here.** Flagged in plan.md § Unresolved
Decisions.

### Proposed substitution 2 — `@nestjs/throttler`

**Problem — blocking**: `@nestjs/throttler@6.5.0` (the current `latest`; there is no v7) declares

```
peerDependencies: { "@nestjs/common": "^7 || ^8 || ^9 || ^10 || ^11",
                    "@nestjs/core":   "^7 || ^8 || ^9 || ^10 || ^11" }
```

It has **no `^12` range**, so installing it against `@nestjs/common@12.0.1` is a peer-dependency
conflict. The only ways past it are `--force` or `--legacy-peer-deps`, which Constitution VII
forbids and the task brief explicitly rules out. It is therefore **not installed in BE-01 and not
planned for BE-02 as things stand**.

**Options for BE-02**, to be decided then — none adopted now:

1. **Wait / re-check.** Nest 12 is recent; a throttler release adding `^12` is the clean fix.
   Re-run `npm view @nestjs/throttler peerDependencies` when BE-02 starts.
2. **A small guard.** BE-02 would need rate limiting on one route (login), which is less than the
   full throttler feature set — but it is code to own, and getting a limiter subtly wrong is easy.
3. **Drop it.** For a locally run, single-user exercise with no public exposure, rate limiting may
   be out of scope entirely.

The one firm conclusion: **do not force the install.** Which of the three applies is a BE-02
decision.

## 4. Official documentation consulted

- NestJS — Validation (`StandardSchemaValidationPipe`): https://docs.nestjs.com/techniques/validation
- NestJS — Configuration (`@nestjs/config`, Standard Schema `validationSchema`): https://docs.nestjs.com/techniques/configuration
- NestJS — Exception filters (`@Catch()`, `HttpAdapterHost`, `APP_FILTER`): https://docs.nestjs.com/exception-filters
- NestJS — CORS: https://docs.nestjs.com/security/cors
- NestJS — Lifecycle events (`enableShutdownHooks`, `OnModuleDestroy`): https://docs.nestjs.com/fundamentals/lifecycle-events
- NestJS — Logger: https://docs.nestjs.com/techniques/logger
- Standard Schema specification: https://github.com/standard-schema/standard-schema
- Zod — Standard Schema support: https://zod.dev/
- better-sqlite3 — releases / N-API migration and Node 26 prebuilds: https://github.com/WiseLibs/better-sqlite3/releases
- better-sqlite3 — API: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
- expressjs/cors — `origin` and `credentials` options: https://github.com/expressjs/cors#configuration-options
- express-session — store contract and options: https://github.com/expressjs/session
- node-argon2 — releases and prebuilds: https://github.com/ranisalt/node-argon2/releases
- `@nestjs/throttler` — repository: https://github.com/nestjs/throttler
- better-sqlite3-session-store — repository and licence: https://github.com/TimDaub/better-sqlite3-session-store
