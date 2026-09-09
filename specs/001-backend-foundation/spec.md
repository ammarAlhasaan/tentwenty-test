# Feature Specification: BE-01 — Backend Foundation

**Feature Branch**: `001-backend-foundation`

**Created**: 2026-09-09

**Status**: Draft — awaiting review

**Scope**: `apps/api` only (per Constitution Principle V)

**Input**: User description: "BE-01 Backend Foundation. Preserve the existing NestJS scaffold and default Express adapter. Centralize environment configuration. Validate configuration and request inputs. Define one consistent error response format. Establish a small SQLite database module/service with a configurable path and clean shutdown. Configure CORS for the frontend's explicit origin, ready for future cookie-based authentication. Keep GET /health working. Document local setup and provide an appropriate .env.example. Preserve the current minimal root scripts and package manager."

## Overview

BE-01 is the first of three backend specs for the Margin Dashboard:

1. **BE-01 — Foundation** (this spec)
2. **BE-02 — Authentication**
3. **BE-03 — Spreadsheet ingestion, calculations, and assessment APIs**

It delivers no end-user feature. Its users are the developers who will build BE-02 and BE-03, and
the reviewer who must run the project from a clean checkout. It exists so that configuration,
input validation, error shape, persistence, and cross-origin access are decided once, in one
place, before any business logic is written on top of them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the API from a clean checkout (Priority: P1)

A reviewer clones the repository, follows the README, and gets a running API that answers a
health check — without a cloud account, an API key, or a paid service.

**Why this priority**: If the API does not start from a clean checkout, nothing else in the
project can be assessed. This is the minimum viable slice of BE-01.

**Independent Test**: On a machine with the documented Node version and pnpm, run the documented
install and start commands, then request the health endpoint and observe a success response.

**Acceptance Scenarios**:

1. **Given** a clean checkout and the documented Node version, **When** the reviewer runs the
   documented install command, **Then** installation completes successfully without any flag that
   suppresses dependency conflicts.
2. **Given** installed dependencies and no `.env` file, **When** the reviewer copies the provided
   example environment file to `.env` and runs the documented start command, **Then** the API
   starts and reports the port it is listening on.
3. **Given** a running API, **When** a client requests `GET /health`, **Then** the response is
   HTTP 200 with body `{"status":"ok"}`.
4. **Given** a clean checkout, **When** the reviewer runs the documented build command, **Then**
   the build completes without errors.

---

### User Story 2 - Fail loudly on bad configuration (Priority: P1)

A developer starting the API with missing or malformed configuration is told exactly what is
wrong, at startup, instead of discovering it as a runtime failure later.

**Why this priority**: Silent configuration defaults are the most common source of "works on my
machine". Every later spec reads its settings through this mechanism.

**Independent Test**: Start the API with a deliberately invalid environment value and observe that
startup aborts with a message naming the offending variable.

**Acceptance Scenarios**:

1. **Given** an environment where a required setting is absent, **When** the API starts, **Then**
   startup fails with a non-zero exit and a message naming the missing setting.
2. **Given** an environment where a setting has the wrong type or an out-of-range value, **When**
   the API starts, **Then** startup fails with a message naming that setting and describing what
   was expected.
3. **Given** a valid environment, **When** the API starts, **Then** it starts successfully and
   every setting it uses comes from the validated configuration rather than from a direct
   environment read scattered through the code.
4. **Given** a setting with a documented default and no value supplied, **When** the API starts,
   **Then** it starts successfully using that default.

---

### User Story 3 - One predictable error shape (Priority: P1)

A frontend developer consuming the API can write one error handler, because every failure — a
rejected input, a known error, or an unexpected crash — comes back in the same shape, with the
correct status code, and without leaking internal details.

**Why this priority**: The error contract is part of the HTTP boundary that BE-02 and BE-03 and
the frontend all depend on. Changing it later means changing every consumer.

**Independent Test**: Exercise a validation failure, a deliberate known error, and a deliberate
unexpected error in isolated tests, and confirm all three responses share one shape while keeping
distinct status codes.

**Acceptance Scenarios**:

1. **Given** a request whose input fails validation, **When** the API responds, **Then** the
   status is 400 and the body follows the standard error shape, listing which fields failed and
   why.
2. **Given** a handler that raises a known error with a specific status (for example 404 or 403),
   **When** the API responds, **Then** that status is preserved and the body follows the standard
   error shape.
3. **Given** a handler that throws an unexpected error, **When** the API responds, **Then** the
   status is 500, the body follows the standard error shape, and the body contains no stack
   trace, file path, internal message, or other implementation detail.
4. **Given** a handler that throws an unexpected error, **When** the failure is handled, **Then**
   the full error, including its stack, is written to the server log at error level.
5. **Given** any error response, **When** it is inspected, **Then** it contains the same set of
   fields as every other error response.

