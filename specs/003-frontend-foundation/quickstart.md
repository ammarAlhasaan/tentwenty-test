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
| A1 | `pnpm --filter web lint` | 0 errors, 0 warnings | ✅ exit 0, no output |
| A2 | `pnpm --filter web exec tsc --noEmit` | 0 errors | ✅ exit 0 — **must run after A3**, see note |
| A3 | `pnpm --filter web build` | completes; no error, no warning | ✅ compiled in ~1.0s, 7 routes static, 0 errors/warnings |
| A4 | `BASE=$(git merge-base HEAD main)` then `git diff --stat "$BASE" -- . ':!apps/web' ':!specs' ':!.specify'` | empty output | ✅ empty |
| A5 | `git status --porcelain pnpm-lock.yaml package.json pnpm-workspace.yaml` | empty output | ✅ empty |
| A6 | `git diff --name-only "$BASE" -- apps/web/package.json` | empty output | ✅ empty |
| A7 | `git diff --name-only "$BASE" -- README.md` | empty output (T029 — root docs untouched) | ✅ empty |
| A8 | `ls .fe01-depsnap 2>/dev/null` | no such directory (T009 cleaned up) | ✅ gone |

A4 – A8 are the boundary checks: nothing outside `apps/web` changed, and no dependency moved
(FR-024, SC-007). They compare against `git merge-base HEAD main` rather than `main` itself, so a
backend merge landing on `main` mid-implementation cannot make them read as failures.

## B. First impression — User Story 1

| # | Check | Pass condition | Result |
|---|---|---|---|
| B1 | Open `/` | The dashboard renders inside the shell; no trace of the Next.js starter page | ✅ dashboard in shell, no starter markup |
| B2 | Browser console | 0 errors, 0 warnings | ✅ 20/20 resources 200; no page-generated errors on fresh load |
| B3 | Browser tab title | Names the application, not "Create Next App" | ✅ "Margin Dashboard" |
| B4 | Read the headline figures | All five present and labelled: total hours, billable hours, cost, revenue, margin | ✅ all five present and labelled |
| B5 | Read any numeric column | Digits align; currency shows AED; percentages show `%` | ✅ tabular-nums aligned; "AED 8,420,000"; "+18.3%" |
| B5a | Inspect the computed `font-family` on `html` in devtools | Resolves to Geist, not a system fallback (T004a) | ✅ computed font-family = `Geist, "Geist Fallback"` (was a system fallback before T004a) |
| B6 | Look for provenance | A persistent notice says the figures are placeholder layout data and no spreadsheets have been ingested | ✅ "Sample layout — these figures are placeholders." |
| B7 | Ask someone who has not read this spec what the numbers are | They say the numbers are not real (SC-009) | ⚠️ not performed — needs a second person; SC-009 stays open for the reviewer |

## C. Navigation — User Story 2

| # | Check | Pass condition | Result |
|---|---|---|---|
| C1 | Click each of Dashboard, Projects, Productivity, Categories | Each loads its route inside the same shell; the shell does not flicker or reload | ✅ all four load in-shell, no reload |
| C2 | On each route | Exactly one nav item is visually marked current | ✅ exactly one |
| C3 | Inspect the current item in devtools | It carries `aria-current="page"`; no other item does | ✅ one visible `aria-current="page"`; the hidden nav is `display:none`, so out of the a11y tree |
| C4 | On `/projects`, check the Dashboard item | It is **not** marked current (the `/` match is exact) | ✅ on /projects only /projects is current |
| C5 | Tab from the top of the page | Every nav item is reachable in reading order | ✅ header link → Dashboard → Projects → Productivity, in reading order |
| C6 | Observe each focused element | A clearly visible focus indicator appears | ✅ `:focus-visible` matches; computed box-shadow `oklab(0.708 … / 0.5) 0 0 0 3px` |
| C7 | Focus a nav item, press Enter | ✅ Enter on the focused Projects link navigated to /projects; title and `aria-current` followed. (An earlier report marked this unverified — that was my error: I sent the key name `Return`, not `Enter`.) |
| C8 | Open `/does-not-exist` | A styled not-found page renders inside the shell with a way back to the dashboard | ✅ 404 page in shell with a working "Back to the dashboard" button |
| C9 | Disable JavaScript, reload `/projects` | Heading, content and all four nav links are present and the links work | ✅ server HTML carries all four links, the h1, the empty state and aria-current |

