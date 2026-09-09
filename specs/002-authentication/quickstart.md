# Quickstart & Verification: BE-02 — Authentication

**Date**: 2026-09-09 | **Plan**: [plan.md](./plan.md)

Runnable checks that prove BE-02 meets its acceptance criteria. Everything here is a command a
reviewer can execute; nothing here is implementation code. Run these **after** implementation — they
are the source for `tasks.md` Phase 8, and their real output is what gets reported (Constitution
Principle VIII).

> **This backend has no automated test suite.** The repository owner deferred all backend automated
> testing until after BE-03, and BE-01's test scaffolding was removed by that decision. Every check
> below is therefore manual, and § 12 lists the only automated gates that exist. Because nothing here
> runs by itself, §§ 4–10 must be re-run by hand after any change to `auth/`, `config.ts`, or
> `main.ts`.

## Ground rules for these checks

Three rules make the checks safe and independent. They are not optional.

1. **A dedicated verification database.** Every check runs the API against
   `apps/api/data/verify-be02.sqlite`, passed through `DATABASE_PATH`. **No check reads, writes, or
   deletes `margin.sqlite`**, and no check touches any database outside this worktree. The
   verification file is covered by the existing `apps/api/data/*.sqlite` ignore rule, so it never
   shows up in `git status`.
2. **Absolute paths only.** Every block that changes directory uses `$WT`. No block leaves the shell
   somewhere a later block does not expect — a `cd /tmp` followed by a relative `cd apps/api` would
   silently target the wrong tree.
3. **A fresh session per scenario.** Any check that needs a signed-in client logs in for itself into
   its own cookie jar. No check reuses a session that an earlier check expired, destroyed, or left in
   an unknown state.

## Prerequisites

- Node **24.21.0** (the `.nvmrc` pin): `nvm use`
- pnpm 11.9.0: `corepack enable`
- No cloud account, API key, or paid service.

Two shells are useful: one running the API, one running the checks. **Run the exports below in
both.**

```bash
export WT=/Users/ammaralhasan/Documents/claude-worktree/tentwenty-test/authentication
export DB="$WT/apps/api/data/verify-be02.sqlite"
export JARS="${TMPDIR:-/tmp}/be02-verify"
mkdir -p "$JARS" && echo "WT=$WT" && echo "DB=$DB" && echo "JARS=$JARS"
```

`$JARS` holds only `curl` cookie jars — never project data.

## Setup

```bash
cd "$WT" && nvm use && pnpm install
```

`pnpm install` must complete with **no** `--force`, **no** `--legacy-peer-deps`, and no
peer-dependency error (spec SC-010). Watch for `node-gyp` output — `@node-rs/argon2` ships prebuilt
binaries and should download, not compile.

```bash
cd "$WT" && cp apps/api/.env.example apps/api/.env
```

No edits needed: `SESSION_SECRET` has a development default and `SESSION_TTL_HOURS` defaults to 12.

Start from an empty **verification** database, so the demo user is seeded (§ 2):

```bash
rm -f "$DB" "$DB-wal" "$DB-shm" && echo "verification database reset"
```

This is the only `rm` in this document, and it names `$DB` explicitly. **Never**
`rm apps/api/data/margin.sqlite*` — that is the project's own database.

### Starting the API

Every start in this guide uses this command, in the API shell. Where a check needs different
settings, it says so and gives the full command.

```bash
cd "$WT/apps/api" && DATABASE_PATH=./data/verify-be02.sqlite pnpm dev
```

"Restart the API" below always means: `Ctrl+C` in that shell, then run this command again.

### Reading the verification database

Several checks inspect the database directly. They all take this form — absolute `$DB`, run from
`$WT/apps/api` so `better-sqlite3` resolves:

```bash
cd "$WT/apps/api" && node -e "const D=require('better-sqlite3');const db=new D(process.env.DB);console.log(db.prepare('SELECT COUNT(*) AS n FROM users').get());db.close()"
```

## 1. Health is still public (spec FR-023, SC-009)

```bash
curl -i http://localhost:4000/health
```

Expected: `200`, body `{"status":"ok"}`, with no session and no cookie.

## 2. The demo user exists (spec US4, FR-027)

Read the startup log from the API shell.

Expected: one line naming the seeded demo email, printed only on the first start against an empty
database. **The password must not appear in the log** — it is in `apps/api/README.md`.

