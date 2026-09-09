---

description: "Implementation tasks: BE-02 — Authentication"
---

# Tasks: BE-02 — Authentication

**Input**: Design documents from `/specs/002-authentication/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/auth.md](./contracts/auth.md)

**Base**: branch `002-authentication`, worktree
`/Users/ammaralhasan/Documents/claude-worktree/tentwenty-test/authentication`, from `ad9f520`

## Tests

**None.** The repository owner deferred all backend automated testing until after BE-03, and BE-01's
test scaffolding was removed by that decision (`f49c4a5`, `a01164c`). Per spec FR-033, **no task
below creates a test file, installs a test framework, adds a mock or fixture, adds test
configuration, or adds a test script**, and none restores what BE-01 removed. Phase 8 is manual
verification plus the lint / type / build gates. T044 audits this.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency between them
- **[Story]**: the user story from [spec.md](./spec.md) the task serves
- Every task names the exact file it touches

## Path conventions

All paths are relative to the repository root. Backend only: `apps/api/`. **No task touches
`apps/web`** (spec FR-031).

---

## Phase 1: Setup — dependencies

**Purpose**: get the four packages in, and stop early if a peer conflict appears.

- [ ] **T001** Install runtime dependencies in `apps/api`:
      `pnpm --filter api add express-session@^1.19.0 @node-rs/argon2@^2.2.0 express-rate-limit@^8.7.0`.
      **Use no `--force` and no `--legacy-peer-deps`** (Constitution Principle VII, spec SC-010).
- [ ] **T002** Install the type package: `pnpm --filter api add -D @types/express-session@^1.19.0`.
- [ ] **T003** Record the actual installed versions and the full install output in the PR notes. If
      **any** peer-dependency warning or error appears, **stop and report it** rather than working
      around it — research § 3 predicts a clean install, and a conflict means a decision needs
      revisiting.
- [ ] **T004** Confirm `@node-rs/argon2` resolved to a **prebuilt** binary for this machine
      (`darwin-arm64` or `darwin-x64`) and did not invoke `node-gyp`. BE-01's README promises no
      compiler toolchain is needed; if it compiled, that promise needs correcting.

**Checkpoint**: dependencies installed cleanly, versions recorded.

---

## Phase 2: Foundational — configuration and schema

**⚠️ Blocking.** No endpoint work begins until this phase is complete.

- [ ] **T005** Extend the Zod schema in `apps/api/src/config.ts` with `SESSION_SECRET` (string, min 32)
      and `SESSION_TTL_HOURS` (`z.coerce.number().int().min(1).max(720).default(12)`), per
      [data-model.md](./data-model.md) § Configuration. Add nothing else, and **change no existing
      row** — `FRONTEND_ORIGIN`'s normalisation in particular stays exactly as it is.
- [ ] **T006** Add the conditional-default rule for `SESSION_SECRET` in `apps/api/src/config.ts`: the
      development default applies when `NODE_ENV !== 'production'`, and validation **fails** when
      `NODE_ENV === 'production'` and the value is absent or still the development default. One short
      comment explains why the default is conditional (Constitution Principle III).
- [ ] **T007** Document both settings in `apps/api/.env.example`, with the production caveat for
      `SESSION_SECRET` and a note on how to generate one (spec FR-029).
- [ ] **T008** [P] Create `apps/api/src/auth/session.d.ts` augmenting `express-session`'s
      `SessionData` with `userId: number`, so `req.session.userId` type-checks across the app.
- [ ] **T009** Create `apps/api/src/auth/auth.module.ts` with an `onModuleInit` that executes the
      `users` and `sessions` DDL from [data-model.md](./data-model.md) via `DatabaseService`, using
      `CREATE TABLE IF NOT EXISTS` plus the `idx_sessions_expires_at` index. The `email` column
      carries `UNIQUE COLLATE NOCASE` (spec FR-002). No migration framework,
      no migration table (research Decision 7).
- [ ] **T010** In the same `onModuleInit`, sweep expired sessions once:
      `DELETE FROM sessions WHERE expires_at <= ?` with `Date.now()`. No timer, no background job.
- [ ] **T011** **Verify the initialisation order assumption** flagged in
      [data-model.md](./data-model.md): confirm `DatabaseService` has an open connection by the time
      `AuthModule.onModuleInit` runs. Start the API against a deleted database file and confirm both
      tables are created without a "Database connection is not open" error. If the order does not
      hold, create the tables lazily on first use instead of reordering modules by hand — and record
      the change.
- [ ] **T012** 🚧 **Gate — verify `express-session` works on Express 5.2.1** (research Decision 1,
      open question 2). Temporarily wire `app.use(session({ secret, resave: false,
      saveUninitialized: false }))` with the default memory store in `apps/api/src/main.ts`, and
      confirm by hand that a `Set-Cookie` is issued, the session round-trips on a second request, and
      `regenerate()` and `destroy()` both work. **Do not build Phases 3–7 until this passes.** If it
      fails, stop and report — the fallback in research § 5 is a materially larger change that needs
      review, not a silent substitution.

**Checkpoint**: config validates, both tables exist, session middleware proven on Express 5.

---

## Phase 3: User Story 1 — Sign in and stay signed in (P1) 🎯 MVP

**Goal**: a correct email and password yield a session that survives a restart.

- [ ] **T013** [US1] Create `apps/api/src/auth/sqlite-session.store.ts`: an `express-session` `Store`
      subclass over `DatabaseService`, implementing `get`, `set`, `destroy`, `touch` only.
      **Do not** implement `all`, `length`, or `clear` — nothing needs them (Constitution
      Principle II). Write it at whatever length is clear; there is no line budget.

      The store contract is callback-based, and every method must honour it exactly
      ([official docs](https://expressjs.com/en/resources/middleware/session/)):

      - `get(sid, cb)` → `cb(error, session)`. **Not found is not an error**: call `cb(null, null)`.
        A row whose `expires_at` has passed counts as not found — delete it, then `cb(null, null)`.
      - `set(sid, session, cb)` → `cb(error)`. Upsert the row; derive `expires_at` from
        `session.cookie.expires` when present, else from `maxAge`, else the configured TTL.
      - `destroy(sid, cb)` → `cb(error)`. Deleting a row that does not exist is a success, not an
        error.
      - `touch(sid, session, cb)` → `cb(error)`. Move `expires_at` forward only; write no other
        column.

      `better-sqlite3` is synchronous and throws, so wrap each body in `try/catch` and pass the
      caught error to the callback — **never let it propagate out of the store**, which would escape
      the request's error path entirely. Never call a callback twice, and never call one
      synchronously *and* asynchronously on different paths. `JSON.parse` of a corrupt `data` column
      must be caught and treated as not-found rather than thrown.
- [ ] **T014** [US1] In `apps/api/src/main.ts`, replace T012's temporary wiring with the real
      `app.use(session({...}))`: `name: 'sid'`, the store from T013, `secret` and cookie `maxAge` from
      `ConfigService`, `resave: false`, `saveUninitialized: false`, `rolling: true`, and the cookie
      block from [plan.md](./plan.md) § Cookie. **Leave the existing `enableCors` block and the global
      pipe exactly as they are** (spec FR-024, FR-032).
- [ ] **T015** [US1] Add one short comment in `main.ts` recording why `secure` is conditional on
      `NODE_ENV` and why `SameSite=Lax` is correct across ports — both are non-obvious and both are
      the kind of thing a later reader would "fix" wrongly.
- [ ] **T016** [P] [US1] Create `apps/api/src/auth/auth.schema.ts`: the Zod login-body schema per
      [contracts/auth.md](./contracts/auth.md) — email trimmed, lowercased, valid, max 254; password
      min 1, **max 256**; unknown keys rejected.
- [ ] **T017** [US1] Create `apps/api/src/auth/auth.service.ts` with `findByEmail` (one `SELECT` on
      the `NOCASE` index) and `verifyCredentials`, using `argon2.verify` from `@node-rs/argon2` with
      its default parameters (spec FR-003). `password_hash` is read only inside this path and is never
      selected into a response (spec FR-004).
- [ ] **T018** [US1] In `auth.service.ts`, verify against a fixed dummy Argon2id hash when no user is
      found, so an unknown email and a wrong password take comparable time. One comment explains why
      the apparently pointless work is there.
- [ ] **T019** [US1] In `apps/api/src/auth/auth.module.ts`, seed the demo user in `onModuleInit` when
      `NODE_ENV !== 'production'` **and** `SELECT COUNT(*) FROM users` is 0: hash
      `demo-password-2026` with `argon2.hash` and insert `demo@tentwenty.local`
      ([data-model.md](./data-model.md) § Demo user). Log the **email only** — never the password.
- [ ] **T020** [US1] Create `apps/api/src/auth/auth.controller.ts` with `POST /auth/login`: validate,
      verify, regenerate the session, attach the user, save, and return `{ user: { id, email } }` —
      id and email only, never the hash and never the session identifier (spec FR-011).

      **`regenerate` and `save` are callback-based, not promise-returning**, and `regenerate`
      replaces the session object. Per the
      [official docs](https://expressjs.com/en/resources/middleware/session/), once `regenerate`
      completes "a new SID and `Session` instance will be initialized at `req.session`". Two
      consequences the implementation must respect:

      1. `await session.regenerate()` is wrong — it awaits `undefined` and continues before
         regeneration has finished. Wrap each call in a small promise, e.g.
         `await new Promise<void>((res, rej) => req.session.regenerate(err => err ? rej(err) : res()))`,
         and the same shape for `save`.
      2. Assign onto **`req.session`** *after* regeneration — not onto a `session` reference captured
         before it, and not onto an injected `@Session()` parameter bound to the old object. Writing
         `userId` onto the pre-regeneration session leaves the new session anonymous and the old one
         carrying the user: the login appears to succeed while `/auth/me` returns 401.

      Take the request via `@Req()` so `req.session` is re-read after regeneration. Let a rejected
      promise propagate — BE-01's filter turns it into the generic 500. A comment records why the
      regenerate-then-assign order matters, since the two statements look reorderable.
- [ ] **T021** [US1] Register `AuthModule` in `apps/api/src/app.module.ts`. Change nothing else in
      that file except T034's guard registration.
- [ ] **T022** [US1] Manually verify [quickstart.md](./quickstart.md) §§ 5 and 7 — successful login,
      cookie attributes, `sid` regenerated on re-login, and session survival across a restart.

**Checkpoint**: US1 is independently demonstrable — a reviewer can log in and stay logged in.

---

## Phase 4: User Story 2 — Refused cleanly when credentials are wrong (P1)

**Goal**: one indistinguishable refusal, and a bounded guessing rate.

- [ ] **T023** [US2] In `auth.controller.ts`, make both failure paths throw the **same**
      `UnauthorizedException('Invalid email or password')` from a single code path, so
      byte-identical responses hold by construction rather than by care (spec FR-008, SC-002).
- [ ] **T024** [US2] Confirm no `Set-Cookie` is emitted on a failed login — `saveUninitialized: false`
      should already ensure this; verify rather than assume.
- [ ] **T025** [US2] Add the login rate limiter using `express-rate-limit` in
      `apps/api/src/main.ts`, mounted on the login path only: `windowMs: 15 * 60 * 1000`,
      `limit: 10`, `standardHeaders: 'draft-7'`, `legacyHeaders: false`,
      `skipSuccessfulRequests: true` (research Decision 4). Apply it to **no other route**.
- [ ] **T026** [US2] Make the limiter's rejection use BE-01's error shape, so a 429 carries the same
      five fields as every other error (spec SC-008) — via its `handler` option throwing Nest's
      `HttpException` with status 429, rather than letting the library write its own body.
- [ ] **T027** [US2] Manually verify [quickstart.md](./quickstart.md) §§ 3, 4 and 12 — invalid input,
      the `diff` proving the two refusals are identical, oversized password rejected promptly, and the
      429 after ten failures.

**Checkpoint**: US2 independently demonstrable.

---

## Phase 5: User Story 3 — Protect an endpoint and sign out (P1)

**Goal**: the reusable guard, and a logout that invalidates server-side.

- [ ] **T028** [US3] Create `apps/api/src/auth/session-auth.guard.ts`: reads `req.session?.userId`,
      throws `UnauthorizedException` when absent, returns true otherwise. It attaches nothing to the
      request — handlers read `@Session()` themselves. This is the single reusable mechanism BE-03
      applies (spec FR-020, FR-021); its usage is documented in
      [contracts/auth.md](./contracts/auth.md) rather than demonstrated with a new endpoint.
- [ ] **T029** [US3] Add `GET /auth/me` to `auth.controller.ts` behind `@UseGuards(SessionAuthGuard)`,
      returning `{ user: { id, email } }` looked up from `session.userId`. **Add no other protected
      route** — no placeholder, no demo, no debug endpoint (spec FR-022).
- [ ] **T030** [US3] Add `POST /auth/logout` to `auth.controller.ts`: destroy the server-side session,
      clear the `sid` cookie, return **204**. `session.destroy(cb)` is callback-based like
      `regenerate` — wrap it in a promise the same way (T020), and clear the cookie with
      `res.clearCookie('sid', ...)` using the same `path`/`sameSite`/`secure` attributes it was set
      with, or the browser keeps it. It is **not** behind the guard, and returns 204 even with no
      session (spec FR-019) — a comment records why, because putting it behind the guard is the
      obvious-looking mistake.
- [ ] **T031** [US3] Confirm `GET /health` in `apps/api/src/app.controller.ts` is untouched and still
      public — the guard is applied per-route, never globally (spec FR-023).
- [ ] **T032** [US3] Manually verify [quickstart.md](./quickstart.md) §§ 6, 8 and 9 — `/auth/me` with
      and without a session, a tampered cookie, expiry, the **replayed captured cookie returning 401**
      after logout, and logout with no session returning 204.

**Checkpoint**: US3 independently demonstrable. The guard is ready for BE-03.

---

## Phase 6: User Story 5 — Cross-origin and request forgery (P2)

**Goal**: the frontend origin works; every other origin cannot act on a visitor's session.

- [ ] **T033** [US5] Create `apps/api/src/common/origin-check.guard.ts`: for `POST`/`PUT`/`PATCH`/
      `DELETE`, throw `ForbiddenException('Request origin is not allowed')` when an `Origin` header is
      present and is not exactly `FRONTEND_ORIGIN`. Safe methods pass. A **missing** `Origin` passes —
      with a comment recording that this is deliberate (browsers always send it cross-origin, and
      `curl` verification would otherwise be impossible). The rationale lives in
      [research.md](./research.md) Decision 5, which spec FR-026 requires be documented.
- [ ] **T034** [US5] Register it as a global `APP_GUARD` in `apps/api/src/app.module.ts`, ordered so
      it runs **before** `SessionAuthGuard`, so a forged request is refused as 403 without revealing
      whether the session was valid.
- [ ] **T035** [US5] Confirm the BE-01 `enableCors` block in `main.ts` is **unmodified** — same
      single-element array origin, same `credentials: true` (spec FR-024, FR-032).
- [ ] **T036** [US5] Manually verify [quickstart.md](./quickstart.md) § 10 — allowed origin with
      credentials, preflight, foreign origin receiving no `ACAO` header, foreign-origin `POST` refused
      with 403, a forged logout leaving the session intact, and `document.cookie` not exposing `sid`
      in the browser.

**Checkpoint**: US5 independently demonstrable.

---

## Phase 7: User Story 4 — Demo user setup (P2)

**Goal**: a reviewer with a clean checkout can sign in using only the documentation.

- [ ] **T037** [US4] Verify the seed is idempotent and production-inert, using the **verification**
      databases only — `DATABASE_PATH=./data/verify-be02.sqlite` and `./data/verify-prod.sqlite` per
      [quickstart.md](./quickstart.md) § Ground rules. **Never delete or modify
      `apps/api/data/margin.sqlite`**: it is the project's own database and no verification step may
      touch it. Reset the verification file, start, confirm one user; restart, confirm still one user
      with the same `id`; then start with `NODE_ENV=production` against the separate production probe
      file and confirm **no** user is created (spec FR-028). Confirm afterwards that no verification
      database is tracked or left in `git status`.
- [ ] **T038** [US4] Update `apps/api/README.md`: the demo credentials, the two new settings and the
      production caveat for `SESSION_SECRET`, the three endpoints, the session/cookie behaviour, and a
      note that schema changes require deleting the database file (there is no migration mechanism).
- [ ] **T039** [US4] Update the root `README.md` with the demo credentials and a one-line "sign in
      with these" pointer, so the five-minute path in spec SC-001 does not require opening
      `apps/api/README.md` first.
- [ ] **T040** [US4] Manually verify [quickstart.md](./quickstart.md) §§ 2 and 11 against the **verification** database
      (never `margin.sqlite`) — including reading `password_hash` directly and confirming it starts `$argon2id$`.

**Checkpoint**: all five user stories complete.

---

## Phase 8: Verification and polish

**No automated tests are added here or anywhere** (spec FR-033).

- [ ] **T041** Run `pnpm --filter api lint` — must exit 0. Report the real output.
- [ ] **T042** Run `cd apps/api && npx tsc --noEmit -p tsconfig.json` — must exit 0. Report the real
      output.
- [ ] **T043** Run `pnpm --filter api build` — must exit 0. Report the real output.
- [ ] **T044** **Testing-scope audit.** Run [quickstart.md](./quickstart.md) § 14 and confirm all
      three report "correct": no test file, no test dependency in `apps/api/package.json`, no test
      script. Also confirm `grep -rnE "@(Get|Post|Put|Patch|Delete)\(" apps/api/src/` returns exactly
      four routes — `health`, `login`, `me`, `logout` — proving no debug or test-only route was added.
- [ ] **T045** Run `git status --short apps/web` — must be empty (spec FR-031, SC-011). Also run
      `git status --short` at the worktree root and confirm no verification database, cookie jar, or
      other check artefact was left behind, and that `git ls-files apps/api/data/` lists nothing.
- [ ] **T046** Execute [quickstart.md](./quickstart.md) §§ 1–12 end to end in one sitting against a
      freshly deleted database, and record the **real** output of every check, including any that
      fails (Constitution Principle VIII).
- [ ] **T047** Comment audit: confirm every comment explains a non-obvious decision and that none
      restates what the code says (Constitution Principle III). There is **no** target count —
      comment where a reader would otherwise be misled, and nowhere else.
- [ ] **T048** Scope audit: confirm that none of registration, password reset, email verification,
      roles, permissions, OAuth, JWT/refresh tokens, remember-me, lockout, or MFA was implemented
      (spec FR-030), and that rate limiting is applied to the login route only.
- [ ] **T049** Structure audit: confirm `apps/api/src/auth/` holds exactly the seven files in
      [plan.md](./plan.md) § Source code, that no empty folder, barrel file, base class, or
      single-implementation interface was introduced, and that `scripts/`, `dto/`, `entities/`, and
      `constants/` do **not** exist (Constitution Principle II).
- [ ] **T050** Update [research.md](./research.md) § 5: mark open question 2 resolved with T012's real
      result, and record the reviewer's decision on open questions 1 and 3.

---

## Dependencies

```text
Phase 1 (T001–T004)
   ↓
