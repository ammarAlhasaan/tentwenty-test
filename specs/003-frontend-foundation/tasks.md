# Tasks: FE-01 — Frontend Foundation

**Feature**: `003-frontend-foundation` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]** — no file overlap with another `[P]` task in the same phase; may run in parallel.
- **[US#]** — the user story from spec.md that the task serves.

## Path Conventions

All paths are relative to the repository root of this worktree
(`/Users/ammaralhasan/Documents/claude-worktree/tentwenty-test/frontend-foundation`). Every source
path is under `apps/web/`.

## No tests

There are no test tasks in this plan, by requirement FR-026 and at the owner's direction. Do not
add a test file, a testing dependency, a mock, a fixture, a test configuration or a test script at
any point in these tasks. Verification is T023 – T029.

---

## Phase 1: Setup

- [x] **T001** Confirm the working tree is the `003-frontend-foundation` worktree on branch
  `003-frontend-foundation`, and that `git status` is clean apart from this spec directory and
  `.specify/`. Do not touch the `authentication` or `backend-foundation` worktrees.
- [x] **T002** Run `pnpm install --frozen-lockfile` from the repository root. If it fails because
  the lockfile is out of date, stop and report — do not regenerate the lockfile (FR-024).
- [x] **T003** Record the pre-change baseline: `pnpm --filter web lint`, `pnpm --filter web exec tsc
  --noEmit`, `pnpm --filter web build`. Keep the output. A failure that already exists on `main` is
  not introduced by this spec, and knowing that later is worth two minutes now.

---

## Phase 2: Foundational (blocking prerequisites)

Everything in Phase 3 onwards imports from this phase.

- [x] **T004** Add `--positive` and `--negative` to both `:root` and `.dark` in
  `apps/web/app/globals.css`, and surface them in the existing `@theme inline` block as
  `--color-positive` / `--color-negative`. Do not rename, remove or re-value any existing token —
  **with the single exception in T004a**. (FR-007, FR-008)

- [x] **T004a** Repair the broken sans font binding in the same `@theme inline` block — the one
  permitted change to an existing token, per research.md Decision 8:

  ```css
  --font-sans: var(--font-geist-sans);     /* was: var(--font-sans) — self-referential */
  --font-heading: var(--font-geist-sans);  /* was: var(--font-sans) — chained off the same break */
  ```

  `app/layout.tsx` loads Geist as `--font-geist-sans`, so today `html { @apply font-sans }` inherits
  nothing and the document falls back to the browser default. Change these two lines and no others.
  After the change, confirm in devtools that `html` computes to Geist rather than a system font —
  without that check the fix is unverified. (FR-007)
- [x] **T005** Verify the two new colours against the surfaces they sit on, in both schemes, at
  WCAG 2.1 AA. Adjust the values, not the requirement. (FR-012)
- [x] **T006** [P] Create `apps/web/lib/format.ts` exporting `formatCurrency` (AED, 0 fraction
  digits), `formatHours` (1 decimal) and `formatPercent` (1 decimal, signed), each built on
  `Intl.NumberFormat`. Each returns an em dash for `null`/`undefined` and a formatted zero for `0`.
  (FR-010)
- [x] **T007** Snapshot the dependency files **before** invoking the generator, so T009 can restore
  the exact pre-generation state rather than some other branch's state:

  ```bash
  mkdir -p .fe01-depsnap
  cp apps/web/package.json pnpm-lock.yaml .fe01-depsnap/
  ```

  `.fe01-depsnap/` is a scratch directory for the duration of T007 – T009 and is deleted in T009.
  Do not commit it.

- [x] **T008** Generate the four UI primitives with the already-installed CLI, against the
  configured `base-nova` style: `pnpm --filter web exec shadcn add button card table skeleton`.
  This writes `apps/web/components/ui/{button,card,table,skeleton}.tsx`. (FR-014)
- [x] **T008a** Adjust the generated `table.tsx` so the table sits inside an `overflow-x-auto`
  container and header cells carry `scope`. Change nothing else the generator produced. (FR-015)

### Dependency guard — must pass before Phase 3

- [x] **T009** Compare the dependency files against the T007 snapshot — **not** against `main`,
  which can move underneath this branch while BE-02 merges:

  ```bash
  diff -u .fe01-depsnap/package.json apps/web/package.json
  diff -q .fe01-depsnap/pnpm-lock.yaml pnpm-lock.yaml
  ```

  **Both must report no difference.** If they do, delete `.fe01-depsnap/` and continue.

  If either differs, the generator pulled in a package. Do not install it on this branch, and do not
  reach for `--force` or `--legacy-peer-deps` (Constitution Principle VII, FR-024):

  1. Identify which package was added and which primitive imports it.
  2. **Delete the generated files that import it.** Leaving the source in place with an unresolvable
     import would break the build for everyone on the branch and disguise a missing dependency as a
     TypeScript error — worse than not having the component. Deleting it makes the gap explicit.
  3. Restore the dependency files from the snapshot, so the branch returns to its own
     pre-generation state and inherits nothing from elsewhere:

     ```bash
     cp .fe01-depsnap/package.json apps/web/package.json
     cp .fe01-depsnap/pnpm-lock.yaml pnpm-lock.yaml
     pnpm install --frozen-lockfile
     ```

  4. Append the package name, its version, and the primitive that needed it to the **Coordination
     note** in `plan.md`.
  5. Report it and stop. A deleted primitive blocks the tasks that render it — say which, rather
     than substituting an improvised replacement.
  6. Delete `.fe01-depsnap/`.

**Checkpoint**: tokens, formatters and primitives exist; the lockfile is provably untouched.

---

## Phase 3: User Story 2 — Navigation and shell (Priority: P1) 🎯 MVP

Ordered before User Story 1 because the shell is what US1 renders inside. Delivered together, they
are the MVP.

- [x] **T010** [US2] Create `apps/web/components/app-nav.tsx` as a Client Component. List the four
  sections — Dashboard `/`, Projects `/projects`, Productivity `/productivity`, Categories
  `/categories` — in this file and nowhere else. Read `usePathname()`; set `aria-current="page"` on
  the match, using an exact match for `/` and `startsWith` for the other three. Convey current
  state by weight and a rule, not by colour alone. Accept a prop for the two presentations (rail,
  header row). (FR-002, FR-003, FR-011)
- [x] **T011** [US2] Rewrite `apps/web/app/layout.tsx` as the shell: keep `html`/`body`, the Geist
  variables and `<Providers>`; add a header naming the product, `<nav aria-label="Sections">`
  rendering `AppNav` as a `md:`-and-up side rail and as a scrollable row in the header below `md`,
  and `<main>` for the page. Replace the starter `metadata` with a real title carrying a
  `title.template`, plus a description. (FR-001, FR-005, US3-1, US3-2)
- [x] **T012** [US2] Create `apps/web/app/not-found.tsx`: a heading, a short explanation, and a
  `Button` linking to `/`, rendered inside the shell. (FR-006)

**Checkpoint**: all four sections navigate within one shell, current state is correct and
announced, and an unmatched URL is handled. (US2 acceptance scenarios 1 – 5)

---

## Phase 4: User Story 1 — The dashboard first impression (Priority: P1) 🎯 MVP

Depends on Phase 3 (shell) and Phase 2 (card, table, formatters).

- [x] **T013** [P] [US1] Create `apps/web/components/stat-card.tsx`: a `Card` presenting one
  labelled headline figure, with the value in `tabular-nums`, and optional positive/negative
  emphasis using the T004 tokens. (FR-009, FR-020)
- [x] **T014** [US1] Rewrite `apps/web/app/page.tsx` as the dashboard: a page heading, the
  persistent placeholder notice, five `StatCard`s (total hours, billable hours, cost, revenue,
  margin), and one project-level table of six rows. Sample values are literals directly above the
  markup, marked as placeholders — not exported, not moved to a fixture, not
  shaped like an API response. Format every number through `lib/format.ts`; right-align and
  `tabular-nums` every numeric column. Export the section `metadata`. (FR-009, FR-020, FR-021)
- [x] **T015** [US1] Delete the now-unused starter assets: `apps/web/public/next.svg`,
  `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`. Confirm nothing references them.

**Checkpoint**: the root URL shows a dashboard a reviewer would keep open, and is honest about its
figures. (US1 acceptance scenarios 1 – 5)

---

## Phase 5: User Story 4 — Honest empty states (Priority: P2)

Depends on Phase 3 (shell) and Phase 2 (card).

- [x] **T016** [US4] Create `apps/web/components/empty-state.tsx`: a `lucide-react` icon, a real
  heading element, and a description, centred in a `Card`. Wording comes from props. No action
  control, because there is no action to offer yet. (FR-016, FR-022)
- [x] **T017** [P] [US4] Create `apps/web/app/projects/page.tsx` — section heading, `metadata`, and
  `EmptyState` worded for projects (what the section will show once spreadsheets are ingested).
- [x] **T018** [P] [US4] Create `apps/web/app/productivity/page.tsx` — the same, worded for
  productivity.
- [x] **T019** [P] [US4] Create `apps/web/app/categories/page.tsx` — the same, worded for
  categories.

**Checkpoint**: three sections state plainly that there is no data yet, without pretending to be
broken and without offering a control that does nothing. (US4 acceptance scenarios 1 – 3)

---

## Phase 6: User Story 5 — Loading and error boundaries (Priority: P3)

Depends on Phase 3 (shell) and Phase 2 (skeleton, button).

- [x] **T020** [P] [US5] Create `apps/web/app/loading.tsx`: `Skeleton` blocks in roughly the shape
  of the dashboard — a heading bar, five cards, a table. Any pulse must respect
  `prefers-reduced-motion`. (FR-013, FR-017)
- [x] **T021** [US5] Create `apps/web/components/error-state.tsx` as a Client Component: a heading,
  a plainly worded message, and a `Button` calling an `onRetry` prop. Do not render `error.message`
  or `error.stack` to the reader. (FR-016, FR-018)
- [x] **T022** [US5] Create `apps/web/app/error.tsx` as a Client Component with props
  `{ error, retry }`, following the documentation shipped with this Next.js version (research.md
  Decision 1). Log the error to the console in an effect; render `ErrorState` with
  `onRetry={retry}`. (FR-018, FR-019)

**Checkpoint**: a pending segment shows a shaped skeleton, and an uncaught failure is recoverable.
(US5 acceptance scenarios 1 – 4)

---

## Phase 7: Verification

No task in this phase writes application code. Report real output only (Constitution Principle
VIII).

- [x] **T023** Run `pnpm --filter web lint`. Fix every error and warning; re-run.
- [x] **T024** Run `pnpm --filter web exec tsc --noEmit`. Fix every error; re-run.
- [x] **T025** Run `pnpm --filter web build`. Fix every error and warning; re-run.
- [x] **T026** Work through [quickstart.md](./quickstart.md) sections A – H in a browser, filling in
  the Result column of every row. Sections F and G are the ones most easily skipped and least
  easily recovered later; do not skip them. Confirm the F2/F6 reverts.
- [x] **T027** Confirm the boundary against this branch's base, not against a moving `main`:

  ```bash
  git diff --stat "$(git merge-base HEAD main)"
  ```

  Changes must appear only under `apps/web/`, `specs/003-frontend-foundation/` and `.specify/`. No
  `apps/api` file, no root config, no root `README.md`, no `pnpm-lock.yaml`, no test file, no new
  script. Confirm `.fe01-depsnap/` is gone. (FR-024, FR-026, SC-007, SC-008)
- [x] **T028** If `apps/web/AGENTS.md` reappears as an uncommitted change, commit it with the work
  — `next dev` rewrites it, and leaving it out only recreates the diff.
- [x] **T029** Leave the root `README.md` alone. If this spec's work makes something in it stale,
  record that in the **Coordination note** in `plan.md` for the owner to fold in once the parallel
  branches have landed. Documentation belonging to this spec lives in
  `specs/003-frontend-foundation/`; documentation belonging to the frontend lives under `apps/web/`.
  Editing a root file for a documentation-only reason is the overlap FR-024 and SC-007 exist to
  prevent.

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 (Setup)
   └─> Phase 2 (Foundational) ─── T009 guard ───┐
                                                 v
                              Phase 3 (US2 — shell + nav)  ← blocks everything below
                                                 │
                    ┌────────────────┬───────────┴───────────┐
                    v                v                       v
            Phase 4 (US1)     Phase 5 (US4)           Phase 6 (US5)
                    └────────────────┴───────────┬───────────┘
                                                 v
                                      Phase 7 (Verification)
```

### User story dependencies

- **US2 (navigation)** — depends only on Phase 2. Delivers the shell.
- **US1 (dashboard)** — depends on US2 for the shell it renders inside.
- **US4 (empty states)** — depends on US2 only. Independent of US1.
- **US3 (responsive)** — no phase of its own. It is a property of T011, T014 and T016 as written,
  and is verified in quickstart section D.
- **US5 (loading/error)** — depends on US2 only. Independent of US1 and US4.

### Parallel opportunities

Within Phase 2: T006 and T007 touch different files.

After Phase 3's checkpoint, Phases 4, 5 and 6 touch disjoint files and can proceed together:

```text
T013 + T014 + T015   (US1 — page.tsx, stat-card.tsx, public/)
T016 → T017 + T018 + T019   (US4 — empty-state.tsx, three page.tsx)
T020 + T021 → T022   (US5 — loading.tsx, error-state.tsx, error.tsx)
```

`T017`, `T018` and `T019` are three separate files and are fully parallel once T016 exists.

---

## Implementation Strategy

**MVP is Phases 1 – 4.** A shell, working navigation and a dashboard that looks finished and is
honest about its data is a reviewable, demonstrable slice on its own.

**Then Phase 5**, which makes the other three sections real rather than empty routes.

**Then Phase 6**, which is invisible until something goes wrong — and is the reason nothing will be
a white screen when FE-02 introduces the first real request.

Stop at any checkpoint and the branch is still coherent. Do not begin the next frontend spec's code
before this one is verified and reviewed (Constitution Principle VI).
