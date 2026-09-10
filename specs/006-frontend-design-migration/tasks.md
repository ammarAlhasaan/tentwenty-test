# Tasks: Frontend Design Migration (FE-03)

**Branch**: `006-frontend-design-migration`

Ordered by dependency. `[x]` is set only after the change is made and, where a task names a check,
after that check has actually been run.

## Phase 1 — Foundation (blocks everything)

- [x] **T001** Add the design's tokens to `apps/web/app/globals.css`: brand indigo scale, ink
  scale, surface/line colours, warning, and the design's radii and card shadows. Expose them
  through `@theme inline`. Re-point `--positive`/`--negative` at the design's good/negative and
  record the measured contrast ratios in a comment.
- [x] **T002** Swap Geist for DM Sans / DM Mono in `apps/web/app/layout.tsx` via `next/font/google`,
  keeping the `--font-sans` / `--font-mono` / `--font-heading` variable wiring.
- [x] **T003** Extend `apps/web/lib/format.ts`: `formatShare` (unsigned, for productivity) beside
  the existing signed `formatPercent` (margin), and `formatNumber` for bare hour counts. Keep the
  em-dash-for-absent rule.

## Phase 2 — Shared UI (blocks the screens)

- [x] **T004** Restyle `components/ui/card.tsx` surface to the design's card (line border, card
  shadow, 18px radius).
- [x] **T005** Restyle `components/ui/button.tsx` variants to the design's `.btn` / `.btn-a`.
- [x] **T006** Add `components/notice.tsx` — the design's `.banner`, with `info` / `warning` /
  `danger` / `success` tones, optional action, correct `role` per tone.
- [x] **T007** Add `components/missing-value.tsx` — the em dash with its accessible label, and use
  it from the formatters' call sites.
- [x] **T008** Restyle `components/empty-state.tsx` to the design's `.empty` (glyph tile, larger
  title) and give it an optional action.
- [x] **T009** Restyle `components/error-state.tsx` to match, keeping its retry contract.
- [x] **T010** Restyle `components/stat-card.tsx` to the design's `.kpi` and add the optional
  `share` bar.
- [x] **T011** Add `components/page-header.tsx` — title, description and an optional right slot,
  replacing the heading block copy-pasted into four pages.

## Phase 3 — Shell

- [x] **T012** Restyle `components/app-nav.tsx` to the design's nav (indigo current-state pill,
  group label on the rail), keeping the `rail`/`bar` split and exact-match logic.
- [x] **T013** Restyle `components/user-menu.tsx` to the design's `.side-foot` (avatar, name,
  email, sign-out), keeping the logout mutation, error state and disabled handling untouched.
- [x] **T014** Rebuild `app/(app)/layout.tsx` as the design's shell: brand sidebar at `lg`,
  scrollable section bar below it, sticky header, skip-to-content link. `AuthGate` stays the
  outermost element. Sign-out is placed so it survives at 390px.
- [x] **T015** Update `app/(app)/loading.tsx` and `app/loading.tsx` skeletons to the new shapes.
- [x] **T016** Restyle `app/not-found.tsx` in the design's empty-state language.

## Phase 4 — Dashboard

- [x] **T017** Add `apps/web/lib/sample-dashboard.ts`: one frozen literal shaped like 004's
  documented `GET /dashboard` response, plus the one covered period. Every derived figure a
  literal; no arithmetic. Header comment states why it exists and how it is removed.
  *(Superseded by T029–T031 once 004 landed; the file is deleted.)*
- [x] **T018** Add `components/dashboard/verdict-banner.tsx` — the purple profit/loss banner with
  `profit` / `loss` / `unknown` tones.
- [x] **T019** Add `components/period-filter.tsx` — year/month selects writing `?year=&month=` via
  `router.replace`, driven by a passed-in list of available periods.
- [x] **T020** Rewrite `app/(app)/page.tsx` as a server shell (metadata + `Suspense`) around a new
  client `components/dashboard/dashboard-view.tsx` holding the sample notice, the banner, the five
  metrics and the out-of-range empty state. Placeholder Projects table deleted, and with it
  `components/ui/table.tsx`, whose only consumer it was (Constitution II — it returns when a screen
  actually needs a table).

## Phase 5 — Remaining screens

- [x] **T021** Restyle `app/(app)/projects`, `productivity`, `categories` onto `PageHeader` +
  restyled `EmptyState`, with copy naming what will appear once data is ingested.
- [x] **T022** Restyle `app/(auth)/login/page.tsx` into the design's split layout and
  `components/login-form.tsx` into the design's form, changing markup only — mutation, error
  handling, `returnTo` and expiry notice untouched. No demo-credentials hint.

