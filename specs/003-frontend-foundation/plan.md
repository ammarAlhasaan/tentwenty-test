# Implementation Plan: FE-01 — Frontend Foundation

**Branch**: `003-frontend-foundation` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-frontend-foundation/spec.md`

## Summary

Replace the Next.js starter page in `apps/web` with the application shell the assessment screens
will live in, and nothing more. One root layout carrying a header and a four-item navigation; two
new colour tokens for signed figures; four UI primitives generated from the project's configured
shadcn style; two state components (empty, error); and the three route-level state files the App
Router provides (`loading`, `error`, `not-found`). Four routes exist: a dashboard rendering the
five headline figures as clearly labelled sample data, and three sections rendering the shared
empty state.

No request is made, no calculation is implemented, no store is created, no test is written, and no
file outside `apps/web` is touched except this spec's own artifacts and the constitution amendment
that permits it to run alongside BE-02.

Net addition: **13 new files, 4 modified, 5 deleted** (the unused starter SVGs). One pre-existing
defect is repaired in passing: the sans font token resolves to itself, so the app currently renders
in a system fallback rather than Geist (research.md Decision 8). **Zero new dependencies expected** —
with an explicit task that restores the branch's own pre-generation state and removes any component
it cannot satisfy, rather than quietly changing the shared lockfile or leaving a broken import.

Version verification and every non-obvious decision are in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3, `strict: true`, `jsx: react-jsx`, path alias `@/*` → app
root. Node `>=24.15.0` (root `engines`), pnpm 11.9.0.

**Primary Dependencies**: Next.js 16.3.4 (App Router), React 19.2.8, Tailwind CSS 4.3.3,
`@base-ui/react` 1.8.0 via the shadcn `base-nova` style, `class-variance-authority` 0.7.1, `cn`
0.2.6, `lucide-react` 1.43.0. `@tanstack/react-query` 5.102.8 is present and its provider is
reused unchanged; `zustand` 5.0.15 is present and deliberately unused. **New: none.**

**Storage**: Not applicable. This spec persists nothing — no database, no browser storage, no
cookie. See [data-model.md](./data-model.md).

**Testing**: None. No unit, integration or end-to-end test; no testing dependency, mock, fixture,
configuration or script (FR-026). This matches BE-01, whose suite was removed on 2026-09-09 at the
owner's direction. The gates are `eslint`, `tsc --noEmit`, `next build`, and the manual browser
checks in [quickstart.md](./quickstart.md).

**Target Platform**: Modern desktop and mobile browsers, served by `next dev` / `next start` on
port 3000, locally on macOS. No cloud account, API key or paid service.

**Project Type**: Web frontend — the `apps/web` half of a two-application repository. `apps/api` is
untouched by this spec.

**Performance Goals**: Not applicable. One local reader, no data, no request. No budget is set
because there is no measurement worth defending yet.

**Constraints**: `apps/web` only. No shared code, types or schemas with `apps/api`. No change to
root configuration, root scripts, `pnpm-workspace.yaml` or `pnpm-lock.yaml`. No new dependency
without coordination. No `--force` or `--legacy-peer-deps`. No HTTP request, no assessment maths, no
authentication behaviour. No placeholder code written for a later spec.

**Scale/Scope**: 4 routes, 4 UI primitives, 2 state components, 1 shell, 2 new design tokens.

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — see below.*

| Principle | Assessment |
|---|---|
| **I. Simple, Conventional Code** | PASS. Every file is an App Router convention read from the installed docs: `layout`, `page`, `loading`, `error`, `not-found`, folder-per-segment. Components sit in `components/`, the location `components.json` already declares. No project-specific mechanism is introduced. |
| **II. No Speculative Structure** | PASS. Each of the 13 new files is rendered or imported by something else in this spec — verified file by file in "Justification per new file" below. Deliberately *not* added: a route group, a Zustand store, an API client, an `env` module, filter controls, a project-detail route, an upload route, a barrel file, a `types/` folder. Each is recorded in "Deferred" with the trigger that would justify it. |
| **III. Comments Explain the Non-Obvious** | PASS. Comments are written where something is genuinely non-obvious to the next reader and nowhere else; no count is fixed in advance, and no comment restates code. |
| **IV. HTTP-Only Boundary** | PASS, trivially. This spec makes no HTTP call at all, and adds no shared package, type or schema. The AED formatter is frontend presentation, not a duplicated backend type. |
| **V. One Side Per Spec** | PASS. The diff is confined to `apps/web/`, this spec directory, and `.specify/memory/constitution.md`. |
| **VI. One Spec Per Side At A Time** | PASS **under the amendment this spec required**. The constitution was amended to 1.1.0 before planning began, narrowing serialisation from the repository to one application. FE-01 is the only frontend spec in flight; BE-02 is the only backend spec in flight; each has its own worktree and branch; they share no file. FE-01 depends on no BE-02 contract — see "Independence from BE-02". |
| **VII. Libraries That Remove Complexity** | PASS. No dependency is added. Every installed version above was read from the tree, and the framework documentation was read from the installed package. T009 aborts the change rather than installing a package mid-stream. |
| **VIII. Verified Results Only** | PASS by construction. This turn produces artifacts only and reports no build, lint or browser result. Every claim about what the code does is written as intent. `quickstart.md` requires real command output to be pasted before the spec is called done. |

**Complexity Tracking**: no violations. The table is omitted rather than filled with nothing.

### Constitution re-check after Phase 1

Re-checked against the final file list below. Three candidate files were removed during design as
Principle II violations, and are recorded here so the reasoning is not lost:

- `lib/nav.ts` — a navigation array with exactly one consumer. Inlined into `app-nav.tsx`.
- `components/app-shell.tsx` — a wrapper whose only caller would be `app/layout.tsx`, which is
  itself the shell. Inlined.
- `components/ui/select.tsx` — needed by the year/month filters of three later screens, but by no
  page in this spec. Deferred to the screen that has something to filter.

`lib/format.ts` was challenged the same way and kept: it has four call sites on the dashboard page
alone, and FR-010's absent-versus-zero rule is a decision that must be made once rather than
re-improvised per column.

## Independence from BE-02

Authentication is being planned in a sibling worktree. This plan takes no position on its outcome:

- No route guard, redirect, session read, login link, user menu or "signed in as" affordance.
- No protected-layout scaffolding, and no route group created in anticipation of one.
- No `middleware.ts` / proxy file.
- No API base-URL configuration, no `.env.example` in `apps/web`, no fetch wrapper.

When BE-02's contract lands, integrating it is expected to add a layout and a client boundary
around the shell's header — an addition to this structure, not a rework of it. Nothing in FE-01 is
shaped by a guess about the session mechanism, so no guess can turn out wrong.

## Project Structure

### Documentation (this feature)

```text
specs/003-frontend-foundation/
├── spec.md              # Phase -1 output (/speckit-specify)
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0 output — versions and decisions
├── data-model.md        # Phase 1 output — Not applicable, with reason
├── contracts/
│   └── README.md        # Phase 1 output — Not applicable, with reason
├── quickstart.md        # Phase 1 output — manual verification checklist
├── tasks.md             # Phase 2 output (/speckit-tasks)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
apps/web/
├── app/
│   ├── layout.tsx              # M  shell: header, nav, main; real metadata
│   ├── page.tsx                # M  dashboard — five figures + one table, sample data
│   ├── globals.css             # M  + --positive / --negative; sans font binding repaired
│   ├── providers.tsx           #    unchanged — React Query, already correct
│   ├── loading.tsx             # N  skeleton in the shape of the dashboard
│   ├── error.tsx               # N  "use client" — { error, retry }, per the installed docs
│   ├── not-found.tsx           # N  styled 404 inside the shell
│   ├── projects/page.tsx       # N  heading + empty state
│   ├── productivity/page.tsx   # N  heading + empty state
│   ├── categories/page.tsx     # N  heading + empty state
│   └── favicon.ico             #    unchanged
├── components/
│   ├── app-nav.tsx             # N  "use client" — usePathname, aria-current
│   ├── empty-state.tsx         # N  icon, heading, description
│   ├── error-state.tsx         # N  "use client" — heading, message, retry
│   ├── stat-card.tsx           # N  one headline figure
│   └── ui/
│       ├── button.tsx          # N  shadcn base-nova
│       ├── card.tsx            # N  shadcn base-nova
│       ├── table.tsx           # N  shadcn base-nova
│       └── skeleton.tsx        # N  shadcn base-nova
├── lib/
│   ├── utils.ts                #    unchanged — re-exports cn
│   └── format.ts               # N  AED, hours, percent; absent ≠ zero
├── public/                     # D  next.svg, vercel.svg, file.svg, globe.svg, window.svg
├── components.json             #    unchanged
├── next.config.ts              #    unchanged
├── eslint.config.mjs           #    unchanged
├── tsconfig.json               #    unchanged
├── package.json                #    unchanged — no new dependency, no new script
└── AGENTS.md                   #    unchanged — regenerated by `next dev`; commit if it reappears
```

Untouched by this spec: `apps/api/**`, `package.json` (root), `pnpm-workspace.yaml`,
`pnpm-lock.yaml`, `.nvmrc`, `README.md` (root), `AGENTS.md` (root), `CLAUDE.md`.

**Structure Decision**: The existing `apps/web` layout is kept exactly as `create-next-app` and
`components.json` established it — `app/` for routes, `components/ui/` for generated primitives,
`components/` for application components, `lib/` for helpers. Nothing is reorganised, no `src/`
directory is introduced, and no new top-level folder is created. Route segments are plain folders
under `app/`; the reasoning against a route group is Decision 2 in `research.md`.

### Justification per new file

Principle II requires each addition to answer to a requirement. Each row names the requirement and
the caller that makes the file non-speculative.

| File | Requirement | Rendered / imported by |
|---|---|---|
| `app/loading.tsx` | FR-017 | App Router, on any pending segment |
| `app/error.tsx` | FR-018, FR-019 | App Router, on an uncaught render failure |
| `app/not-found.tsx` | FR-006 | App Router, on an unmatched URL |
| `app/projects/page.tsx` | FR-002, FR-022 | nav item "Projects" |
| `app/productivity/page.tsx` | FR-002, FR-022 | nav item "Productivity" |
| `app/categories/page.tsx` | FR-002, FR-022 | nav item "Categories" |
| `components/app-nav.tsx` | FR-002, FR-003 | `app/layout.tsx`, twice (rail + header row) |
| `components/empty-state.tsx` | FR-016, FR-022 | three section pages |
| `components/error-state.tsx` | FR-016, FR-018 | `app/error.tsx` |
| `components/stat-card.tsx` | FR-020 | `app/page.tsx`, five times |
| `components/ui/button.tsx` | FR-014 | `error-state.tsx`, `not-found.tsx` |
| `components/ui/card.tsx` | FR-014 | `stat-card.tsx`, `empty-state.tsx` |
| `components/ui/table.tsx` | FR-014, FR-015 | `app/page.tsx` |
| `components/ui/skeleton.tsx` | FR-014 | `app/loading.tsx` |
| `lib/format.ts` | FR-010 | `app/page.tsx` (currency, hours, percent) |

## Implementation Notes

**Shell** — `app/layout.tsx` keeps the existing `html`/`body`, the Geist font variables and
`<Providers>`, and adds a header plus a `md:`-and-up side rail. `metadata` gains a real
`title.template` so each section contributes its own name (FR-005). The `<main>` element carries
the page content; navigation sits in a `<nav aria-label="Sections">`.

**Navigation** — `app-nav.tsx` is the only place the four sections are listed. It reads
`usePathname()` and sets `aria-current="page"` on the match, using `startsWith` for the three
section routes and an exact match for `/` so the dashboard is not permanently current (FR-003).
Current state is carried by weight and a rule, not by colour alone (FR-011).

**Tokens** — two variables added to `:root` and `.dark` in `globals.css`, surfaced through the
existing `@theme inline` block as `--color-positive` / `--color-negative`. Contrast is checked in
both schemes against the surface they sit on (FR-012). Existing tokens are not renamed or removed,
with one deliberate exception: `--font-sans` currently resolves to itself while `app/layout.tsx`
loads Geist as `--font-geist-sans`, so the document silently falls back to a system font. That
binding and the `--font-heading` line chained off it are repaired (research.md Decision 8, task
T004a) — typography is part of the token set under FR-007, and shipping a foundation whose font
never loads would hand the defect to every later spec.

**Numbers** — `lib/format.ts` exports three functions built on `Intl.NumberFormat`. Currency is
`AED` with no fraction digits at dashboard scale; hours carry one decimal; percentages carry one
decimal and a sign. Each returns an em dash for `null`/`undefined` and a formatted zero for `0`, so
a later missing salary cannot read as `AED 0` (FR-010). Numeric cells and figures carry
`tabular-nums` (FR-009).

**Table** — semantic `table`/`thead`/`tbody`/`th`/`td` with `scope` on header cells, inside an
`overflow-x-auto` container so the table scrolls and the page does not (FR-015, US3-4).

**Sample data** — the dashboard's figures and its six table rows are literals in `app/page.tsx`,
directly above the markup that renders them, marked plainly as placeholders. They
are not exported, not moved to a fixture file, and not shaped like an API response — a fixture that
looked like a payload would be exactly the speculative structure Principle II forbids, and would
read as a mock. A persistent notice above the figures states they are placeholders (FR-021).

**Motion** — any transition or skeleton pulse is wrapped so it is suppressed under
`prefers-reduced-motion` (FR-013). `tw-animate-css` is already installed and already honours it.

## Deferred

Recorded so the next spec inherits the reasoning rather than the omission.

| Deferred | Why now is too early | Trigger to add it |
|---|---|---|
| Upload page and nav item | No ingestion endpoint exists; a file input that cannot accept a file is a control that does nothing (FR-022) | The spec that delivers the ingestion endpoint |
| `/projects/[refCode]` detail route | Needs a project to detail | The spec that lists real projects |
| Year / month filter controls | A filter with nothing to filter is decorative | The first screen with data to filter |
| `components/ui/select.tsx` | Only the filters would use it | With the filters |
| API base URL config, `.env.example` in `apps/web`, fetch wrapper | Nothing fetches; the base URL would be configuration for no reader | The first query |
| React Query defaults (`staleTime`, retry, error handling) | Defaults chosen with no query to apply them to are guesses | The first query |
| Any Zustand store | No shared UI state exists in this spec | Real cross-component UI state, named in a spec |
| Auth guard, session read, login affordance, protected layout | BE-02's contract is not landed (Constitution Principle VI) | BE-02 merged and its contract documented |
| Charts and a chart palette | No chart is rendered | The first chart |
| CSV export, employee × category matrix, audit view, multi-year | Assessment stretch goals, and all data-dependent | After the must-have screens reconcile |
| Automated tests of any kind | Excluded by FR-026 at the owner's direction | The final testing stage, as its own spec |

## Coordination note

If T009 finds that a primitive pulls in a package not already installed, the package is **not**
installed on this branch. The dependency files are restored from the snapshot T007 took of this
branch's own pre-generation state — never from `main`, which can move underneath this branch while
BE-02 merges — and the generated files that import the missing package are **deleted** rather than
left with unresolvable imports. The package name, its version and the primitive that needed it are
appended to this section for the owner to sequence against the backend work. Adding a row here is
the expected outcome of that discovery, not a failure of the spec.

This section is also where T029 records anything in the root `README.md` that this spec makes stale.
The root file is not edited on this branch; the note lets the owner fold it in once the parallel
branches have landed.

*(Nothing recorded. This section is written to be filled in during implementation, or to stay
empty.)*