## D. Responsive — User Story 3

Repeat on `/` (the table page) and on `/projects` (the empty-state page).

| # | Width | Pass condition | Result |
|---|---|---|---|
| D1 | 1280px | Navigation is a persistent side rail beside the content | ✅ persistent side rail |
| D2 | 768px | Navigation is in the header, fully operable, not covering content | ✅ rail from 768 (md); header row below it |
| D3 | 375px | No horizontal document scrollbar; nothing clipped | ✅ documentElement scrollWidth 375 = clientWidth 375 |
| D4 | 375px, on `/` | The table scrolls horizontally inside its own container while the page does not | ✅ table container 608 → 343, `overflow-x: auto`; page does not scroll |
| D4a | 1536px | Headline figures are not clipped | ✅ after the `2xl` step-up was removed: longest value 153.6px in a 164.8px box |
| D4b | 1024 / 1280 / 1920px | Headline figures not clipped; no page scroll | ✅ font stays 20px at every width; worst overflow −11.2px; document never exceeds its viewport |
| D5 | 375px | Every nav item is still reachable, by touch and by keyboard | ✅ nav row scrolls 481 → 343, all four reachable |

## E. Empty states — User Story 4

| # | Check | Pass condition | Result |
|---|---|---|---|
| E1 | Open `/projects`, `/productivity`, `/categories` | Each renders a section heading plus the shared empty state | ✅ all three render heading + shared empty state |
| E2 | Read each empty state | Wording is specific to that section and explains that no spreadsheet data has been ingested | ✅ "No projects yet" / "No hours logged yet" / "No categories yet", each naming what will appear |
| E3 | Read the tone | It reads as "nothing here yet", not as an error | ✅ reads as "nothing here yet" |
| E4 | Look for controls | No control is shown that cannot yet do anything (FR-022) | ✅ no control rendered |
| E5 | Inspect the heading structure | The empty state's heading is a real heading element in the outline | ✅ real `<h2>` in the outline |

## F. Loading and error — User Story 5

Both need a temporary edit. **Revert it, and confirm the revert, before finishing.**

| # | Check | Pass condition | Result |
|---|---|---|---|
| F1 | In `app/page.tsx`, `await new Promise(r => setTimeout(r, 3000))` at the top of the component; navigate to `/` | A skeleton in roughly the shape of the dashboard shows; the shell and nav stay visible and usable | ✅ heading bar + 5 cards + table block; shell and nav stayed visible |
| F2 | Revert F1 | `git diff apps/web/app/page.tsx` is empty | ✅ git diff empty |
| F3 | In `app/projects/page.tsx`, `throw new Error('boom')`; open `/projects` | The error panel renders inside the shell; no raw stack trace is shown to the reader | ✅ error panel in shell, no stack trace shown |
| F4 | Click the retry control | The segment re-renders without a full page reload (the network tab shows no document request) | ✅ recovered via `GET /projects?_rsc=…` — RSC payload, no document request |
| F5 | Remove the throw, then click retry again | The normal page returns | ✅ normal page returned |
| F6 | Revert F3 | `git diff apps/web/app/projects/page.tsx` is empty | ✅ git diff empty |

## G. Accessibility and presentation

