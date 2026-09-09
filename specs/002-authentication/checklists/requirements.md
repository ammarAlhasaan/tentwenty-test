# Specification Quality Checklist: BE-02 — Authentication

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-09
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — see Notes
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders — see Notes
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Testing Posture

- [x] The spec requests **no** automated tests, test framework, test file, mock, fixture, test
      configuration, or test script (FR-033)
- [x] Every acceptance scenario is written as a **manual** verification step, executable from
      [quickstart.md](../quickstart.md)
- [x] Deferral of automated backend testing is recorded once, briefly, rather than repeated
- [x] No task in [tasks.md](../tasks.md) implements an automated test; T044 audits that this stayed
      true
- [x] No permanent debug or test-only route is requested to make verification possible

## Notes

- **Content Quality, items 1 and 3 — qualified pass.** BE-02 has a genuine end user (someone signing
  in), so the user stories read as user journeys. But three externally observable technical terms are
  unavoidable in the requirements and success criteria: HTTP status codes, `GET /health` (a
  contract BE-01 already fixed), and the notion of a cookie. These are the observable contract the
  spec must pin down, not implementation choices. Every library name, version, file path, table
  name, column name, and framework term was pushed into [plan.md](../plan.md),
  [research.md](../research.md), [data-model.md](../data-model.md), and
  [contracts/auth.md](../contracts/auth.md). The requirements say "a memory-hard password hashing
  function with a per-password salt" (FR-003), not "Argon2id via `@node-rs/argon2`"; they say "a
  state-changing request that declares an origin other than the configured frontend origin MUST be
  refused" (FR-025), not "an `OriginCheckGuard` registered as `APP_GUARD`".

- **Scope is bounded by exclusion as well as inclusion.** FR-030 and § Out of Scope name the
  authentication features this spec deliberately does not build. This matters more than usual here:
  the assessment brief does not ask for authentication at all, so an unbounded reading of "add auth"
  could consume the whole remaining time budget. The exclusions are requirements, not commentary.

- **Two requirements exist to prevent a specific, likely defect**, and are worth keeping even though
  they read as unusually prescriptive for a spec:
  - **FR-008 / SC-002** (byte-identical refusals) — the natural implementation returns "user not
    found" and "wrong password" separately, which leaks account existence.
  - **FR-018 / SC-005** (replaying a captured cookie is refused) — the natural implementation clears
    the browser cookie and leaves a valid server-side session behind. The acceptance scenario is
    written around *capturing the cookie before logout* precisely because a check that only inspects
    the browser would pass against the broken implementation.

- **FR-022 is a scope guard, not a design note.** Adding a dummy protected endpoint to demonstrate the
  guard is the obvious thing to do and would violate Constitution Principle II. The current-user
  endpoint is the guard's real first consumer, so no placeholder is needed.

- **Open decisions, resolved at review on 2026-09-10.** The demo user is seeded at first local start;
  session lifetime is 12 hours with a sliding window; the custom session store is approved on condition
  that callbacks, errors and expiry are handled explicitly, with no line-count constraint. The spec
  itself states only the *requirements* (FR-027, FR-028) and leaves the mechanism to
  [research.md](../research.md) Decision 6. One implementation risk remains open — `express-session` on
  Express 5 is untested upstream — and is gated by task T012 before any dependent work proceeds.

- **Verification must not touch project data.** Every check in [quickstart.md](../quickstart.md) runs
  against a dedicated `verify-be02.sqlite` inside this worktree, with absolute paths and a fresh
  session per scenario. No check reads, writes, or deletes `margin.sqlite`.
