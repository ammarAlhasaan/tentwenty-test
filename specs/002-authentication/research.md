# Phase 0 Research: BE-02 — Authentication

**Date**: 2026-09-09
**Spec**: [spec.md](./spec.md)

Every version, peer-dependency, and licence fact below was read from the npm registry or the
installed tree on 2026-09-09 and cross-checked against official documentation. Behaviour that was
observed by running code on this machine is labelled **Observed**. Anything not actually verified is
labelled **Unverified** and carries a verification task in [tasks.md](./tasks.md).

## 1. Installed baseline (verified)

Read from `node_modules/.pnpm/*/package.json`, `apps/api/package.json`, and the repository root:

| Package / tool | Installed | Source of the fact |
|---|---|---|
| `@nestjs/common` | 12.0.1 | `apps/api/node_modules/@nestjs/common/package.json` |
| `@nestjs/core` | 12.0.1 | same |
| `@nestjs/platform-express` | 12.0.1 | same |
| `express` | 5.2.1 | `node_modules/.pnpm/express@5.2.1/` (bundled by platform-express) |
| `cors` | 2.8.6 | `node_modules/.pnpm/cors@2.8.6/` |
| `better-sqlite3` | 13.0.3 | `node_modules/.pnpm/better-sqlite3@13.0.3/` |
| `zod` | 4.5.4 | `apps/api/node_modules/zod/package.json` |
| `typescript` | 6.0.3 | `apps/api/node_modules/typescript/package.json` |
| pnpm | 11.9.0 | root `packageManager` |
| Node (`.nvmrc`) | 24.21.0 | root `.nvmrc`; `engines.node` is `>=24.15.0` |
| Node (this machine) | 26.4.0 | `node -v` — **still mismatched with `.nvmrc`**, carried over from BE-01 |

`apps/api` is ESM (`"type": "module"`) on `nodenext` resolution, so every relative import in `src/`
carries an explicit `.js` extension. This constrains Decision 6.

## 2. BE-01 prerequisites (verified present)

BE-02 builds directly on five BE-01 pieces. All five were read in the merged tree at `ad9f520`:

| BE-01 piece | Location | Status |
|---|---|---|
| Centralised config with Zod `validationSchema` | `apps/api/src/config.ts` | Present — BE-02 extends this schema |
| SQLite `DatabaseService` (WAL, foreign keys, clean close) | `apps/api/src/database/database.service.ts` | Present — BE-02 reuses the connection directly |
| Application-wide `StandardSchemaValidationPipe` | `apps/api/src/main.ts` | Present — BE-02 declares Zod schemas against it |
| Global error filter, five-field body | `apps/api/src/common/http-exception.filter.ts` | Present — BE-02 adds no second filter |
| Credentialed CORS, single-element array origin | `apps/api/src/main.ts` | Present — BE-02 changes nothing here |

### FRONTEND_ORIGIN normalisation — present, not a blocker

The BE-01 review fix **is** in the merged tree. `apps/api/src/config.ts` reads:

```ts
FRONTEND_ORIGIN: z
  .url({ protocol: /^https?$/, ... })
  .transform((value) => new URL(value).origin)
  .default('http://localhost:3000'),
```

`.transform((value) => new URL(value).origin)` is the normalisation, and `main.ts` passes the result
as a single-element array so `cors@2.8.6` omits the header entirely for a non-matching origin. **No
BE-01 prerequisite is missing.** BE-02's Decision 5 depends on this exact-match behaviour.

## 3. Decisions

### Decision 1 — Session middleware: `express-session@1.19.0`

**Decision**: install `express-session@^1.19.0` and `@types/express-session@^1.19.0`, and apply it in
`main.ts` via `app.use(session({...}))`.

**Why**: it is what the official NestJS documentation prescribes for an Express-based Nest
application, verbatim: "npm i express-session", "npm i -D @types/express-session", applied as
`app.use(session({ secret, resave: false, saveUninitialized: false }))` in the bootstrap file, with
`request.session` available through `@Req()` or the `@Session()` decorator. Following the framework's
own documented path is Constitution Principle I.

**Compatibility evidence**:

- `express-session@1.19.0` declares **no `express` dependency and no `express` peer dependency** —
  its full dependency set is `cookie`, `cookie-signature`, `debug`, `depd`, `on-headers`, `parseurl`,
  `safe-buffer`, `uid-safe`. There is therefore **no peer-dependency conflict** with the installed
  `express@5.2.1`, and no `--legacy-peer-deps` is needed (Constitution Principle VII).
- `engines.node` is `>= 0.8.0`; Node 24.21/26.4 satisfy it.
- **Caveat, Unverified**: the upstream repository tests against `express@4.17.3`, not Express 5, and a
  PR bumping its dev dependency to Express 5.1.0 (#1053) was closed unmerged. There is no open issue
  reporting that express-session is broken on Express 5, and the middleware only touches `req`/`res`
  primitives that Express 5 preserves — but "no declared conflict and no reported breakage" is not
  the same as "verified working". **T012 in tasks.md is an explicit smoke check of set-cookie,
  round-trip, regenerate, and destroy on the installed Express 5.2.1 before any further auth work is
  built on it.** If it fails there, the fallback is recorded in § 5.

**Options used** (each justified in [plan.md](./plan.md)): `name: 'sid'`, `secret`, `resave: false`,
`saveUninitialized: false`, `rolling: true`, `store`, and a `cookie` block of `httpOnly`, `sameSite`,
`secure`, `maxAge`, `path`.

**Two API facts the implementation must not get wrong**, both from the official documentation:

- **`regenerate`, `save`, `destroy` and `reload` take callbacks and return nothing.** `await`-ing them
  awaits `undefined` and continues early. Each is wrapped in a promise at the call site (plan
  § Login). Only `touch()` is synchronous.
- **`regenerate` replaces the session object**: "a new SID and `Session` instance will be initialized
  at `req.session`". `userId` must be assigned to `req.session` read *after* the callback fires, never
  to a reference captured before it.
- **`cookie.maxAge` calculates `Expires`**, "taking the current server time and adding `maxAge`
  milliseconds" — it does not emit a literal `Max-Age` header. Verification greps for `Expires`.
- **`cookie.secure` over HTTP suppresses the cookie entirely** — with `secure` set and the site
  accessed over HTTP, the cookie is not set. This shapes what quickstart § 10 can observe locally.

**Sources**: <https://docs.nestjs.com/techniques/session> ·
<https://github.com/expressjs/session> · <https://github.com/expressjs/session/blob/master/package.json>

---

### Decision 2 — Session store: a small store over the existing `DatabaseService`

**Decision**: write `apps/api/src/auth/sqlite-session.store.ts`, implementing `get`, `set`,
`destroy` and `touch` against the `better-sqlite3` connection BE-01 already owns.

**Approved by the reviewer on 2026-09-10**, on the condition that callbacks, error propagation and
expiry are handled explicitly, and with **no line-count constraint** on the file. The requirements are
written out in task T013 and in [plan.md](./plan.md) § Session store.

**This is the one decision in BE-02 that adds code instead of a dependency, and it needs its
justification stated plainly**: it is not to avoid a dependency. Both maintained candidates were
evaluated and both were rejected on grounds that have nothing to do with dependency count.

| Candidate | Version / last publish | Downloads/mo | Verdict |
|---|---|---|---|
| `connect-sqlite3` | 0.9.18, 2026-08-06 (maintained) | 89,390 | **Rejected — wrong driver** |
| `better-sqlite3-session-store` | 0.1.0, **2022-06-25** | 42,491 | **Rejected — licence** |
| `connect-better-sqlite3` | 0.1.8, 2022-04-27 | negligible | **Rejected — requires `better-sqlite3@^7`**, we run 13.0.3 |
| Small store over `DatabaseService` | — | — | **Selected** |

**Why `connect-sqlite3` was rejected**: its `optionalDependencies` are `{ "sqlite3": "^5.0.0" }` and
its devDependencies confirm `sqlite3@^5.1.7` — it drives the **`sqlite3`** package, not
`better-sqlite3`. Adopting it means a *second* native SQLite driver in the tree, a second connection
with different concurrency semantics against the same file (or, in its default configuration, a
*separate* `sessions.db` file), and a second native install path that BE-01's README explicitly
promises is unnecessary ("No compiler toolchain is needed"). That is more complexity than the ~50
lines it would replace, not less — the opposite of what Constitution Principle VII asks a dependency
to do.

**Why `better-sqlite3-session-store` was rejected**: it is published under **`GPL-3.0-only`**. This
repository is a take-home submission that its author needs to hand over freely; linking a
copyleft-licensed module into the server is a licensing decision far larger than the code it saves,
and it is not one to make silently on the owner's behalf. Independently of the licence it has not
been published since **June 2022**, and it pins `date-fns@2.16.1` exactly — an odd, four-year-stale
transitive dependency for what is date arithmetic on an expiry column.

**Why the store is a bounded piece of work**: the `express-session` store contract is fixed and
narrow. Per the official documentation, only `get(sid, cb)`, `set(sid, session, cb)` and
`destroy(sid, cb)` are **required**; `touch(sid, session, cb)` is *recommended* (and needed because
Decision 1 sets `rolling: true`); `all`, `length` and `clear` are **optional** and BE-02 implements
none of them, because nothing in the spec enumerates or counts sessions. Four callback-based methods
over `db.prepare(...).get/run` is not an abstraction layer — it is the adapter the contract asks for.

The contract is callback-based, and the details that must not be improvised:

- `get(sid, cb)` calls back `(error, session)`. A missing session is **not** an error — it is
  `cb(null, null)`. An expired row is treated the same way, after being deleted.
- `set` / `destroy` / `touch` call back with an error argument only.
- `better-sqlite3` is synchronous and throws. Every method body catches and forwards the error to its
  callback instead of letting it escape the store, which would bypass the request's error path.
- Destroying a row that is already gone is a success. A `data` column that fails to parse is treated
  as not-found rather than thrown.

**Source**: <https://expressjs.com/en/resources/middleware/session/>

**Sources**: <https://github.com/expressjs/session#session-store-implementation> ·
<https://github.com/rawberg/connect-sqlite3/blob/master/package.json> ·
`npm view better-sqlite3-session-store license` → `GPL-3.0-only`

---

### Decision 3 — Password hashing: `@node-rs/argon2@^2.2.0`

**Decision**: install `@node-rs/argon2` and use `hash(password)` / `verify(hash, password)`.

**Why not the Node built-in**: Node **does** ship Argon2 now, and it is not experimental —
`crypto.argon2` / `crypto.argon2Sync` are **Added in: v24.8.0** with **Stability: 2 - Stable**, which
both the `.nvmrc` pin (24.21.0) and `engines.node` (`>=24.15.0`) satisfy. It was the first candidate
precisely because it would cost zero dependencies. It was rejected after reading its actual surface:

**Observed** (run on Node 26.4.0 on this machine):

```
c.argon2Sync('argon2id', { message, nonce, passes, memory, parallelism, tagLength })
  accepted message+nonce  -> [object Uint8Array]
  rejected password+salt  -> ERR_INVALID_ARG_TYPE
  raw=false               -> [object Uint8Array]   (no PHC string mode)
  verify helpers present  -> none
```

So the built-in is a raw KDF: it returns a bare 32-byte tag and offers **no PHC-encoded output and no
`verify()`**. Using it means hand-writing salt generation, a storage encoding for the algorithm and
its `m`/`t`/`p` parameters, a parser for that encoding, and a `timingSafeEqual` comparison — writing
password-storage plumbing by hand, which is exactly the "meaningful complexity" Constitution
Principle VII says a dependency should remove. (Note: the published Node documentation page describes
a `password`/`salt`/`raw` signature that the runtime rejects; the observed behaviour above is
authoritative for the installed runtime, and this discrepancy is itself a reason not to build on it.)

**Why `@node-rs/argon2` and not `argon2`**:

| | `@node-rs/argon2@2.2.0` | `argon2@0.45.1` |
|---|---|---|
| Last publish | 2026-08-29 | 2026-07-21 |
| Downloads/mo | 4,304,612 | — |
| Install | **Prebuilt N-API binaries**, "No node-gyp and postinstall" | `node-gyp-build` + `node-addon-api` |
| macOS | `darwin-arm64` and `darwin-x64` in `optionalDependencies` | compiles if no prebuild matches |

`@node-rs/argon2` keeps BE-01's promise that no compiler toolchain is needed. Its API is
`hash(password, options?) => Promise<string>` returning a **PHC-encoded string** (algorithm,
version, parameters and salt all inside the one column) and `verify(hashed, password) =>
Promise<boolean>`; **Argon2id is the default variant**, with defaults `memoryCost: 19456` KiB,
`timeCost: 2`, `parallelism: 1`, `outputLen: 32`. Those defaults are used as-is: they match the OWASP
Argon2id baseline, and BE-02 has no requirement that argues for different ones.

`engines.node` is `>= 10`. No peer dependencies, so no conflict.

**Sources**: <https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback>
· <https://github.com/napi-rs/node-rs/tree/main/packages/argon2>

---

### Decision 4 — Login rate limiting: `express-rate-limit@^8.7.0`

**Decision**: install `express-rate-limit` and apply one limiter to the login route only.

**`@nestjs/throttler` cannot be used — this is a hard compatibility finding, not a preference.**
The obvious first choice was the first-party Nest package. Its latest release, `6.5.0`, declares:

```
peerDependencies: {
  "@nestjs/common": "^7.0.0 || ^8.0.0 || ^9.0.0 || ^10.0.0 || ^11.0.0",
  "@nestjs/core":   "^7.0.0 || ^8.0.0 || ^9.0.0 || ^10.0.0 || ^11.0.0"
}
```

The installed Nest is **12.0.1**, which falls outside that range. The full published version list ends
at `6.5.0` (`dist-tags: { latest: "6.5.0" }`); there is **no `7.0.0` and no prerelease** — both
`@nestjs/throttler@7.0.0` and `@nestjs/throttler@7.0.0-beta.0` return npm **E404**. Installing it
would require `--legacy-peer-deps`, which Constitution Principle VII forbids outright. Recorded, and
an alternative proposed, exactly as that principle requires.

**Why `express-rate-limit@8.7.0`**: `peerDependencies: { "express": ">= 4.11" }` — satisfied by the
installed `express@5.2.1`. Last published 2026-08-29, 220,510,771 downloads/month, two small runtime
dependencies (`debug`, `ip-address`). `engines.node` is `>= 16`.

**Configuration**: `windowMs: 15 * 60 * 1000`, `limit: 10`, `standardHeaders: 'draft-7'`,
`legacyHeaders: false`, `skipSuccessfulRequests: true` — so a person typing their own password wrong
a few times is not locked out by their own successful login, while a guessing loop is. The default
key generator is IP-based via the `ipKeyGenerator` helper, which applies IPv6 subnet masking; it is
used unchanged.

**Accepted limitation**: the default store is in-memory and **does not survive a process restart**.
For a single-process local app whose threat model is a guessing loop inside one window, that is
adequate; it is documented rather than engineered around. No Redis, and no persistent limiter store.

**Sources**: <https://express-rate-limit.mintlify.app/reference/configuration> ·
`npm view @nestjs/throttler peerDependencies dist-tags versions`

---

### Decision 5 — CSRF: strict `Origin` verification plus `SameSite=Lax`. No dependency.

**Decision**: add a small guard that, for unsafe methods (`POST`/`PUT`/`PATCH`/`DELETE`), refuses the
request with 403 when an `Origin` header is present and is not exactly the configured
`FRONTEND_ORIGIN`. Combine it with a `SameSite=Lax` session cookie. Add no CSRF library and no token
endpoint, and require no change to `apps/web`.

**Why this is sufficient here, per OWASP**: the cheat sheet endorses "Verifying Origin With Standard
Headers" and "Custom Request Headers" for exactly this shape of application — a JSON API consumed by
AJAX — on the condition that CORS is configured with a strict allowlist rather than a wildcard. BE-01
already satisfies that condition: one configured origin, passed as a single-element array so a
non-matching origin receives no `Access-Control-Allow-Origin` header at all. `Origin` is a forbidden
header name, so page JavaScript cannot forge it.

The two defences cover different halves:

- A cross-site page's `POST` is **not sent the cookie at all**, because `SameSite=Lax` restricts
  cookies on cross-site unsafe methods.
- Any cross-origin request that *does* declare an origin is compared against the allowlist and
  refused with 403 before reaching a handler.

**Why the localhost port difference does not break it**: `localhost:3000` → `localhost:4000` is
cross-**origin** but same-**site** (SameSite is scoped to the registrable domain and ignores port).
`SameSite=Lax` therefore does **not** block the real frontend's login `POST`, while still blocking a
genuinely cross-site attacker. This is the specific fact that makes `Lax` workable here instead of
`None`, which would have required `Secure` and thus HTTPS locally.

**Why not a token library**: OWASP prefers the synchronizer token pattern for stateful apps, and
`csrf-csrf@4.0.3` is the maintained option — but it implements the **stateless** double-submit cookie
pattern, which is the pattern OWASP flags as bypassable in its naive form and which solves a problem
this app does not have. It would also add a token-issuing endpoint and require the frontend to fetch
and echo a token — a change to `apps/web`, which Constitution Principle V forbids in a backend spec,
for no gain over the allowlist that is already enforced.

**Accepted limitations, recorded rather than hidden**: the check trusts the browser to send `Origin`,
and deliberately allows requests that carry no `Origin` at all — `curl`, and the manual verification
in [quickstart.md](./quickstart.md), would otherwise be impossible. CSRF is a browser-driven attack
and a browser always sends `Origin` on a cross-origin request, so this does not weaken the defence
against the actual threat. If the app is ever deployed across two real domains, revisit: `SameSite`
must become `None; Secure`, and the `Origin` check becomes the sole barrier.

**Source**: <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>

---

### Decision 6 — Demo user: seeded at startup, not by a script

**Decision**: `AuthModule.onModuleInit` creates the demo user when `NODE_ENV !== 'production'` **and**
the `users` table is empty, then logs the email once. No `scripts/` directory, no seed file, no new
package script.

**Why not a `create-user.ts` script**, which was the first design: Node's built-in TypeScript type
stripping is **Stability 2 - Stable and enabled by default since v23.6.0**, so `node scripts/create-user.ts`
runs without a flag — but it will not reach the application's own config module.

**Observed** on this machine:

```
--- .js specifier ---   import { answer } from '../src/config.js'  ->  ERR_MODULE_NOT_FOUND
--- .ts specifier ---   import { answer } from '../src/config.ts'  ->  via .ts specifier -> 42
```

Node's type stripping does **not** map a `.js` specifier onto a sibling `.ts` file, while the
application's `nodenext` build requires `.js` specifiers throughout `src/`. A standalone script must
therefore either import `../src/config.ts` (which the `tsc` gate then rejects without
`allowImportingTsExtensions`) or re-implement the database path resolution — duplicating configuration
and violating BE-01's FR-001. The remaining option, `nest build && node dist/...`, makes the documented
setup a two-step build before a reviewer can log in.

Seeding in `onModuleInit` avoids all three: it runs inside the application, uses the real
`DatabaseService` and the real config, needs no script, and satisfies the brief's request for sample
data that is loadable without a separate step. Idempotence is the "table is empty" condition
(FR-028); the production guard is the `NODE_ENV` condition.

**Trade-off, stated for review**: a fixed, documented credential pair is compiled into the
application. It is inert in production by the `NODE_ENV` guard, and the credentials are published in
the README because they are a local convenience rather than a secret (spec Assumptions). This is the
decision in BE-02 most worth a reviewer's disagreement — see § 5.

**Source**: <https://nodejs.org/docs/latest-v24.x/api/typescript.html>

---

### Decision 7 — Schema creation: `CREATE TABLE IF NOT EXISTS` at module init

**Decision**: `AuthModule.onModuleInit` executes the `users` and `sessions` DDL with
`CREATE TABLE IF NOT EXISTS`. No migration framework, no migration table, no CLI.

**Why**: BE-01's `data-model.md` explicitly deferred this choice to "the first spec that creates a
table … with one real table as evidence rather than zero". That spec is this one, and the evidence is
two tables that never change shape within the assessment's scope. A migration framework (`umzug`,
`node-pg-migrate`, Prisma) would add a dependency, a directory, a state table and a command to a
project that has no deployed database to evolve — Constitution Principle II. The pattern is recorded
here so BE-03 follows it rather than inventing a second one.