Confirm the password was stored hashed, not in plaintext (spec US4 scenario 3):

```bash
cd "$WT/apps/api" && node -e "const D=require('better-sqlite3');const db=new D(process.env.DB);console.log(db.prepare('SELECT id,email,substr(password_hash,1,30) AS hash_prefix FROM users').all());db.close()"
```

Expected: one row, `hash_prefix` beginning `$argon2id$v=19$m=19456`. If the plaintext password appears
anywhere in that column, stop — FR-001 is violated.

Restart the API and re-run this check: still exactly one row, same `id` (spec US4 scenario 2 —
idempotence).

## 3. Login rejects invalid input (spec FR-006, US2 scenario 4)

```bash
curl -i -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"not-an-email","password":"x"}'
```

```bash
curl -i -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local"}'
```

Expected for both: `400`, a body carrying all five BE-01 error fields, and `message` naming the
offending field. No `Set-Cookie`.

Oversized password is rejected before it reaches the hasher (spec Edge Cases):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"demo@tentwenty.local\",\"password\":\"$(head -c 5000 /dev/zero | tr '\0' 'a')\"}"
```

Expected: `400`, returned promptly — not a multi-second pause, which would mean Argon2id ran.

## 4. Failed login is generic and identical (spec FR-008, SC-002)

Wrong password for a real user, then a password for an unknown user:

```bash
curl -s -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"wrong-password"}' > "$JARS/a.json"; cat "$JARS/a.json"
```

```bash
curl -s -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"nobody@tentwenty.local","password":"wrong-password"}' > "$JARS/b.json"; cat "$JARS/b.json"
```

Both must be `401` with `"message":["Invalid email or password"]`. Now prove they differ only in the
timestamp:

```bash
diff <(sed 's/"timestamp":"[^"]*"/"timestamp":"X"/' "$JARS/a.json") <(sed 's/"timestamp":"[^"]*"/"timestamp":"X"/' "$JARS/b.json") && echo "IDENTICAL"
```

Expected: `IDENTICAL`. Any difference — a distinct message, a different field — leaks which accounts
exist and fails SC-002.

Confirm neither set a cookie (spec US2 scenario 3):

```bash
curl -si -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"wrong-password"}' | grep -i '^set-cookie' || echo "no cookie set — correct"
```

## 5. Successful login (spec US1, FR-007, SC-003)

Fresh jar for this check:

```bash
rm -f "$JARS/login.txt" && curl -si -c "$JARS/login.txt" -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}'
```

Expected: `200`, body exactly `{"user":{"id":1,"email":"demo@tentwenty.local"}}`. The body must
contain **no** `password_hash`, no `sid`, and no secret (SC-003).

### Cookie attributes (spec FR-014, SC-007)

```bash
curl -si -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' | grep -i '^set-cookie'
```

Expected in development: `sid=`, `Path=/`, `HttpOnly`, `SameSite=Lax`, an **`Expires=`** attribute
roughly 12 hours in the future, and **no** `Secure` — local sign-in is over plain HTTP.

> **Expect `Expires`, not `Max-Age`.** `express-session`'s `cookie.maxAge` is documented as the number
> of milliseconds used *to calculate the `Expires` attribute* — "taking the current server time and
> adding `maxAge` milliseconds" — not as a literal `Max-Age` header. A check that greps for
> `Max-Age=43200` fails against a correct implementation.

### Session is regenerated on login (spec FR-009, SC-006)

Log in twice with the same jar and compare the identifiers:

```bash
rm -f "$JARS/regen.txt" \
 && curl -s -c "$JARS/regen.txt" -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null \
 && SID1=$(awk '/sid/{print $7}' "$JARS/regen.txt") \
 && curl -s -b "$JARS/regen.txt" -c "$JARS/regen.txt" -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null \
 && SID2=$(awk '/sid/{print $7}' "$JARS/regen.txt") \
 && [ "$SID1" != "$SID2" ] && echo "PASS: sid regenerated" || echo "FAIL: sid reused"