---

### User Story 4 - Data that survives a restart (Priority: P2)

A developer building BE-02 and BE-03 has a working local database connection available through
dependency injection, at a path they can configure, which reliably resolves to the same file no
matter which directory the process was started from, and which closes cleanly on shutdown.

**Why this priority**: BE-02 and BE-03 both persist data. The connection must exist before them,
but the API is demonstrably useful (P1 stories) without any table in it yet.

**Independent Test**: Write a value through the injected database service, stop the API, restart
it, and read the value back.

**Acceptance Scenarios**:

1. **Given** a configured database path, **When** the API starts, **Then** the database file is
   created if absent, including any missing parent directory, and a connection is opened.
2. **Given** the API started from the repository root and, separately, from the API application
   directory, **When** each run resolves the configured relative path, **Then** both resolve to
   the same database file.
3. **Given** a value written through the database service, **When** the API is stopped and
   started again, **Then** the value is still readable.
4. **Given** a running API, **When** the process receives a termination signal, **Then** the
   database connection is closed before the process exits, leaving no stale lock or partial write.
5. **Given** a configured database path that cannot be opened, **When** the API starts, **Then**
   startup fails with a message naming the path.

---

### User Story 5 - The frontend can call the API from the browser (Priority: P2)

The Next.js application at its own origin can call the API from browser code, including sending
credentials, while other origins cannot.

**Why this priority**: Needed before any frontend spec, and the credentialed configuration must be
correct from the start because BE-02 introduces cookie-based sessions that depend on it.

**Independent Test**: Issue cross-origin requests from the allowed origin and from a different
origin, and compare the responses.

**Acceptance Scenarios**:

1. **Given** a browser request from the configured frontend origin, **When** the API responds,
   **Then** the response permits that origin and permits credentials.
2. **Given** a browser request from an origin that is not configured, **When** the API responds,
   **Then** the response does not permit that origin.
3. **Given** a browser preflight request from the configured frontend origin, **When** the API
   responds, **Then** the preflight succeeds for the methods and headers the application uses.
4. **Given** the configured frontend origin is changed in configuration, **When** the API
   restarts, **Then** the new origin is permitted and the old one is not.

---

### Edge Cases

- The environment file is absent entirely: the API starts if every required setting has a
  documented default or is present in the real environment; otherwise it fails with the message
  from User Story 2.
- The configured database path points at a directory that does not exist: the directory is
  created rather than treated as an error.
- The configured database path points at a location that cannot be written: startup fails with a
  clear message naming the path, rather than starting and failing on first write.
- An error is thrown after response headers have already been sent: the failure is logged and the
  process does not crash.
- A validation failure and an unexpected failure occur on the same route in different requests:
  each still returns its own correct status code.
- A request arrives with no `Origin` header (for example from a command-line client): it is
  served normally, since cross-origin rules apply to browsers.

## Requirements *(mandatory)*

### Functional Requirements

**Configuration**

- **FR-001**: The API MUST read every environment-dependent setting from a single centralized
  configuration source. Direct reads of raw environment variables outside that source MUST NOT
  remain in the codebase.
- **FR-002**: The API MUST validate its configuration at startup and MUST refuse to start when
  validation fails, exiting non-zero.
- **FR-003**: A configuration validation failure MUST name each offending setting and describe
  what was expected.
- **FR-004**: Configuration MUST cover, at minimum: the port the API listens on, the runtime
  environment name, the database file path, and the permitted frontend origin.
- **FR-005**: The repository MUST contain an example environment file listing every setting with a
  safe local value or an explanatory placeholder, and it MUST NOT contain real secrets.
- **FR-006**: The real environment file MUST remain untracked by version control.

**Request validation**

- **FR-007**: The API MUST validate request inputs — body, query, and route parameters — against
  declared schemas, using one validation mechanism applied application-wide.
- **FR-008**: A request that fails validation MUST receive HTTP 400 and MUST NOT reach its
  handler.
- **FR-009**: A validation failure response MUST identify which inputs failed and why.

**Error handling**

- **FR-010**: Every error response MUST use one consistent body shape, applied by a single
  application-wide mechanism.
- **FR-011**: An error raised with a specific HTTP status MUST retain that status in the response.
- **FR-012**: An unexpected error MUST produce HTTP 500 with a generic message, and MUST NOT
  expose a stack trace, source path, internal exception message, or configuration value.
- **FR-013**: An unexpected error MUST be logged at error level with its full detail, including
  the stack, using the framework's logging facility.
- **FR-014**: Expected errors (validation failures, and errors raised with a specific status) MUST
  NOT be logged at error level, so that the error log stays a signal of real faults.

**Persistence**

- **FR-015**: The API MUST provide a single database connection, available to other parts of the
  application through the framework's dependency injection.
