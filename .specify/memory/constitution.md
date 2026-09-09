<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - VI. One Spec At A Time → VI. One Spec Per Side At A Time (scope of the
    serialisation rule narrowed from the whole repository to one application)
- Added sections: none
- Removed sections: none
- Templates reviewed for consistency:
  - .specify/templates/plan-template.md — Constitution Check gate compatible, no edit needed
  - .specify/templates/spec-template.md — compatible, no edit needed
  - .specify/templates/tasks-template.md — compatible, no edit needed
- Follow-up TODOs: none
-->

# TenTwenty Margin Constitution

## Core Principles

### I. Simple, Conventional Code

Code MUST follow the standard conventions of the framework it lives in: NestJS modules,
providers, controllers, pipes, and filters in `apps/api`; Next.js App Router conventions in
`apps/web`. Where the framework documents a way to do something, that way is used. Custom
mechanisms MUST NOT replace a documented framework feature.

Rationale: an unfamiliar reader should be able to navigate the code using the framework's own
documentation, with no project-specific vocabulary to learn first.

### II. No Speculative Structure

The repository MUST NOT contain generic repositories, base classes, service interfaces with a
single implementation, dependency-injection indirection with one binding, empty folders, or
barrel files that exist only to re-export. A folder, abstraction, dependency, or script is added
only when a requirement in an approved spec calls for it.

Rationale: structure added in advance of a requirement is structure that is never validated
against a real need and must still be maintained.

### III. Comments Explain the Non-Obvious

Comments MUST explain why a non-obvious decision was made — a workaround, a domain rule, a
deliberate deviation. Comments that restate what the code already says MUST NOT be written.
Public behaviour that needs explanation is documented in the relevant `README.md`, not in a
comment block.

Rationale: comments that narrate the code go stale silently; comments that record intent stay
useful.

### IV. HTTP-Only Boundary (NON-NEGOTIABLE)

`apps/web` and `apps/api` MUST communicate exclusively over HTTP. There MUST be no shared
package, no shared TypeScript types, no shared validation schemas, and no shared runtime code
between the two applications. A type needed on both sides is duplicated in each application.

Rationale: the two applications are independently deployable and independently reviewable; a
shared package would couple their release cycles and let backend refactors break the frontend
build.

### V. One Side Per Spec

Every specification MUST target `apps/web` or `apps/api` exclusively. A spec that would require
changes in both applications MUST be split into a backend spec and a frontend spec, with the
backend spec landing first and defining the HTTP contract the frontend spec consumes.

Rationale: keeps each spec independently reviewable and keeps the HTTP contract explicit rather
than emergent.

### VI. One Spec Per Side At A Time

At most one `apps/api` spec and one `apps/web` spec are implemented at any given time, and each
MUST be implemented in its own git worktree on its own branch. Two specs on the *same* side MUST
NOT overlap: the earlier one's implementation MUST be complete, verified, and reviewed before the
next spec on that side begins. Planning artifacts for a later spec MAY be written earlier; code
for a later spec MUST NOT be.

A frontend spec running in parallel with a backend spec MUST NOT depend on that backend spec's
unlanded HTTP contract. Where it would, the integration is deferred to a later frontend spec and
recorded as deferred in the plan.

Rationale: Principles IV and V already guarantee that a frontend spec and a backend spec share no
files and no code, so serialising them across the whole repository buys no reviewability — it only
idles one side. Serialising *within* a side preserves the review checkpoint that matters, which is
between two changes to the same application.

### VII. Libraries That Remove Complexity

A third-party dependency is added when it removes meaningful complexity that would otherwise be
written and maintained by hand. Before adding one, its official documentation MUST be checked
against the installed framework and Node versions. Dependency conflicts MUST NOT be suppressed
with `--force`, `--legacy-peer-deps`, or equivalent; an unresolved conflict is reported and an
alternative is proposed instead.

Rationale: a suppressed peer-dependency conflict is an unverified runtime risk that surfaces
later, in a harder place to diagnose.

### VIII. Verified Results Only

Only results actually produced by a command that was run MAY be reported. Install, build, lint,
test, and manual endpoint checks MUST be executed before their outcome is stated. A check that
was skipped, was inconclusive, or failed MUST be reported as such, with its output.

Rationale: an unverified "passing" claim is worse than no claim, because it stops anyone else
from looking.

## Repository Boundaries

- `apps/web` — Next.js frontend, port 3000. Presentation and interaction only.
- `apps/api` — NestJS backend, port 4000. Calculation, validation, and persistence.
- React Query owns all API data in the frontend. Zustand holds shared UI state only, and MUST NOT
  duplicate API data.
- Root scripts stay minimal (`dev`, `build`). The package manager is pnpm; it MUST NOT be changed
  or supplemented without an amendment.
- The application MUST run locally from a clean checkout with a documented command, requiring no
  cloud account, API key, or paid service.

## Development Workflow

1. Amend the constitution first when a governing rule changes.
2. `/speckit-specify` — write the specification: user-visible behaviour, requirements, acceptance
   criteria. No implementation detail.
3. `/speckit-plan` — record the technical approach, verified dependency research with official
   documentation links, and the Constitution Check.
4. `/speckit-tasks` — produce dependency-ordered, actionable tasks including explicit verification
   tasks.
5. Human review of the artifacts before any implementation begins.
6. `/speckit-implement` — implement, then run the verification tasks and report their real output.

Template sections that do not apply to a given spec MUST be marked "Not applicable" with a short
reason, rather than filled with invented work.

## Governance

This constitution supersedes other working conventions in this repository. Where `AGENTS.md`,
`CLAUDE.md`, or a README conflicts with it, this document wins and the other file is corrected.

Amendments MUST be made by editing this file in its own change, stating the rationale, and
bumping the version:

- **MAJOR** — a principle is removed or redefined in a backward-incompatible way.
- **MINOR** — a principle or section is added, or its guidance is materially expanded.
- **PATCH** — wording, clarification, or typo fixes that do not change meaning.

Every spec's plan MUST include a Constitution Check. A deviation is allowed only when it is
recorded in that plan's Complexity Tracking table with the simpler alternative that was rejected
and why. An unrecorded deviation is a defect and blocks review.

**Version**: 1.1.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-09
