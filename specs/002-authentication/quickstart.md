# Quickstart & Verification: BE-02 — Authentication

**Date**: 2026-09-09 | **Plan**: [plan.md](./plan.md)

Runnable checks that prove BE-02 meets its acceptance criteria. Everything here is a command a
reviewer can execute; nothing here is implementation code. Run these **after** implementation — they
are the source for `tasks.md` Phase 8, and their real output is what gets reported (Constitution
Principle VIII).

> **This backend has no automated test suite.** The repository owner deferred all backend automated
> testing until after BE-03, and BE-01's test scaffolding was removed by that decision. Every check
> below is therefore manual, and § 11 lists the only automated gates that exist. Because nothing here
> runs by itself, §§ 4–9 must be re-run by hand after any change to `auth/`, `config.ts`, or
> `main.ts`.

## Prerequisites

- Node **24.21.0** (the `.nvmrc` pin): `nvm use`
- pnpm 11.9.0: `corepack enable`
- No cloud account, API key, or paid service.

Two shells are useful: one running the API, one running the checks.

## Setup

```bash
nvm use && pnpm install
```

`pnpm install` must complete with **no** `--force`, **no** `--legacy-peer-deps`, and no
peer-dependency error (spec SC-010). Watch for `node-gyp` output — `@node-rs/argon2` ships prebuilt
binaries and should download, not compile.

```bash
cp apps/api/.env.example apps/api/.env
```

No edits needed: `SESSION_SECRET` has a development default and `SESSION_TTL_HOURS` defaults to 12.

Start from a clean database so the demo user is seeded (§ 2):

```bash
rm -f apps/api/data/margin.sqlite*
```

```bash
pnpm --filter api dev
```

A cookie jar carries the session between checks:

```bash
cd /tmp && rm -f jar.txt
```

## 1. Health is still public (spec FR-023, SC-009)

```bash
curl -i http://localhost:4000/health
```

Expected: `200`, body `{"status":"ok"}`, with no session and no cookie.

## 2. The demo user exists (spec US4, FR-027)

Read the startup log from `pnpm --filter api dev`.

Expected: one line naming the seeded demo email, printed only on the first start against an empty
database. **The password must not appear in the log** — it is in `apps/api/README.md`.

Confirm the password was stored hashed, not in plaintext (spec US4 scenario 3):

```bash
cd apps/api && node -e "const D=require('better-sqlite3');const db=new D('data/margin.sqlite');console.log(db.prepare('SELECT id,email,substr(password_hash,1,30) AS hash_prefix FROM users').all());db.close()"
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
curl -s -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"wrong-password"}' | tee /tmp/a.json
```

```bash
curl -s -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"nobody@tentwenty.local","password":"wrong-password"}' | tee /tmp/b.json
```

Both must be `401` with `"message":["Invalid email or password"]`. Now prove they differ only in the
timestamp:

```bash
diff <(sed 's/"timestamp":"[^"]*"/"timestamp":"X"/' /tmp/a.json) <(sed 's/"timestamp":"[^"]*"/"timestamp":"X"/' /tmp/b.json) && echo "IDENTICAL"
```

Expected: `IDENTICAL`. Any difference — a distinct message, a different field — leaks which accounts
exist and fails SC-002.

Confirm neither set a cookie (spec US2 scenario 3):

```bash
curl -si -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"wrong-password"}' | grep -i '^set-cookie' || echo "no cookie set — correct"
```

## 5. Successful login (spec US1, FR-007, SC-003)

```bash
curl -si -c /tmp/jar.txt -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}'
```

Expected: `200`, body exactly `{"user":{"id":1,"email":"demo@tentwenty.local"}}`. The body must
contain **no** `password_hash`, no `sid`, and no secret (SC-003).

Inspect the cookie attributes in the `Set-Cookie` header (spec FR-014, SC-007):

```bash
curl -si -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' | grep -i '^set-cookie'
```

Expected in development: `sid=`, `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=43200`, and **no**
`Secure` — local sign-in is over plain HTTP.

### Session is regenerated on login (spec FR-009, SC-006)

Log in twice with the same jar and compare the identifiers:

```bash
cd /tmp && rm -f j1.txt && curl -s -c j1.txt -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null && grep sid j1.txt | awk '{print $7}' > sid1.txt && curl -s -b j1.txt -c j1.txt -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null && grep sid j1.txt | awk '{print $7}' > sid2.txt && (diff -q sid1.txt sid2.txt >/dev/null && echo "FAIL: sid reused" || echo "PASS: sid regenerated")
```

Expected: `PASS: sid regenerated`. A reused identifier means `regenerate()` was skipped and session
fixation is possible.

## 6. Authenticated and unauthenticated /auth/me (spec FR-016, FR-021)

With the session:

