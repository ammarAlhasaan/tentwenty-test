# Tasks: Frontend Simplification and Design Fidelity (FE-04)

**Branch**: `008-frontend-simplification`

Findings referenced as `review.md` ids. `[x]` is set only after the change is
made and, where a task names a check, after that check has actually been run.

## Phase 1 — Behaviour and design fidelity

- [ ] **T001** [A1] `components/period-filter.tsx`: when the selected month is
  not among the year's covered months, render it as a disabled option rather
  than letting the select fall back to "Whole year".
- [ ] **T002** [A2] `components/data/upload-card.tsx`: clear the staged file in
  the mutation's `onSuccess` only, so a rejected or unconfirmed import keeps the
  file and the year.
- [ ] **T003** [A3] `app/(app)/loading.tsx`: replace the dashboard-shaped
  skeleton with a shape-neutral one, since it covers all six screens.
- [ ] **T004** [G2] `components/page-header.tsx`: add `badge?: string`, rendered
  as the design's chip beside the title.
- [ ] **T005** [G2] `components/period-scope.tsx`: return the period label as
  `badge`; pass it from the five period-scoped views.
- [ ] **T006** [G3] `components/empty-state.tsx`: let the action slot hold two
  buttons (`flex flex-wrap justify-center gap-2`).
- [ ] **T007** [G3] `components/period-scope.tsx`: `NoDataYet` offers "Load the
  sample workbooks" via the existing `useLoadSampleData`, keeps "Go to uploads"
  as secondary, and renders a failure notice beside the empty state.
- [ ] **T008** [G1] `components/completeness-notice.tsx`: add an action leading
  to `/uploads`.

## Phase 2 — Paint and perceived speed

- [ ] **T009** [C2] `app/(app)/layout.tsx` and `components/auth-gate.tsx`: move
  the sidebar, header and nav outside the gate; `AuthGate` wraps `<main>` only.
  Redirect, error state and expiry marker unchanged.
- [ ] **T010** [C3] `lib/analytics.ts`: `placeholderData: keepPreviousData` on
  the reporting queries.
- [ ] **T011** [C3] `lib/analytics.ts`: a longer `staleTime` for reporting
  queries, leaving the global default and `["auth","me"]` alone.

## Phase 3 — Simplification

- [ ] **T012** [B4] `lib/analytics.ts`: one `usePeriodQuery<T>` for the five
  period-scoped endpoints; `usePeriods` and `useProject` stay explicit; delete
  `fetchPeriods`, `fetchDashboard`, `periodsQueryOptions`,
  `dashboardQueryOptions`.
- [ ] **T013** [B3] `lib/analytics.ts`: one `PeriodDescriptor`, used by all five
  responses.
- [ ] **T014** [B8] `lib/analytics.ts`, `lib/imports.ts`: delete response fields
  the frontend does not render.
- [ ] **T015** [B1] `components/productivity/productivity-view.tsx`: the footer
  reads `companyProductivity` regardless of the department filter.
- [ ] **T016** [B5] `components/dashboard/dashboard-view.tsx`:
  `DashboardViewFallback` composes `DashboardSkeleton`.
- [ ] **T017** [B5, B6] `components/period-scope.tsx`: use `TableSkeleton` and
  `QueryError` instead of a bespoke skeleton and a duplicated sentence.
- [ ] **T018** [B7] `components/ui/table.tsx`: add `TablePanel`; replace the
  eight `<Card className="py-0">` + `<CardHeader className="px-5 pt-5">` pairs.
- [ ] **T019** [B8] Delete `formatHours`, `isAbsent`, the `export` on
  `NoDataYet`, the unused `signedIn`/`periods` returns, and the dead `mine`
  guard.
- [ ] **T020** [C4] Memoise the productivity department list and totals and the
  projects totals; move the departments early-exit above the two `find`s; hoist
  one module-level `Intl.DateTimeFormat` for the import history.
- [ ] **T021** [C5] Move `shadcn` to `devDependencies`.

## Phase 4 — Verification (Constitution VIII)

- [ ] **T022** `pnpm --filter web exec tsc --noEmit`
- [ ] **T023** `pnpm --filter web lint`
- [ ] **T024** `pnpm --filter web build`
- [ ] **T025** Walk all six screens plus a project page against the running API
  with the sample workbooks loaded; compare figures to the contract. The
  analytics rewrite touches every query key, and a wrong key serves the wrong
  period silently.
- [ ] **T026** Behaviour checks: uncovered period by URL; rejected upload keeps
  its file; empty database filled from the Dashboard's own button; partial
  completeness notice and its action; period change keeps the previous table;
  shell paints before `/auth/me` answers.
- [ ] **T027** Authentication regression: sign in, sign out, `returnTo`, and an
  in-session expiry.
- [ ] **T028** 375px pass for horizontal overflow on every screen.
- [ ] **T029** Record every command's real output in `quickstart.md`.