**Accepted limitation**: `CREATE TABLE IF NOT EXISTS` creates but never alters. A column change during
the assessment means deleting `apps/api/data/margin.sqlite` and restarting — acceptable for a local
app whose data is re-uploaded from spreadsheets, and documented in the README.

## 4. Rejected alternatives, in one place

| Rejected | Reason |
|---|---|
| `@nestjs/throttler` | No release supports `@nestjs/common@12`; latest is 6.5.0, peers cap at `^11`, no v7 exists. Needs `--legacy-peer-deps` — forbidden |
| `connect-sqlite3` | Drives `sqlite3`, not `better-sqlite3`: a second native driver and a second database file |
| `better-sqlite3-session-store` | `GPL-3.0-only`; also unpublished since 2022-06 and pins `date-fns@2.16.1` |
| `connect-better-sqlite3` | Requires `better-sqlite3@^7`; installed is 13.0.3 |
| `node:crypto.argon2` | Stable since v24.8.0, but raw-buffer only — no PHC encoding, no `verify()`. Would mean hand-written salt/parameter encoding |
| `argon2` (node-argon2) | Compiles via `node-gyp-build`; `@node-rs/argon2` ships prebuilt binaries and keeps "no compiler toolchain needed" true |
| `csrf-csrf` | Stateless double-submit; solves a problem this stateful app does not have, and would require changing `apps/web` |
| Passport / `@nestjs/passport` + `passport-local` | Three packages, a strategy class and a serializer to express one `SELECT` and one `verify()`. A large auth framework that makes this project bigger, not simpler |
| Better Auth / Lucia / Auth.js | Own their schema, migrations and often their own database access; they would displace BE-01's `DatabaseService` rather than reuse it |
| JWT / `@nestjs/jwt` | The spec requires server-side sessions that can be invalidated at logout (FR-017, FR-018). A stateless token cannot be invalidated without adding the session store back |
| A migration framework | No deployed database to evolve; two tables that do not change |

