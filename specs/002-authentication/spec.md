# Feature Specification: BE-02 — Authentication

**Feature Branch**: `002-authentication`

**Created**: 2026-09-09

**Status**: Draft — awaiting review

**Scope**: `apps/api` only (per Constitution Principle V)

**Input**: User description: "BE-02 Authentication. Cookie-based authentication using server-side
sessions. POST /auth/login, GET /auth/me, POST /auth/logout, and a reusable guard for future
protected business endpoints. A users table and persistent sessions. One simple, documented way to
create a local demo user with hashed credentials and no manual SQL. Only the environment settings
actually required. Reuse the BE-01 configuration, SQLite DatabaseService, Zod/Nest validation,
global error filter, and credentialed CORS setup."

## Overview

BE-02 is the second of three backend specs:

1. **BE-01 — Foundation** (merged: `ad9f520`)
2. **BE-02 — Authentication** (this spec)
3. **BE-03 — Spreadsheet ingestion, calculations, and assessment APIs**

It puts a login boundary in front of the dashboard and gives BE-03 a single, reusable way to mark
an endpoint as "signed-in users only". It delivers one visible feature — signing in and staying
signed in — and one internal contract: the guard.

### Relationship to the assessment brief

The take-home brief (`temp/Margin Dashboard Exercise.pdf`) does **not** ask for authentication. It
asks for upload, dashboard, project, productivity and category pages, and it explicitly warns
against spending the time budget on breadth. BE-02 therefore exists at the repository owner's
direction, not the brief's, and its scope is deliberately the smallest thing that works:

- No registration, password reset, email verification, roles, permissions, OAuth, JWT, refresh
  tokens, "remember me", account lockout, MFA, or audit log.
- One demo user, created locally, is the entire user population.

This constraint is a requirement of the spec (FR-030), not a note.

## User Scenarios & Testing *(mandatory)*

> **Testing note.** This backend carries no automated test suite — the repository owner deferred
> all backend automated testing to the end of backend implementation, after BE-03. Every
> acceptance scenario below is therefore a **manual verification step**, executed with `curl` or a
> browser and recorded in [quickstart.md](./quickstart.md). Nothing in this spec asks for a test
> file, a test framework, a mock, a fixture, or a test script.

### User Story 1 - Sign in and stay signed in (Priority: P1)

A reviewer opens the project, signs in with the documented demo credentials, and their browser
stays signed in across page reloads and across an API restart, until the session expires.

**Why this priority**: This is the whole feature. Without it there is no boundary and no session
to protect anything with.

**Independent Test**: Start the API, POST the demo credentials to the login endpoint, observe a
success response and a session cookie, then request the current-user endpoint with that cookie and
observe the signed-in user.

**Acceptance Scenarios**:

1. **Given** a demo user exists and the API is running, **When** a client posts that user's correct
   email and password to the login endpoint, **Then** the response is HTTP 200, its body identifies
   the signed-in user by id and email, and the response sets a session cookie.
2. **Given** a successful login, **When** the client requests the current-user endpoint carrying the
   session cookie, **Then** the response is HTTP 200 and identifies the same user.
3. **Given** a signed-in client, **When** the API process is stopped and started again and the
   client repeats the current-user request with the same cookie, **Then** the response is still
   HTTP 200 and identifies the same user.
4. **Given** a successful login, **When** the response is inspected, **Then** it contains no
   password hash, no session secret, and no session identifier anywhere in the body.
5. **Given** a client that was already signed in as one user, **When** it logs in again, **Then**
   the session identifier issued by the second login differs from the one it held before.

---

### User Story 2 - Be refused cleanly when credentials are wrong (Priority: P1)

Someone types the wrong password, or an email that does not exist, and gets one indistinguishable
refusal that tells an attacker nothing about which accounts exist.

**Why this priority**: A login endpoint that leaks account existence, or that returns a different
error shape from the rest of the API, is a defect on delivery rather than a later refinement. It
ships with US1 or not at all.

**Independent Test**: Post a wrong password for a known email and a password for an unknown email,
and compare the two responses byte for byte apart from the timestamp.

**Acceptance Scenarios**:

1. **Given** a demo user exists, **When** a client posts that user's email with the wrong password,
   **Then** the response is HTTP 401 and its message is generic.
2. **Given** no user with that email exists, **When** a client posts that email with any password,
   **Then** the response is HTTP 401 with the same status, message, and field set as scenario 1.
3. **Given** either refusal above, **When** the response is inspected, **Then** no session cookie is
   set and the client remains unauthenticated.
