# Manual Verification: FE-01 — Frontend Foundation

There are no automated tests in this spec (FR-026). These checks are the verification.

Constitution Principle VIII applies to every line below: **paste the real output**. A check that
was skipped, was inconclusive, or failed is recorded as such, not omitted.

## Setup

From the repository root of this worktree:

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm --filter web dev
```

Open `http://localhost:3000`.

`--frozen-lockfile` is not incidental: it fails if anything in this branch changed
`pnpm-lock.yaml`, which FR-024 forbids while the backend work is in flight.

## A. Automated gates

| # | Command | Pass condition | Result |
|---|---|---|---|
| A1 | `pnpm --filter web lint` | 0 errors, 0 warnings | |
| A2 | `pnpm --filter web exec tsc --noEmit` | 0 errors | |
| A3 | `pnpm --filter web build` | completes; no error, no warning | |
| A4 | `BASE=$(git merge-base HEAD main)` then `git diff --stat "$BASE" -- . ':!apps/web' ':!specs' ':!.specify'` | empty output | |
| A5 | `git status --porcelain pnpm-lock.yaml package.json pnpm-workspace.yaml` | empty output | |
| A6 | `git diff --name-only "$BASE" -- apps/web/package.json` | empty output | |
| A7 | `git diff --name-only "$BASE" -- README.md` | empty output (T029 — root docs untouched) | |
| A8 | `ls .fe01-depsnap 2>/dev/null` | no such directory (T009 cleaned up) | |

A4 – A8 are the boundary checks: nothing outside `apps/web` changed, and no dependency moved
(FR-024, SC-007). They compare against `git merge-base HEAD main` rather than `main` itself, so a
backend merge landing on `main` mid-implementation cannot make them read as failures.

## B. First impression — User Story 1

| # | Check | Pass condition | Result |
|---|---|---|---|
| B1 | Open `/` | The dashboard renders inside the shell; no trace of the Next.js starter page | |
| B2 | Browser console | 0 errors, 0 warnings | |
| B3 | Browser tab title | Names the application, not "Create Next App" | |
| B4 | Read the headline figures | All five present and labelled: total hours, billable hours, cost, revenue, margin | |
| B5 | Read any numeric column | Digits align; currency shows AED; percentages show `%` | |
| B5a | Inspect the computed `font-family` on `html` in devtools | Resolves to Geist, not a system fallback (T004a) | |
| B6 | Look for provenance | A persistent notice says the figures are placeholder layout data and no spreadsheets have been ingested | |
| B7 | Ask someone who has not read this spec what the numbers are | They say the numbers are not real (SC-009) | |

## C. Navigation — User Story 2

| # | Check | Pass condition | Result |
|---|---|---|---|
| C1 | Click each of Dashboard, Projects, Productivity, Categories | Each loads its route inside the same shell; the shell does not flicker or reload | |
| C2 | On each route | Exactly one nav item is visually marked current | |
| C3 | Inspect the current item in devtools | It carries `aria-current="page"`; no other item does | |
| C4 | On `/projects`, check the Dashboard item | It is **not** marked current (the `/` match is exact) | |
| C5 | Tab from the top of the page | Every nav item is reachable in reading order | |
| C6 | Observe each focused element | A clearly visible focus indicator appears | |
| C7 | Focus a nav item, press Enter | That route is navigated to | |
| C8 | Open `/does-not-exist` | A styled not-found page renders inside the shell with a way back to the dashboard | |
| C9 | Disable JavaScript, reload `/projects` | Heading, content and all four nav links are present and the links work | |

## D. Responsive — User Story 3

Repeat on `/` (the table page) and on `/projects` (the empty-state page).

| # | Width | Pass condition | Result |
|---|---|---|---|
| D1 | 1280px | Navigation is a persistent side rail beside the content | |
| D2 | 768px | Navigation is in the header, fully operable, not covering content | |
| D3 | 375px | No horizontal document scrollbar; nothing clipped | |
| D4 | 375px, on `/` | The table scrolls horizontally inside its own container while the page does not | |
| D5 | 375px | Every nav item is still reachable, by touch and by keyboard | |

## E. Empty states — User Story 4

| # | Check | Pass condition | Result |
|---|---|---|---|
| E1 | Open `/projects`, `/productivity`, `/categories` | Each renders a section heading plus the shared empty state | |
| E2 | Read each empty state | Wording is specific to that section and explains that no spreadsheet data has been ingested | |
| E3 | Read the tone | It reads as "nothing here yet", not as an error | |
| E4 | Look for controls | No control is shown that cannot yet do anything (FR-022) | |
| E5 | Inspect the heading structure | The empty state's heading is a real heading element in the outline | |

## F. Loading and error — User Story 5

Both need a temporary edit. **Revert it, and confirm the revert, before finishing.**

| # | Check | Pass condition | Result |
|---|---|---|---|
| F1 | In `app/page.tsx`, `await new Promise(r => setTimeout(r, 3000))` at the top of the component; navigate to `/` | A skeleton in roughly the shape of the dashboard shows; the shell and nav stay visible and usable | |
| F2 | Revert F1 | `git diff apps/web/app/page.tsx` is empty | |
| F3 | In `app/projects/page.tsx`, `throw new Error('boom')`; open `/projects` | The error panel renders inside the shell; no raw stack trace is shown to the reader | |
| F4 | Click the retry control | The segment re-renders without a full page reload (the network tab shows no document request) | |
| F5 | Remove the throw, then click retry again | The normal page returns | |
| F6 | Revert F3 | `git diff apps/web/app/projects/page.tsx` is empty | |

## G. Accessibility and presentation

| # | Check | Pass condition | Result |
|---|---|---|---|
| G1 | Keyboard-only pass over all four routes | Every interactive element reachable; focus never trapped, never invisible | |
| G2 | Contrast check, light scheme, all four routes | Text and controls meet WCAG 2.1 AA | |
| G3 | Contrast check, dark scheme, all four routes | Text and controls meet WCAG 2.1 AA | |
| G4 | Enable OS reduced-motion, reload, navigate | No transition or skeleton pulse animates | |
| G5 | Inspect current-nav-item styling | Current state is conveyed by more than colour | |
| G6 | Inspect the dashboard table markup | `table`/`thead`/`tbody`, `th` with `scope` | |
| G7 | Inspect the positive/negative figure colours | Both defined in light and dark; readable on their surface | |

## H. Scope and boundary

| # | Check | Pass condition | Result |
|---|---|---|---|
| H1 | Network tab across all four routes | 0 requests to port 4000 or any API path (FR-023) | |
| H2 | `git ls-files apps/web \| grep -Ei '\.(test\|spec)\.' ` | empty output | |
| H3 | `grep -rn "vitest\|jest\|playwright\|@testing-library" apps/web/package.json` | no match (SC-008) | |
| H4 | `grep -rn "zustand" apps/web --include=*.ts --include=*.tsx` | no match — the package stays installed and unused (FR-025) | |
| H5 | `grep -rn "useQuery\|useMutation" apps/web` | no match | |
| H6 | `apps/web/package.json` scripts | unchanged from `main`; no script added | |
| H7 | `git ls-files apps/web/public` | the five unused starter SVGs are gone | |

## Sign-off

- [ ] Every row above carries a real result, including any that failed.
- [ ] F2 and F6 confirmed: no temporary verification edit remains.
- [ ] No missing dependency was found, **or** one was found and recorded in plan.md's
      "Coordination note" and **not** installed on this branch.