Phase 2 (T005–T012)          ← T012 gates everything downstream
   ↓
Phase 3 US1 (T013–T022)      ← the MVP
   ↓
   ├─ Phase 4 US2 (T023–T027)
   ├─ Phase 5 US3 (T028–T032)
   └─ Phase 6 US5 (T033–T036)   ← these three are independent of each other
   ↓
Phase 7 US4 (T037–T040)
   ↓
Phase 8 (T041–T050)
```

- **T012 is a hard gate**: it validates the assumption the rest of the feature rests on.
- Phases 4, 5 and 6 all depend on Phase 3 (they need a real session to refuse or destroy) but not on
  one another. T016 and T008 are the only `[P]` tasks — everything else in Phase 3 converges on
  `auth.controller.ts`, `auth.module.ts` or `main.ts` and would collide.
- Phase 7's documentation tasks could start earlier, but T037 needs the seed from T019.

## MVP scope

**Phases 1–3 (T001–T022)** deliver a working login that persists across a restart. Phases 4–6 are
each independently deliverable increments on top of it; none of them is optional, because each carries
a P1 or P2 requirement, but each can be reviewed on its own.

## Definition of done

- All 50 tasks checked.
- T041–T043 exit 0, with their real output reported.
- Every check in [quickstart.md](./quickstart.md) §§ 1–14 executed, with real output recorded.
- `apps/web` untouched.
- No test file, framework, mock, fixture, test configuration, or test script anywhere in `apps/api`.
- Open questions in [research.md](./research.md) § 5 resolved or explicitly carried forward.