```bash
curl -i -b /tmp/jar.txt http://localhost:4000/auth/me
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

With the session from § 5 still in `/tmp/jar.txt`, stop the API (`Ctrl+C`) and start it again:

```bash
pnpm --filter api dev
```

```bash
curl -i -b /tmp/jar.txt http://localhost:4000/auth/me
```

Expected: still `200`, same user, **no re-login**. This is the check that proves the session lives in
SQLite rather than in process memory. If it returns 401, the store is not being used.

## 8. Session expiry (spec FR-013, US3 scenario 6)

Restart the API with a short TTL, in its own shell:

```bash
cd apps/api && SESSION_TTL_HOURS=1 pnpm start
```

`SESSION_TTL_HOURS` is bounded at a minimum of 1 hour, so rather than waiting, expire the row
directly and confirm the API honours it:

```bash
cd /tmp && rm -f exp.txt && curl -s -c exp.txt -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null && curl -s -o /dev/null -w 'before expiry: %{http_code}\n' -b exp.txt http://localhost:4000/auth/me
```

```bash
cd /Users/ammaralhasan/Documents/tentwenty-test/apps/api && node -e "const D=require('better-sqlite3');const db=new D('data/margin.sqlite');console.log('rows aged:',db.prepare('UPDATE sessions SET expires_at = 1').run().changes);db.close()"
```

```bash
curl -s -o /dev/null -w 'after expiry:  %{http_code}\n' -b /tmp/exp.txt http://localhost:4000/auth/me
```

Expected: `before expiry: 200`, then `after expiry: 401`.

Confirm the expired row was removed rather than left to accumulate (spec FR-013):

```bash
cd apps/api && node -e "const D=require('better-sqlite3');const db=new D('data/margin.sqlite');console.log('expired rows remaining:',db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at <= ?').get(Date.now()).n);db.close()"
```

Expected: `0`.

## 9. Logout invalidates the session server-side (spec FR-017, FR-018, SC-005)

Log in fresh and **capture the raw cookie value before logging out** — this is the point of the
check; clearing the browser's copy proves nothing.

```bash
cd /tmp && rm -f out.txt && curl -s -c out.txt -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' >/dev/null && CAPTURED=$(grep sid out.txt | awk '{print $7}') && echo "captured: ${CAPTURED:0:12}..."
```

```bash
cd /tmp && CAPTURED=$(grep sid out.txt | awk '{print $7}') && curl -si -b out.txt -X POST http://localhost:4000/auth/logout -H 'Origin: http://localhost:3000' | head -1 && curl -s -o /dev/null -w 'replayed captured sid: %{http_code}\n' -H "Cookie: sid=$CAPTURED" http://localhost:4000/auth/me
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
cd apps/api && node -e "const D=require('better-sqlite3');const db=new D('data/margin.sqlite');console.log('sessions:',db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n);db.close()"
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

```bash
curl -i -b /tmp/jar.txt -X POST http://localhost:4000/auth/logout -H 'Origin: http://evil.example'
```

Expected: `403`, and the session must still work afterwards:

```bash
curl -s -o /dev/null -w 'session still valid: %{http_code}\n' -b /tmp/jar.txt http://localhost:4000/auth/me
```

Expected: `200` — the forged logout changed nothing.

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

### Production cookie attributes (spec SC-007)

`Secure` is conditional, so verify the production branch without deploying:

```bash
cd apps/api && NODE_ENV=production SESSION_SECRET="$(openssl rand -base64 48)" pnpm start
```

```bash
curl -si -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@tentwenty.local","password":"demo-password-2026"}' | grep -i '^set-cookie'
```

Expected: the `Set-Cookie` now includes `Secure`. (The login itself will fail with 401 against a fresh
production database, since no demo user is seeded there — that is FR-028 working. Use the existing
development database file to see the cookie, or accept the 401 and read the attributes from a
`Set-Cookie` that is not sent — in which case confirm `Secure` by inspecting the configured value
instead.)

Confirm production refuses to start on the shipped development secret:

```bash
cd apps/api && NODE_ENV=production pnpm start; echo "exit=$?"
```

Expected: startup aborts non-zero with a message naming `SESSION_SECRET`.

## 11. Rate limiting on login (spec FR-010, US2 scenario 5)

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

## 12. Static checks

These are the **only** automated gates in this app. All three must exit 0.

```bash
pnpm --filter api lint
```

```bash
cd apps/api && npx tsc --noEmit -p tsconfig.json
```

```bash
pnpm --filter api build
```

## 13. Scope checks

Frontend untouched (spec FR-031, SC-011):

```bash
git status --short apps/web
```

Expected: empty.

No test infrastructure was introduced (spec FR-033, SC-012):

```bash
git ls-files apps/api | grep -Ei '(spec|test)\.ts$|__tests__|vitest|jest' || echo "no test files — correct"
```

```bash
grep -Ei '"(vitest|jest|supertest|@nestjs/testing|ts-jest)"' apps/api/package.json || echo "no test dependencies — correct"
```

```bash
grep -E '"test' apps/api/package.json || echo "no test scripts — correct"
```

Expected: all three report "correct".

No debug or test-only route was added (spec FR-033):

```bash
grep -rnE "@(Get|Post|Put|Patch|Delete)\(" apps/api/src/
```

Expected: exactly four routes — `health`, `login`, `me`, `logout`. Nothing else.