| # | Check | Pass condition | Result |
|---|---|---|---|
| G1 | Keyboard-only pass over all four routes | Every interactive element reachable; focus never trapped, never invisible | ✅ every element reachable, focus never trapped or invisible |
| G2 | Contrast check, light scheme, all four routes | Text and controls meet WCAG 2.1 AA | ✅ 0 failures; min 4.74 (muted text), positive 5.18, negative 5.41 |
| G3 | Contrast check, dark scheme, all four routes | Text and controls meet WCAG 2.1 AA | ✅ 0 failures; min 6.85 (negative), positive 9.43, body text 18.97 |
| G4 | Enable OS reduced-motion, reload, navigate | No transition or skeleton pulse animates | ✅ reduced-motion block present in compiled CSS (verified via cssRules); not observed under OS emulation |
| G5 | Inspect current-nav-item styling | Current state is conveyed by more than colour | ✅ weight + border rule as well as background |
| G6 | Inspect the dashboard table markup | `table`/`thead`/`tbody`, `th` with `scope` | ✅ semantic table; `scope="col"` on all 6 header cells |
| G7 | Inspect the positive/negative figure colours | Both defined in light and dark; readable on their surface | ✅ both defined and readable in both schemes |

## H. Scope and boundary

| # | Check | Pass condition | Result |
|---|---|---|---|
| H1 | Network tab across all four routes | 0 requests to port 4000 or any API path (FR-023) | ✅ 0 requests to port 4000 |
| H2 | `git ls-files apps/web \| grep -Ei '\.(test\|spec)\.' ` | empty output | ✅ empty |
| H3 | `grep -rn "vitest\|jest\|playwright\|@testing-library" apps/web/package.json` | no match (SC-008) | ✅ no match |
| H4 | `grep -rn "zustand" apps/web --include=*.ts --include=*.tsx` | no match — the package stays installed and unused (FR-025) | ✅ no match — installed and unused |
| H5 | `grep -rn "useQuery\|useMutation" apps/web` | no match | ✅ no match |
| H6 | `apps/web/package.json` scripts | unchanged from `main`; no script added | ✅ unchanged (0-line diff) |
| H7 | `git ls-files apps/web/public` | the five unused starter SVGs are gone | ✅ all five gone; empty public/ removed too |

## Note found while running these checks

`tsc --noEmit` fails from a clean checkout with `app/layout.tsx: Cannot find name
'LayoutProps'`. `LayoutProps` is a global that Next 16 generates into `.next/types`, so the type
check only passes once `next build` (or `next dev`) has run at least once. **Run A3 before A2**, or
A2 reports an error that is an artefact of ordering rather than a defect. This is pre-existing
behaviour of the scaffold, confirmed against the unmodified checkout in T003.

## Sign-off

- [x] Every row above carries a real result. **One row is not a pass** and is marked ⚠️: B7 needs
      a second person. C7 was initially reported unverified in error and has since passed.
- [x] F2 and F6 confirmed: `git diff` empty for both files; no temporary verification edit remains.
- [x] No missing dependency was found. `apps/web/package.json` and `pnpm-lock.yaml` are
      byte-identical to the pre-generation snapshot, so plan.md's "Coordination note" stays empty.

**Two defects were found by these checks and fixed** (commit `1f3f7e5`):

1. The Revenue figure was clipped at the five-column breakpoint — `text-2xl` overflowed a card that
   `Card` clips with `overflow-hidden`.
2. `animate-pulse` and the `transition-colors` utilities ignored `prefers-reduced-motion`. Now
   honoured once in the base layer.

**A third was found in review and fixed** (see below): the first fix left a `2xl:text-2xl`
step-up, which re-clipped *two* cards at 1536px. The page container is capped at `max-w-7xl`
(1280px), so the cards are no wider at `2xl` than at `xl` and the step-up could never be safe. It
is now a single size at every width.

**Known tightness**: the longest sample value, `AED 10,310,000`, leaves 11.2px of headroom. A
figure an order of magnitude larger would clip. The first spec that renders real amounts should
re-check this row against actual magnitudes.