4. **Given** a login body that is missing a field, has a non-string field, or has a malformed email,
   **When** it is posted, **Then** the response is HTTP 400 in the established error shape, naming
   the offending field, and the handler is never reached.
5. **Given** repeated failed login attempts from one client in a short window, **When** the attempts
   exceed the configured allowance, **Then** further attempts receive HTTP 429 until the window
   passes.

---

### User Story 3 - Protect an endpoint and sign out (Priority: P1)

An endpoint marked as protected refuses anonymous callers, and signing out makes the session
unusable immediately — not merely hidden from the browser.

**Why this priority**: An authentication feature whose logout only deletes the client-side cookie
leaves a valid server-side session behind. That is the defect this story exists to prevent, and it
is the property BE-03 depends on.

**Independent Test**: Request the current-user endpoint with no cookie and observe a refusal; then
sign in, sign out, and replay the *captured* pre-logout cookie directly, observing a refusal.

**Acceptance Scenarios**:

1. **Given** a client with no session cookie, **When** it requests the current-user endpoint,
   **Then** the response is HTTP 401 in the established error shape.
2. **Given** a client presenting a session cookie that is unknown, tampered with, or expired,
   **When** it requests the current-user endpoint, **Then** the response is HTTP 401.
3. **Given** a signed-in client, **When** it posts to the logout endpoint, **Then** the response
   succeeds and instructs the browser to clear the session cookie.
4. **Given** a session cookie value captured before logout, **When** it is replayed against the
   current-user endpoint after logout, **Then** the response is HTTP 401 — the server-side session
   is gone, not just the browser's copy.
5. **Given** a client that is not signed in, **When** it posts to the logout endpoint, **Then** the
   response succeeds rather than failing, so signing out is safe to call unconditionally.
6. **Given** a session whose expiry has passed, **When** it is used, **Then** the response is HTTP
   401 and the expired session is no longer retained in storage.

---

### User Story 4 - Set up the demo user without touching SQL (Priority: P2)

A reviewer who has just cloned the repository gets working credentials from the documentation, with
no SQL client, no seed file to run by hand, and no manual password hashing.

**Why this priority**: Without it the feature is unreachable by anyone but its author, and the
assessment brief asks explicitly for sample data that is loaded or loadable in one step. It is P2
only because US1–US3 define the behaviour that this story makes reachable.

**Independent Test**: From a clean checkout with an empty database, follow the documented setup and
sign in successfully using only the documented credentials.

**Acceptance Scenarios**:

1. **Given** a clean checkout and no existing database file, **When** the reviewer follows the
   documented setup, **Then** a demo user exists with a hashed password and the documentation states
   its credentials.
2. **Given** the demo user already exists, **When** the API is started again, **Then** no duplicate
   user is created and the existing password is left unchanged.
3. **Given** the stored user record is inspected directly, **When** its password field is read,
   **Then** it is a password hash, not the plaintext password.
4. **Given** the API is configured for a production environment, **When** it starts, **Then** no
   demo user is created automatically.

---

### User Story 5 - Be reachable from the frontend origin, and only that origin (Priority: P2)

The Next.js app on its own origin can sign in and stay signed in with credentialed requests, while a
page on any other origin cannot use a visitor's session to act on their behalf.

**Why this priority**: A cookie session that the frontend cannot send is useless, and one that any
origin can drive is unsafe. Both halves are settled here so BE-03 inherits them.

**Independent Test**: Issue a credentialed cross-origin request from the configured frontend origin
and observe it succeed; issue the same request claiming a different origin and observe it refused.

**Acceptance Scenarios**:

1. **Given** a request from the configured frontend origin carrying credentials, **When** it reaches
   the login endpoint, **Then** the response permits that origin and permits credentials.
2. **Given** a preflight for the login endpoint from the configured origin, **When** it is sent,
   **Then** it is approved for the method and headers the login request uses.
3. **Given** a state-changing request that declares an origin other than the configured one, **When**
   it reaches the API, **Then** it is refused before any state changes.
4. **Given** the session cookie, **When** its attributes are inspected, **Then** it is marked
   inaccessible to client-side scripts, is restricted in how it may accompany cross-site requests,
   carries an expiry, and is marked secure-only when the API runs in a production environment.
5. **Given** the health endpoint, **When** it is requested with no session at all, **Then** it still
   returns success — it remains public.

### Edge Cases

- **Email case and surrounding whitespace**: `  Demo@Example.com ` and `demo@example.com` MUST
  resolve to the same account, so a reviewer who copies a credential with a trailing space still
  signs in.
- **Very long password input**: an oversized password field MUST be rejected by validation rather
  than passed to the password hasher, which would otherwise do unbounded work on request.
