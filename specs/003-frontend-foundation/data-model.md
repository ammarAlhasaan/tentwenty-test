# Data Model: FE-01 — Frontend Foundation

**Not applicable.**

This spec defines no entity, no schema and no persisted structure, because it stores and reads
nothing:

- No database. `apps/api` owns persistence (Constitution, Repository Boundaries); this spec does
  not reach it.
- No client storage. No cookie, no `localStorage`, no `sessionStorage`, no IndexedDB.
- No fetched data. No HTTP request is issued (FR-023), so there is no response to model.
- No React Query cache entry. The provider is reused but no query is written (FR-025).
- No Zustand store. No shared UI state exists in this spec (FR-025).

The only structured values in the change are two component prop shapes and one array of sample
rows, all local to the file that renders them:

| Value | Where | Why it is not an entity |
|---|---|---|
| `StatCardProps` | `components/stat-card.tsx` | A component's props — presentation, not domain |
| `EmptyStateProps` | `components/empty-state.tsx` | As above |
| Dashboard sample rows | `app/page.tsx` | Literals rendered in place, deliberately not shaped like an API payload (see plan.md, "Sample data") |

The domain model of the Margin Dashboard — timesheet rows, salaries, project prices, cost rates —
is defined by the backend specs and reaches the frontend only through HTTP responses, which a later
frontend spec will type locally by duplication (Constitution Principle IV).
