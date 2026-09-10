# Implementation Plan: Frontend Simplification and Design Fidelity (FE-04)

**Branch**: `008-frontend-simplification` | **Spec**: `spec.md` | **Findings**: `review.md`

**Worktree**: `~/Documents/claude-worktree/tentwenty-test/frontend-design-migration`
(Constitution VI), cut from `origin/main` at `2b4c0d9`.

## Verified environment

Read from this worktree's own `node_modules`:

| Package | Installed |
| --- | --- |
| `next` | 16.3.4 |
| `react` / `react-dom` | 19.2.8 |
| `@tanstack/react-query` | 5.102.8 |
| `tailwindcss` | 4.x |

`keepPreviousData` confirmed exported by `@tanstack/query-core@5.102.8`
(`build/modern/index.d.ts`). Baseline before any edit: `tsc --noEmit`, `lint`
and `build` all clean, 10 routes.

## Approach

Three groups, in order. Each is independently shippable and independently
verifiable, so a problem in one does not hold up the others.

### 1. Behaviour and design fidelity (spec US1–US4)

| Change | File |
| --- | --- |
| Month not in the year's list is rendered rather than silently swallowed | `components/period-filter.tsx` |
| Staged file cleared on success only | `components/data/upload-card.tsx` |
| Group `loading.tsx` becomes shape-neutral | `app/(app)/loading.tsx` |
| Period chip beside the title | `components/page-header.tsx` + `components/period-scope.tsx` + five views |
| Sample import offered from the empty state | `components/period-scope.tsx`, `components/empty-state.tsx` |
| Action on the completeness notice | `components/completeness-notice.tsx` |

The chip takes a `badge?: string` on `PageHeader` — a string, not a node,
because the only value it will ever carry is the period label. `pill.tsx`'s
`Tag` is deliberately not reused: it is 10.5px uppercase with a 7px radius,
a different thing wearing a similar name.

### 2. Paint and perceived speed (spec US5–US6)

**The shell leaves the gate.** `AuthGate` currently wraps the whole layout, so
the sidebar, brand, nav and header — all public, all data-free — wait on
`/auth/me`. They move outside it; the gate keeps `<main>`. Its redirect
behaviour, its error state and the expiry marker are untouched. `UserMenu`
already returns `null` without a user and `AppNav` is static, so nothing private
leaks by painting earlier.

**`placeholderData: keepPreviousData`** on the reporting queries, so a period
change dims rather than blanks.

**A longer `staleTime` for reporting data.** The global default stays 30s;
reporting queries opt into a longer one. This is safe *because* invalidation is
already correct and explicit: `lib/imports.ts` and `lib/settings.ts` invalidate
`["analytics"]` on every write. `["auth","me"]` keeps 30s — README 3.8 sets that
deliberately.

### 3. Simplification (spec NFR-003…005)

- **One shape in `lib/analytics.ts`.** Every period-scoped endpoint is
  `/<resource>?year&month` cached at `["analytics", resource, year, month]`, so
  one `usePeriodQuery<T>` covers five of them. `usePeriods` and `useProject`
  stay explicit — they do not follow that rule, and pretending otherwise would
  cost more than it saves. The four exports with no consumers go.
- **One `PeriodDescriptor`**, replacing the inline copy that already drifted.
- **The productivity footer reads `companyProductivity`**, as the prototype
  does, instead of recomputing the API's own definition for a filtered subset.
- **One skeleton and one retry sentence.**
- **`TablePanel`** replaces eight `<Card className="py-0">` overrides. This
  removes a fight with the design tokens; the rendered result is identical.
- **Dead code and unrendered response fields deleted.**
- Cheap computation cleanups: memoise the productivity and projects derivations,
  early-exit in departments, hoist one `Intl.DateTimeFormat` for the import
  history — exactly the pattern `lib/format.ts` already uses for numbers.
- `shadcn` moves to `devDependencies`; it is a build-time CLI reached through
  `@import "shadcn/tailwind.css"`.

## Constitution Check

| Principle | Status |
| --- | --- |
| I. Simple, conventional code | Pass — removes a bespoke skeleton, a duplicated sentence and eight token overrides; adds no mechanism. |
| II. No speculative structure | Pass — `usePeriodQuery` has five callers and `TablePanel` eight; both replace existing repetition rather than anticipating it. `PageHeader.badge` has five callers. |
| III. Comments explain the non-obvious | Pass — the surviving comments record *why* (one rule per import kind, uncertainty as the default, the chip as a label not a control). |
| IV. HTTP-only boundary | Pass — no import crosses `apps/`; response types stay duplicated by hand. |
| V. One side per spec | Pass — `apps/web` only. |
| VI. One spec per side at a time | Pass — 006 is merged; this runs in its own worktree and branch. |
| VII. Libraries that remove complexity | Pass — no dependency added; one moves to `devDependencies`. |
| VIII. Verified results only | Enforced by Phase 4; results recorded in `quickstart.md`. |

**Complexity Tracking**: no deviations.

## Risks

- **The analytics rewrite touches every query key.** A wrong key does not fail —
  it serves the wrong period silently. Every screen is re-walked against the
  running API in Phase 4, with figures compared to the contract.
- **Moving the shell out of `AuthGate`** must not change when the redirect
  fires. The redirect lives in an effect on cache state, not on render position,
  so it should not — but sign-out, expiry and a signed-out first visit are all
  re-checked.
- **`keepPreviousData` shows stale figures under a new period's chip** for the
  duration of the fetch. The dimming is what distinguishes them; without it this
  change would be a correctness problem rather than a UX one.