- **Login while already signed in**: MUST succeed and replace the existing session rather than
  erroring or leaving two usable sessions.
- **Two browsers, same user**: both sessions MUST work independently, and signing out of one MUST
  NOT sign out the other.
- **Database file deleted while running**: MUST surface as the generic 500 defined in BE-01, with no
  internal detail in the response body.
- **Clock**: session expiry is evaluated against the server clock; a session is expired when its
  recorded expiry has passed, regardless of what the client believes.
- **Concurrent requests on one session**: MUST NOT corrupt the stored session or lose the signed-in
  user.

## Requirements *(mandatory)*

### Functional Requirements

**Credentials and accounts**

- **FR-001**: The API MUST store a user account as an identifier, an email address, and a password
  verifier. It MUST NOT store the password itself in any recoverable form.
- **FR-002**: Email addresses MUST be unique across accounts, and matching MUST be case-insensitive
  and insensitive to surrounding whitespace.
- **FR-003**: Password verification MUST use a memory-hard password hashing function with a
  per-password salt, and comparison MUST NOT leak information through timing.
- **FR-004**: The password verifier MUST NOT appear in any HTTP response body, log line, or error
  message.

**Login**

- **FR-005**: The API MUST expose one endpoint that exchanges an email and password for an
  authenticated session.
- **FR-006**: Login input MUST be validated by the application-wide validation mechanism established
  in BE-01, and an invalid body MUST receive HTTP 400 without reaching the handler.
- **FR-007**: A successful login MUST return HTTP 200 with the signed-in user's identifier and email
  and MUST establish a server-side session.
- **FR-008**: A failed login MUST return HTTP 401 with a single generic message that is byte-identical
  whether the email is unknown or the password is wrong.
- **FR-009**: A successful login MUST issue a new session identifier, replacing any identifier the
  client already held, so that a session identifier fixed by an attacker before login cannot be used
  after it.
- **FR-010**: Repeated failed login attempts from the same client MUST be limited, returning HTTP 429
  once the allowance for the window is exhausted.

**Session lifetime**

- **FR-011**: Session state MUST be held on the server. The cookie MUST carry only a session
  identifier and MUST NOT carry the user's identity, email, or any authorization claim.
- **FR-012**: Sessions MUST be stored in the existing SQLite database established in BE-01, and MUST
  remain valid after the API process is stopped and started, until they expire.
- **FR-013**: Every session MUST have an expiry. A session presented after its expiry MUST be treated
  as absent, and expired sessions MUST NOT accumulate in storage indefinitely.
- **FR-014**: The session cookie MUST be inaccessible to client-side script, MUST restrict its own
  cross-site use, MUST carry an expiry, and MUST be marked secure-only when the API runs in a
  production environment.
- **FR-015**: The session identifier MUST be unguessable and MUST be integrity-protected, so a
  client-modified cookie value is rejected rather than treated as another session.

**Current user and logout**

- **FR-016**: The API MUST expose one endpoint that returns the currently signed-in user, answering
  HTTP 200 with the user's identifier and email when a valid session is present and HTTP 401 when it
  is not.
- **FR-017**: The API MUST expose one endpoint that ends the current session. It MUST delete the
  server-side session and MUST instruct the client to clear the session cookie.
- **FR-018**: After logout, replaying the previous session identifier MUST be refused.
- **FR-019**: Logout MUST succeed when no session is present, so a client may call it
  unconditionally.

**Protecting endpoints**

- **FR-020**: The API MUST provide one reusable mechanism that marks an endpoint as requiring a valid
  session, so BE-03 protects an endpoint by applying it rather than by re-implementing the check.
- **FR-021**: That mechanism MUST refuse an unauthenticated request with HTTP 401 in the error shape
  defined in BE-01, and MUST make the signed-in user's identifier available to the handler it
  protects.
- **FR-022**: BE-02 MUST NOT add a placeholder, demo, or debug endpoint whose only purpose is to
  exercise the mechanism. The current-user endpoint is its real first consumer.
- **FR-023**: `GET /health` MUST remain reachable without a session.

**Cross-origin and request forgery**

- **FR-024**: The credentialed cross-origin configuration established in BE-01 MUST be reused
  unchanged, so the frontend origin can sign in and send its cookie.
- **FR-025**: A state-changing request that declares an origin other than the configured frontend
  origin MUST be refused before it changes any state.
- **FR-026**: The design MUST document why its request-forgery defence is sufficient for this
  deployment, and MUST NOT require the frontend to be modified in this spec.

**Demo user and configuration**

- **FR-027**: The repository MUST provide one documented way to obtain a working local demo user with
  a hashed password, requiring no SQL client, no manual hashing, and no editing of the database.