- **FR-016**: The database file path MUST come from configuration.
- **FR-017**: A relative database path MUST resolve against a fixed anchor in the repository, not
  against the process working directory, so the same path resolves identically regardless of where
  the process was started.
- **FR-018**: The database file and any missing parent directory MUST be created on first start.
- **FR-019**: Data written through the connection MUST still be present after the API is stopped
  and restarted.
- **FR-020**: The connection MUST be closed as part of application shutdown.
- **FR-021**: BE-01 MUST NOT define any application table, migration, or seed data. Tables belong
  to the spec that needs them.

**Cross-origin access**

- **FR-022**: The API MUST permit browser requests from one explicitly configured frontend origin,
  and MUST NOT permit a wildcard origin.
- **FR-023**: The cross-origin configuration MUST permit credentials, so that BE-02's
  cookie-based session works without a change to this configuration.
- **FR-024**: Requests from origins other than the configured one MUST NOT be permitted.

**Preserved behaviour**

- **FR-025**: `GET /health` MUST continue to return HTTP 200 with `{"status":"ok"}`.
- **FR-026**: The existing application scaffold, its HTTP platform adapter, its module layout, and
  its existing per-application scripts MUST be preserved rather than replaced.
- **FR-027**: The root-level scripts and the package manager MUST remain unchanged.

**Documentation**

- **FR-028**: The repository MUST document the required runtime version, the install command, the
  environment-file setup step, the start command, and how to verify the API is running.
- **FR-029**: The documented setup MUST require no cloud account, API key, or paid service.

**Testing**

- **FR-030**: ~~Error-path behaviour MUST be verified through isolated tests.~~ **Amended
  2026-09-09 at the owner's direction**: the backend carries no test suite. Error-path behaviour is
  verified by running the documented manual checks instead. Permanent test or debug routes MUST
  still NOT be added to the API.

### Key Entities

Not applicable. BE-01 introduces the database connection but no domain entities; every table
belongs to the later spec that needs it (FR-021).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer with the documented runtime installed goes from clean checkout to a
  successful health-check response in under five minutes, following only the README.
- **SC-002**: Install and build both complete with zero errors and with no flag used to suppress
  a dependency conflict.
- **SC-003**: 100% of settings the API depends on are declared in the example environment file.
- **SC-004**: Every one of the three error classes — rejected input, known error with a status,
  and unexpected error — returns a body with the identical field set, verified by manual check.
- **SC-005**: Zero unexpected-error responses expose a stack trace, file path, internal message,
  or configuration value, verified by manual check.
- **SC-006**: 100% of unexpected errors produce a corresponding error-level log entry.
- **SC-007**: A value written before a restart is readable after it, in 100% of restart attempts.
- **SC-008**: A relative database path resolves to the same file when the API is started from the
  repository root and from the API application directory.
- **SC-009**: The configured frontend origin is permitted with credentials and a different origin
  is not, verified by manual check.
- **SC-010**: The API adds zero endpoints beyond the existing health check.

## Out of Scope

Explicitly excluded from BE-01. Each belongs to a later spec or to no spec at all:

- Authentication endpoints, user records, sessions, password hashing, and account seeding
  (BE-02).
- Upload endpoints and spreadsheet parsing (BE-03).
- Business calculations, margin logic, and reporting endpoints (BE-03).
- Any change to `apps/web`.
- API schema documentation (OpenAPI/Swagger).
- An ORM or query builder, Docker, Redis, queues, microservices, and custom orchestration
  scripts.
- Any change to the package manager or to the root-level scripts.
- Placeholder services, routes, or database tables anticipating a later spec.

## Assumptions

- The reviewer runs on macOS with the Node version pinned in the repository and the pinned pnpm
  version available; the exercise brief states the project must run locally on a Mac.
- The frontend runs at `http://localhost:3000` and the API at `http://localhost:4000`, matching
  the existing project rules; both are configurable.
- A single local SQLite file is sufficient persistence for this exercise; no multi-user or
  concurrent-writer scenario is in scope.
- One frontend origin is enough. A list of permitted origins is not needed for a locally run
  exercise.
- The error body shape is a fixed, small set of fields chosen in the plan; consumers depend on the
  field set being consistent, not on any particular field name, so the plan may choose names.
- Structured/JSON log output is not required; the framework's default logger is sufficient for a
  locally run exercise.
- BE-02 will use cookie-based sessions, which is why credentialed cross-origin access is
  configured now rather than later.

## Dependencies

- BE-01 depends on no other spec. BE-02 and BE-03 both depend on BE-01.
- The existing scaffold in `apps/api` (application module, health controller, build/start/test
  scripts) is the starting point and is preserved.
- Third-party libraries required to satisfy these requirements are selected and version-verified
  during planning, not here.