```

Expected: `PASS: sid regenerated`. A reused identifier means `regenerate()` was skipped, or that
`userId` was written onto the pre-regeneration session object — either way session fixation is
possible.

Confirm the old row is gone, not merely orphaned:

```bash
cd "$WT/apps/api" && node -e "const D=require('better-sqlite3');const db=new D(process.env.DB);console.log('session rows:',db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n);db.close()"
```

Expected: `1` — `regenerate()` destroyed the previous session before creating the new one.

## 6. Authenticated and unauthenticated /auth/me (spec FR-016, FR-021)

Fresh session for this check:

```bash
rm -f "$JARS/me.txt" && curl -s -c "$JARS/me.txt" -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null && echo "logged in"
```

With the session:

```bash
curl -i -b "$JARS/me.txt" http://localhost:4000/auth/me
```

Expected: `200`, `{"user":{"id":1,"email":"demo@tentwenty.local"}}`.

Without one:

```bash
curl -i http://localhost:4000/auth/me
```

Expected: `401` in the BE-01 error shape.

With a tampered cookie (spec FR-015, US3 scenario 2):

```bash
curl -i -H 'Cookie: sid=s%3Atampered-value-that-was-never-issued' http://localhost:4000/auth/me
```

Expected: `401`. The signature check rejects it before any database lookup.

## 7. Sessions survive an API restart (spec FR-012, SC-004)

Uses the `$JARS/me.txt` session from § 6, which is still valid. Restart the API, then:

```bash
curl -i -b "$JARS/me.txt" http://localhost:4000/auth/me
```

Expected: still `200`, same user, **no re-login**. This is the check that proves the session lives in
SQLite rather than in process memory. If it returns 401, the store is not being used.

## 8. Session expiry (spec FR-013, US3 scenario 6)

`SESSION_TTL_HOURS` has a floor of 1 hour, so rather than waiting, this check ages the row directly in
the **verification** database and confirms the API honours it.

Fresh session, kept separate from every other check because this one destroys it:

```bash
rm -f "$JARS/exp.txt" \
 && curl -s -c "$JARS/exp.txt" -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null \
 && curl -s -o /dev/null -w 'before expiry: %{http_code}\n' -b "$JARS/exp.txt" http://localhost:4000/auth/me
```

Age **only this session's row**, identified by the `sid` in its own jar — not every row in the table:

```bash
cd "$WT/apps/api" && SID=$(awk '/sid/{print $7}' "$JARS/exp.txt") node -e "
const D=require('better-sqlite3');
const db=new D(process.env.DB);
// The cookie value is 's:<sid>.<signature>', URL-encoded; the stored key is the bare sid.
const raw=decodeURIComponent(process.env.SID).replace(/^s:/,'').split('.')[0];
console.log('rows aged:', db.prepare('UPDATE sessions SET expires_at = 1 WHERE sid = ?').run(raw).changes);
db.close();
"
```

Expected: `rows aged: 1`. If it reports `0`, the `sid` extraction is wrong — check it before
concluding anything about expiry.

```bash
curl -s -o /dev/null -w 'after expiry:  %{http_code}\n' -b "$JARS/exp.txt" http://localhost:4000/auth/me
```

Expected: `before expiry: 200`, then `after expiry: 401`.

Confirm the expired row was removed rather than left to accumulate (spec FR-013):

```bash
cd "$WT/apps/api" && node -e "const D=require('better-sqlite3');const db=new D(process.env.DB);console.log('expired rows remaining:',db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at <= ?').get(Date.now()).n);db.close()"
```

Expected: `0`.

## 9. Logout invalidates the session server-side (spec FR-017, FR-018, SC-005)

Fresh session, and **capture the raw cookie value before logging out** — this is the point of the
check; clearing the browser's copy proves nothing.

```bash
rm -f "$JARS/out.txt" \
 && curl -s -c "$JARS/out.txt" -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null \
 && CAPTURED=$(awk '/sid/{print $7}' "$JARS/out.txt") && echo "captured: ${CAPTURED:0:12}..."
```

```bash
CAPTURED=$(awk '/sid/{print $7}' "$JARS/out.txt") \
 && curl -si -b "$JARS/out.txt" -X POST http://localhost:4000/auth/logout -H 'Origin: http://localhost:3000' | head -1 \
 && curl -s -o /dev/null -w 'replayed captured sid: %{http_code}\n' -H "Cookie: sid=$CAPTURED" http://localhost:4000/auth/me