## 5. Open questions — resolved at review, 2026-09-10

1. **Demo user seeded at first local start** (Decision 6) — **approved.** Seeding on first run against
   an empty database, gated on `NODE_ENV !== 'production'`, is the mechanism. The rejected fallback
   (a `"demo:user"` package script needing a build first) is recorded in Decision 6 and is not
   pursued.
2. **Session lifetime `SESSION_TTL_HOURS=12` with `rolling: true`** — **approved** as the default for
   this project.
3. **Custom session store** (Decision 2) — **approved**, conditional on explicit callback, error and
   expiry handling, and with **no line-count constraint**. Both conditions are now written into
   Decision 2 and task T013.

### Still open — one implementation risk

**`express-session` on Express 5 is unverified upstream** (Decision 1). No peer conflict is declared
and no breakage is reported, but the maintainers test against Express 4.17.3 and closed an Express 5
bump unmerged. **T012 gates all later work on a real smoke check.** If it fails, the fallback — a
signed-cookie session middleware over the same store — is a materially larger change and comes back
for review rather than being written silently.

## 6. Testing posture

No automated tests are researched, selected, or planned. The repository owner deferred all backend
automated testing until after BE-03, and BE-01's test scaffolding was removed by that decision
(`f49c4a5`, `a01164c`). BE-02 adds **no** test framework, test file, mock, fixture, test
configuration, or test script (spec FR-033).

Verification for BE-02 is:

1. `pnpm --filter api lint` (oxlint) — exit 0
2. `npx tsc --noEmit -p tsconfig.json` in `apps/api` — exit 0
3. `pnpm --filter api build` — exit 0
4. The manual HTTP and browser checks in [quickstart.md](./quickstart.md)

No permanent test or debug route is added to make any of these possible.