- **FR-028**: Demo user creation MUST be idempotent, and MUST NOT occur when the API is configured
  for a production environment.
- **FR-029**: BE-02 MUST add only the configuration settings it actually needs. Each new setting MUST
  be documented in the example environment file, and a secret MUST NOT ship with a usable default in
  a production environment.

**Scope**

- **FR-030**: BE-02 MUST NOT implement registration, password reset, email verification, roles,
  permissions, OAuth, JWT or refresh tokens, "remember me", account lockout, or multi-factor
  authentication.
- **FR-031**: BE-02 MUST NOT modify `apps/web`.
- **FR-032**: The existing configuration source, database service, validation mechanism, error filter,
  and cross-origin configuration from BE-01 MUST be reused rather than replaced or duplicated.

**Testing**

- **FR-033**: BE-02 MUST NOT add an automated test suite, test framework, test file, mock, fixture,
  test configuration, or test script. Backend automated testing is deferred by the repository owner
  until after BE-03. Behaviour is verified by the manual checks in [quickstart.md](./quickstart.md)
  together with the type-check, lint, and build gates. Permanent test or debug routes MUST NOT be
  added to the API.

### Key Entities

- **User**: a person who may sign in. Identified internally by a stable identifier; identified to a
  human by an email address, which is unique. Holds a password verifier and a creation time. Holds no
  profile, role, or status field in this spec.
- **Session**: a server-side record that a particular user is currently signed in from a particular
  client. Identified by an unguessable identifier that the client holds in a cookie. Carries the
  signed-in user's identifier and an expiry time. Ceases to exist at logout or expiry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a clean checkout, a reviewer following only the README reaches a successful login
  in under five minutes, without writing SQL or hashing a password by hand.
- **SC-002**: A wrong-password refusal and an unknown-email refusal are identical in status code,
  error field, and message text — the responses differ only in their timestamp.
- **SC-003**: No HTTP response body produced by the API contains a password hash, the session secret,
  or the raw session identifier.
- **SC-004**: A session established before an API restart is still accepted after it, with no
  re-login.
- **SC-005**: A session identifier captured before logout is refused with HTTP 401 after logout.
- **SC-006**: The session identifier issued after login differs from the one the client held before
  login, in 100% of logins.
- **SC-007**: The session cookie carries the script-inaccessible, cross-site-restricted, and expiry
  attributes in development, and additionally the secure-only attribute when configured for
  production.
- **SC-008**: Every error response produced by BE-02 — 400, 401, 403, 429, 500 — carries the same
  five fields as every BE-01 error response.
- **SC-009**: A state-changing request declaring a non-configured origin is refused, and `GET /health`
  succeeds with no session.
- **SC-010**: Installing BE-02's dependencies completes with no `--force`, no `--legacy-peer-deps`,
  and no unresolved peer-dependency warning.
- **SC-011**: `apps/web` has no changes attributable to this spec.
- **SC-012**: `apps/api` contains no test file, test framework dependency, or test script after BE-02.

## Assumptions

- **One user is enough.** The dashboard has a single audience — the leadership team — and the
  assessment asks for no user management. Multi-user support falls out of the schema for free but is
  neither built nor verified.
- **The demo credentials are public.** They are written in the README and are meant for a local
  reviewer's machine. They are not a secret and are not treated as one.
- **The frontend runs on one known origin.** BE-01 already assumes exactly one configured frontend
  origin; BE-02 inherits that assumption rather than generalising it.
- **Local HTTP is the deployment target.** The brief requires the app to run locally on a Mac. The
  secure-only cookie attribute is therefore conditional on the configured environment rather than
  always on, because always-on would make local sign-in impossible over plain HTTP.
- **The frontend is written in BE-04 or later.** BE-02 defines the HTTP contract in
  [contracts/auth.md](./contracts/auth.md); no frontend code is written or required here
  (Constitution Principle V).
- **Session storage volume is small.** One reviewer, a handful of sessions. No session-store
  performance work is warranted, and expired-row cleanup can be opportunistic.

## Out of Scope

- Any change to `apps/web`, including a login page or an API client.
- Registration, password reset, email verification, profile editing, account deletion.
- Roles, permissions, or any authorization decision beyond "is there a valid session".
- OAuth, SSO, JWT, refresh tokens, API keys, or bearer-token authentication.
- Account lockout, CAPTCHA, multi-factor authentication, or breach-password checks.
- Rate limiting on any endpoint other than login.
- An automated test suite of any kind (FR-033).
- Swagger/OpenAPI documentation.
- Applying the guard to a business endpoint — BE-03 owns the endpoints that need it.