```

Expected: `HTTP/1.1 204 No Content`, then `replayed captured sid: 401`.

A `200` on the replay means logout only cleared the browser's cookie and left a valid server-side
session behind — the exact defect US3 exists to prevent.

Logout is safe with no session (spec FR-019, US3 scenario 5):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/auth/logout -H 'Origin: http://localhost:3000'
```

Expected: `204`, not `401`.

Confirm the row is gone from storage:

```bash
cd "$WT/apps/api" && node -e "const D=require('better-sqlite3');const db=new D(process.env.DB);console.log('sessions:',db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n);db.close()"
```

## 10. Cookie, CORS, and CSRF behaviour (spec US5, FR-024, FR-025, SC-009)

### CORS — the configured origin is allowed, with credentials

```bash
curl -i -H 'Origin: http://localhost:3000' -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' | grep -i '^access-control'
```

Expected: `access-control-allow-origin: http://localhost:3000` **and**
`access-control-allow-credentials: true`.

### CORS — preflight for the login request

```bash
curl -i -X OPTIONS http://localhost:4000/auth/login -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type'
```

Expected: `204` with the allow headers present.

### CORS — a foreign origin gets no allow header

```bash
curl -i -H 'Origin: http://evil.example' http://localhost:4000/health | grep -i '^access-control-allow-origin' || echo "no ACAO header — correct"
```

Expected: `no ACAO header — correct`. (If the configured origin comes back instead, the CORS `origin`
option was passed as a bare string rather than a single-element array — fix the configuration, not
this expectation. See BE-01 quickstart § 4.)

### CSRF — a state-changing request from a foreign origin is refused

```bash
curl -i -X POST http://localhost:4000/auth/login -H 'Origin: http://evil.example' -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}'
```

Expected: `403` with `"message":["Request origin is not allowed"]`, and **no** `Set-Cookie`. The
refusal must happen whether the credentials were right or wrong.

Now the forged-logout case. It needs a **fresh, valid** session — §§ 8 and 9 both ended theirs, so
reusing one of those would prove nothing:

```bash
rm -f "$JARS/csrf.txt" \
 && curl -s -c "$JARS/csrf.txt" -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null \
 && curl -s -o /dev/null -w 'baseline (must be 200): %{http_code}\n' -b "$JARS/csrf.txt" http://localhost:4000/auth/me
```

```bash
curl -s -o /dev/null -w 'forged logout: %{http_code}\n' -b "$JARS/csrf.txt" -X POST http://localhost:4000/auth/logout -H 'Origin: http://evil.example' \
 && curl -s -o /dev/null -w 'session still valid: %{http_code}\n' -b "$JARS/csrf.txt" http://localhost:4000/auth/me
```

Expected: `baseline (must be 200): 200`, then `forged logout: 403`, then
`session still valid: 200` — the forged logout changed nothing.

### CSRF — a safe method from a foreign origin is not blocked by the guard

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: http://evil.example' http://localhost:4000/health
```

Expected: `200`. `GET` changes no state; the browser's own CORS enforcement (no allow header, above)
is what stops a foreign page from *reading* the response.

### Browser check — the cookie is not reachable from script (spec FR-014)

With the frontend running (`pnpm dev`), open `http://localhost:3000`, then in the browser console:

```js
document.cookie
```

Expected: the `sid` cookie does **not** appear — `HttpOnly` hides it. Confirm it exists in DevTools →
Application → Cookies → `http://localhost:4000`, with `HttpOnly` ✓ and `SameSite=Lax`.

### Production behaviour (spec SC-007) — what is verifiable here, and what is deferred

Two production properties, and only one of them can be observed over HTTP.

**Verifiable now — production refuses to start on the shipped development secret:**

```bash
cd "$WT/apps/api" && NODE_ENV=production DATABASE_PATH=./data/verify-be02.sqlite pnpm start; echo "exit=$?"
```

Expected: startup aborts non-zero with a message naming `SESSION_SECRET`.

**Verifiable now — `secure: true` is actually in effect:** start with a real secret and log in over
HTTP.

```bash
cd "$WT/apps/api" && NODE_ENV=production SESSION_SECRET="$(openssl rand -base64 48)" DATABASE_PATH=./data/verify-be02.sqlite pnpm start
```

```bash
curl -si -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' | grep -iE '^(HTTP|set-cookie)'
```

