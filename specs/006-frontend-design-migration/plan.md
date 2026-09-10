# Implementation Plan: Frontend Design Migration (FE-03)

**Branch**: `006-frontend-design-migration` | **Spec**: `spec.md`

**Worktree**: `~/Documents/claude-worktree/tentwenty-test/frontend-design-migration` (Constitution VI)

## Verified environment

Read from the worktree's own `node_modules` on 2026-09-10:

| Package | Installed |
| --- | --- |
| `next` | 16.3.4 |
| `react` / `react-dom` | 19.2.8 |
| `@tanstack/react-query` | 5.102.8 |
| `tailwindcss` | 4.x |
| `zustand` | 5.0.15 (present, unused — no store is added) |

Documentation consulted in `apps/web/node_modules/next/dist/docs`:

- `01-app/03-api-reference/04-functions/use-search-params.md` — client-only hook; a prerendered
  route using it renders its subtree client-side up to the nearest `Suspense`, so the period filter
  is wrapped in one. Confirms the pattern `LoginForm` already uses.
- `01-app/03-api-reference/02-components/font.md` and `01-app/01-getting-started/13-fonts.md` —
  `next/font/google` with a CSS `variable`, matching how Geist was wired in `app/layout.tsx`.
- `01-app/02-guides/authentication.md` — a layout "does not control whether the rest of the route
  renders"; the gate stays a UX boundary (README 8.1/8.2, unchanged).

## Technical approach

### Tokens first, components second

The design's palette, type scale, spacing, radii and shadows become CSS custom properties in
`app/globals.css`, exposed through the existing `@theme inline` block so they are reachable as
Tailwind utilities (`bg-brand`, `text-ink-2`, `shadow-card`, `rounded-xl`). Components then carry
utilities, not hex values. This is what keeps it one design system rather than two.

`--positive` / `--negative` are re-pointed at the design's `--good` / `--neg` and re-checked for
contrast rather than replaced with new names, so `StatCard`'s existing `tone` API keeps working.

### Deliberate adaptation, not transcription

| Prototype | Here |
| --- | --- |
| `.verdict` | `components/dashboard/verdict-banner.tsx` — typed props, three tones |
| `.kpi` | existing `StatCard`, restyled, plus an optional `bar` for the billable share |
| `.banner` | `components/notice.tsx` — `info`/`warning`/`danger`/`success` |
| `.empty` | existing `EmptyState`, restyled, optional action |
| `.panel` | existing `Card` + a small `PageHeader`; no new panel abstraction |
| `.side` / `.periodbar` | `app/(app)/layout.tsx` + restyled `AppNav`, `UserMenu` |
| `.auth` split screen | `app/(auth)/login/page.tsx` + restyled `LoginForm` |
| `window.MD.compute` | **dropped** — `apps/api` owns calculation |
| `useState` auth, route switch, upload simulation, toasts | **dropped** |

### Data: sample first, then the real endpoints

Built in two stages, because the backend landed mid-implementation.

**Stage 1** — with no reporting endpoint on `main`, the Dashboard rendered from
`lib/sample-dashboard.ts`: a frozen literal shaped like the documented `GET /dashboard` response,
performing no arithmetic, never reaching `apiFetch`, and labelled as sample on every render.

**Stage 2** — `004-assessment-backend` merged to `main` (PR #4). The branch was rebased onto it and
`lib/analytics.ts` was written per README §10: duplicated response types, `fetchPeriods` and
`fetchDashboard` calling `apiFetch` with `{ signal }` forwarded, `["analytics", …]` query keys
(outside the `"auth"` namespace, so `isPrivateQuery` clears them on a session change), and
`enabled` set from the resolved authenticated state. `lib/sample-dashboard.ts` was **deleted**.

Because the component tree was shaped around the documented response from the start, the swap
touched two files and no layout.

Two integration details worth recording:

- **The period filter is driven by `GET /periods`.** Only years and months the API actually holds
  are offered, so the empty state is reserved for a period reached by URL — and the `/dashboard`
  query's `enabled` gate means no request is made for one.
- **`month` is optional in the contract**, meaning the whole year. The filter exposes that as
  "Whole year", and the banner's sentence changes with it — "made money this month" is false for a
  twelve-month view.

Still unintegrated: `/projects`, `/departments`, `/productivity`, `/categories`, `/settings`,
`/imports`. Each is its own screen. Their pages keep the design's empty state and issue no request.

### Period state

`?year=&month=` in the URL, read with `useSearchParams` inside a `Suspense` boundary and written
with `router.replace`. Not Zustand: it is navigational state the browser already owns, and
duplicating it in a store would add a store with one consumer (Constitution II).

`safeReturnTo` is a pathname allowlist and `AuthGate` passes `pathname` only, so the query string is
dropped across an expiry. Documented in `lib/session.ts` rather than "fixed" by writing a
sanitiser — README 6.5 rules that out explicitly.

## Constitution Check

| Principle | Status |
| --- | --- |
| I. Simple, conventional code | Pass — App Router file conventions, `next/font`, `useSearchParams` + `Suspense`, all per the installed docs. |
| II. No speculative structure | Pass — one new folder (`components/dashboard/`) holding two components with a shared responsibility. No barrels, no base classes. `lib/analytics.ts` is deliberately *not* written ahead of its contract. |
| III. Comments explain the non-obvious | Pass — comments record why sample data is isolated, why sign-out stays in the header, why percent has two formatters. |
| IV. HTTP-only boundary | Pass — no import crosses `apps/`. Sample types are hand-written in `apps/web`. |
| V. One side per spec | Pass — `apps/web` only. |
| VI. One spec per side at a time | Pass — 005 is merged to `main` and complete; this runs in its own worktree/branch. The clause forbidding dependence on an *unlanded* backend contract was honoured while 004 was unlanded (stage 1) and stopped applying when 004 merged to `main`; the branch was rebased onto it before any endpoint was called. |
| VII. Libraries that remove complexity | Pass — no dependency added. |
| VIII. Verified results only | Enforced by the verification tasks; results recorded in `quickstart.md`. |

**Complexity Tracking**: no deviations to record.

## Risks

- **Contrast.** The design's `--ink-3` (#9b9cb8) on `--bg` (#f7f7fd) is ~2.4:1 — below AA for body
  text. Used only for decorative labels at or above the large-text threshold, or darkened to
  `--ink-2`. Checked case by case during implementation.
- **Dark mode.** The design supplies light values only. The existing `.dark` block is retained with
  the brand tokens given dark equivalents, so the app does not break for a dark-preferring user.