## Phase 6 — Verification (Constitution VIII)

- [x] **T023** `pnpm --filter web exec tsc --noEmit`
- [x] **T024** `pnpm --filter web lint`
- [x] **T025** `pnpm --filter web build`
- [x] **T026** Render the prototype and the application side by side at 1440x900 and 375x812;
  captured for the Dashboard and sign-in on both.
- [x] **T027** Exercise in the browser: sign-in with wrong then correct credentials, section
  navigation, period filter including an uncovered period, sign-out at 375px, and the network panel
  confirming no assessment endpoint is requested. Two states could not be reached from an
  automation tab that never becomes visible — recorded in `quickstart.md` under "Not verified".
- [x] **T028** Record every command's real output in `quickstart.md`.

## Phase 7 — Real integration (added mid-implementation)

`004-assessment-backend` merged to `main` as PR #4 (`5e4fd9a`) while Phase 6 was running, so the
deferred integration became possible and was taken.

- [x] **T029** Rebase the branch onto the new `main`. Reset the local SQLite file and run
  `prisma migrate deploy` — 004 moved the API to Prisma, and the pre-Prisma dev database fails
  baselining (`P3005`).
- [x] **T030** Add `apps/web/lib/analytics.ts` per README section 10: duplicated `PeriodsResponse`
  and `DashboardResponse` types, `fetchPeriods` / `fetchDashboard` through `apiFetch` with `signal`
  forwarded, `["analytics", …]` keys, and `enabled` from the resolved authenticated state.
- [x] **T031** Point `PeriodFilter` at `GET /periods` (real years and months, plus the contract's
  optional `month` as "Whole year") and `DashboardView` at `GET /dashboard`. Handle pending, error,
  no-data-ingested, period-not-covered and partial-completeness. Delete `lib/sample-dashboard.ts`.
- [x] **T032** Make the banner's sentence follow the period's scope — "this month" is false for a
  whole-year view.
- [x] **T033** Re-run `tsc --noEmit`, `lint` and `build`; re-verify in the browser against the API
  with the supplied workbooks loaded, and against an empty database.

## Phase 8 — Review follow-up: the remaining screens

Review of `92d35f0` found four things: three reporting screens still rendered a permanent empty
state, a new user could not load data without a terminal, the year could strip a selected month,
and `/periods` warnings were shown outside the scope they describe. All four are addressed here.

- [x] **T034** Extend `lib/analytics.ts` with `/projects`, `/projects/:refCode`, `/departments`,
  `/productivity` and `/categories` — duplicated types, `signal` forwarded, `enabled` gating.
- [x] **T035** Add `lib/settings.ts` (`GET`/`PUT /settings`) and `lib/imports.ts`
  (`GET /imports`, the three multipart uploads, `POST /imports/sample`). Both mutations stamp the
  session and invalidate `["analytics"]` on success.
- [x] **T036** Restore `components/ui/table.tsx` in the design's styling — six screens need it now.
  Add `components/pill.tsx` (percent pill, tag, share bar) and `components/query-states.tsx`.
- [x] **T037** Add `components/period-scope.tsx`: the loaded periods, the URL-backed selection, the
  filter, and the shared pending / error / no-data / not-covered states.
- [x] **T038** **[P2-3]** Make a year change keep the month only when the new year holds it, and
  otherwise fall back to the whole year.
- [x] **T039** **[P2-4]** Move the standing `/periods` warnings to the uploads screen and show the
  period's own `completeness.issues` on each period-scoped screen, via `CompletenessNotice`.
- [x] **T040** Build the Projects list and the per-project page (price, month-by-month split,
  departments, per-employee contribution, unpriced and cost-partial states).
- [x] **T041** Build Departments with its nested people drill-down, and Productivity with its
  department filter.
- [x] **T042** Build Categories: billable/internal split, share bars, and the direct-cost note.
- [x] **T043** **[P1-2]** Build the Uploads screen: three drop targets wired to the real multipart
  endpoints, a "Load the sample workbooks" button, import history, and per-import results.
- [x] **T044** Build Assumptions: overhead and billable categories, validated inline, saved through
  `PUT /settings`.
- [x] **T045** Add Departments, Uploads and Assumptions to `AppNav` (in the design's two groups)
  and to `safeReturnTo`.
- [x] **T046** Re-run `tsc --noEmit`, `lint` and `build`; verify every screen in the browser
  against the running API, including an empty database, the sample-load button, a real multipart
  upload, a rejected upload, and a saved assumption changing the reported figures.