Expected: **no `Set-Cookie` header at all.** That absence *is* the evidence — the official
documentation states that when `secure` is set and the site is accessed over HTTP, "the cookie will
not be set". A `Set-Cookie` appearing here would mean `secure` is **not** being applied in production.

> Do **not** expect to see the literal `Secure` attribute in this check. Over plain HTTP there is no
> `Set-Cookie` header to read it from. Expecting one is a test that a correct implementation fails.

The login will also return `401` here if the verification database has no demo user for this
environment — the seed is production-inert by FR-028, which is § 11's check, not a fault.

**Deferred — observing the literal `Secure` attribute on the wire.** This requires an HTTPS origin,
which this project does not have and the assessment does not ask for. It is recorded as deferred
rather than faked. When an HTTPS environment exists, the check is the § 5 `Set-Cookie` grep against
an `https://` URL, expecting `Secure` alongside `HttpOnly` and `SameSite=Lax`.

**After this section, restart the API in its normal development mode** before continuing:

```bash
cd "$WT/apps/api" && DATABASE_PATH=./data/verify-be02.sqlite pnpm dev
```

## 11. Demo seed is production-inert (spec FR-028)

Against a separate, empty database so the development seed is not mistaken for a production one:

```bash
cd "$WT/apps/api" && rm -f ./data/verify-prod.sqlite* && NODE_ENV=production SESSION_SECRET="$(openssl rand -base64 48)" DATABASE_PATH=./data/verify-prod.sqlite pnpm start
```

Stop it, then:

```bash
cd "$WT/apps/api" && node -e "const D=require('better-sqlite3');const db=new D('./data/verify-prod.sqlite');console.log('users in production db:',db.prepare('SELECT COUNT(*) AS n FROM users').get().n);db.close()"
```

Expected: `0` — no demo user was created.

```bash
cd "$WT/apps/api" && rm -f ./data/verify-prod.sqlite* && echo "production probe database removed"
```

## 12. Rate limiting on login (spec FR-010, US2 scenario 5)

Restart the API to clear the in-memory window, then send eleven failures:

```bash
for i in $(seq 1 11); do printf '%2d: ' "$i"; curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"wrong-password"}'; done
```

Expected: `401` for the first ten, then `429`.

Confirm the 429 body uses the BE-01 error shape and carries rate-limit headers:

```bash
curl -si -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"wrong-password"}' | grep -iE '^(HTTP|ratelimit)'
```

Confirm a *correct* password is not counted against the limit (`skipSuccessfulRequests`): restart the
API, log in successfully fifteen times, and observe `200` every time.

```bash
for i in $(seq 1 15); do printf '%2d: ' "$i"; curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}'; done
```

## 13. Static checks

These are the **only** automated gates in this app. All three must exit 0.

```bash
cd "$WT" && pnpm --filter api lint
```

```bash
cd "$WT/apps/api" && npx tsc --noEmit -p tsconfig.json
```

```bash
cd "$WT" && pnpm --filter api build
```

## 14. Scope checks

Frontend untouched (spec FR-031, SC-011):

```bash
cd "$WT" && git status --short apps/web
```

Expected: empty.

**No verification artefact was left behind or committed:**

```bash
cd "$WT" && git status --short && echo "--- verification databases (must be ignored, never tracked) ---" && git ls-files apps/api/data/
```

Expected: `git status` shows no `verify-be02.sqlite`, and `git ls-files apps/api/data/` lists nothing.

```bash
rm -f "$DB" "$DB-wal" "$DB-shm" && rm -rf "$JARS" && echo "verification artefacts cleaned up"
```

No test infrastructure was introduced (spec FR-033, SC-012):

```bash
cd "$WT" && git ls-files apps/api | grep -Ei '(spec|test)\.ts$|__tests__|vitest|jest' || echo "no test files — correct"
```

```bash
cd "$WT" && grep -Ei '"(vitest|jest|supertest|@nestjs/testing|ts-jest)"' apps/api/package.json || echo "no test dependencies — correct"
```

```bash
cd "$WT" && grep -E '"test' apps/api/package.json || echo "no test scripts — correct"
```

Expected: all three report "correct".

No debug or test-only route was added (spec FR-033):

```bash
cd "$WT" && grep -rnE "@(Get|Post|Put|Patch|Delete)\(" apps/api/src/
```

Expected: exactly four routes — `health`, `login`, `me`, `logout`. Nothing else.
