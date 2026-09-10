# `apps/web` — consolidated pre-delivery review

**Branch**: `008-frontend-simplification`, cut from `origin/main` at `817e9d8`
(after PR #6 and PR #7 both landed).

**Scope**: frontend only. `apps/api` is out of scope here.

**Baseline verified on this tree, not reported from memory**:

| Check | Result |
| --- | --- |
| `pnpm --filter web exec tsc --noEmit` | clean |
| `pnpm --filter web lint` | clean |
| `pnpm --filter web build` | ✓ 10 routes, 9 static + `/projects/[refCode]` dynamic |

Two reviews are merged below: a correctness/simplification pass over the code,
and a React/Next performance pass. Where they overlap it is noted. Where the
performance pass was **wrong**, that is stated with the evidence — §D.

---

## A. Correctness — fix before delivery

### A1. The month filter can contradict the page it sits above
`components/period-filter.tsx:74`

When the URL names a month the selected year does not hold, the `<select>` has a
value with no matching `<option>` and silently falls back to showing
**"Whole year"**.

*Reproduce*: with data covering only Jan–May 2025, open `/?year=2025&month=7`.
The gate correctly reads "Nothing logged in July 2025"; the filter reads "Whole
year". Two different periods on one screen.

This is the same defect that was fixed for the **year-change** path in
`selectPeriod`; the **URL-entry** path was never guarded.

**Fix**: when the requested month is not in `months`, either render it as a
disabled option or normalise the URL to the whole year on mount — one rule,
matching `selectPeriod`.

### A2. A rejected upload throws the chosen file away
`components/data/upload-card.tsx:120`

`confirm()` clears the staged file unconditionally, immediately after `mutate()`.

*Reproduce*: stage a timesheet, press "Upload and replace", API answers 422 with
a row-level message. The review panel is gone and the card is back to "Drop the
file here" — so acting on the message means re-opening the file picker and
re-entering the year. It is worse in the uncertain-result branch: the user is
told to refresh the history and decide whether to retry, with the file already
dropped.

**Fix**: clear the staged file in `onSuccess` only.

### A3. The route-group loading file shows a dashboard skeleton on every screen
`app/(app)/loading.tsx:5`

It sits at the `(app)` root and renders the dashboard's banner-plus-five-cards
shape, so it plays for all six screens in the group.

*Reproduce*: navigate Dashboard → Categories. The intermediate frame shows a
large rounded banner and five metric cards, then swaps to a table.

**Fix**: make it shape-neutral (a title block and one panel).

---

## B. Duplication and dead weight

### B1. A business rule reimplemented in the browser
`components/productivity/productivity-view.tsx:172`

With a department filter applied, the footer computes
`totals.billable / totals.hours` — the productivity definition `apps/api` owns
and already reports per employee and as `companyProductivity`. If that
definition ever narrows, every row updates from the API while the filtered
footer keeps the old formula. The reference prototype does not do this either:
it shows the agency figure regardless of filter. `AGENTS.md` assigns
calculations to NestJS.

**Fix**: show `companyProductivity` regardless of filter, as the prototype does.

### B2. Two sources of truth for "does this period hold anything"
`lib/analytics.ts:57` and `components/period-scope.tsx:20`

PR #7 added `period.hasData` to **every** period-scoped response. The frontend
declares it on `DashboardResponse` only, never reads it, and instead re-derives
coverage by walking `/periods` in `isCovered()`. The two can disagree — a month
listed in `/periods` with `hasTimesheet: false` is "covered" to the frontend.

**Decision needed** — see §C1. The minimum is to delete the unused field so it
stops implying it is consulted.

### B3. `DashboardResponse.period` re-declares `PeriodDescriptor`, and has drifted
`lib/analytics.ts:51` vs `:86`

The inline copy gained `hasData`; the shared type did not. This already happened
once; it will happen again.

**Fix**: one `PeriodDescriptor`, used by all five.

### B4. Three shapes for one job in `lib/analytics.ts`
`lib/analytics.ts:224`

`fetchPeriods`, `fetchDashboard`, `periodsQueryOptions`, `dashboardQueryOptions`
are exported with **no consumers outside the file**. `periods` and `dashboard`
get fetch-function + options-factory + hook; the other five get a single inline
hook. A reader cannot tell which is the house style.

**Fix**: one shape. Every period-scoped endpoint is `/<resource>?year&month`
cached at `["analytics", resource, year, month]`, so one
`usePeriodQuery<T>(resource, period, enabled)` covers five of them; `usePeriods`
and `useProject` stay explicit because they do not follow that rule. Keep
`analyticsKeys.all` for invalidation. ~335 → ~230 lines, one rule to explain.

### B5. Five loading placeholders for one concept
`components/dashboard/dashboard-view.tsx:124` and `:142`,
`components/period-scope.tsx:177`, `components/query-states.tsx:7`,
`app/(app)/loading.tsx`

`DashboardViewFallback` repeats `DashboardSkeleton` line for line and only adds a
header block. `PeriodScopeSkeleton` is a hand-rolled grey box while
`TableSkeleton` exists two files away. On one screen a user can see **four** in
sequence — corroborated independently by the performance pass.

**Fix**: `DashboardViewFallback` composes `DashboardSkeleton`;
`PeriodScopeSkeleton` becomes `TableSkeleton`; A3 handles the group file.

### B6. Retry copy duplicated verbatim
`components/period-scope.tsx:121` vs `components/query-states.tsx:29`

Editing one leaves the other saying the old thing, so the same failure reads
differently depending on which query failed.

**Fix**: `period-scope` uses `QueryError`.

### B7. Every table cancels `Card`'s own padding
`components/ui/card.tsx:14`, 8 call sites

`<Card className="py-0">` followed by `<CardHeader className="px-5 pt-5">`
undoes the `--card-spacing` tokens. Changing the token has no effect on any
table screen.

**Fix**: a `TablePanel({ title, children })` beside `TableScroller`. This
*removes* an override rather than adding a layer, and is visually identical.

### B8. Dead code
- `lib/format.ts:45` — `formatHours` has no callers; it renders `1,642.9 h`
  while every live figure renders `1,642.9`, so picking it by mistake introduces
  an inconsistent unit.
- `components/missing-value.tsx:21` — `isAbsent`, no callers.
- `components/period-scope.tsx:161` — `NoDataYet` exported, used only in its own
  file.
- `components/period-scope.tsx:149` — returns `signedIn` and `periods`; all five
  consumers read only `period`, `enabled`, `filter`, `gate`.
- `components/data/upload-card.tsx:102` — `mine` can never be false: each card
  calls `useUploadWorkbook()` itself, so the mutation is per-card.
- Unused declared response fields: `hasTimesheet`, `hasSalaries`,
  `monthsCovered`, `lifetimeHours`, `lifetimeShareOfHours`, `typeOfExpense`,
  `ProjectRow.salesMonth`, `nonBillableHours` on departments,
  `projectsInserted`, `projectsUpdated`. The file header claims "only the fields
  this frontend actually renders are declared" — no longer true.

### B9. Sentinel period
`components/period-scope.tsx:152`

`period ?? { year: 0, month: null }` is passed into every resource hook, safe
only because `enabled` is false at the same moment. The invariant lives in a
comment. Low priority, but it costs a sentence of explanation every time.

### B10. `VerdictBanner`: nine props, two call sites
`components/dashboard/verdict-banner.tsx:20`

`subject`, `periodPhrase`, `profitNote`, `marginNote` exist only so the project
page can reword the dashboard's sentences.

**Fix**: let the second caller pass a finished `answer`/`because` pair while the
banner keeps the tone rule.

---

## C. Performance — verified, with decisions flagged

### C1. Serial waterfall on every reporting screen — **the biggest real win**

`HTML (no data) → hydrate → GET /auth/me → GET /periods → GET /<resource>`

Three round trips that cannot overlap, because of the `enabled` chain at
`components/period-scope.tsx:44` and `:153`. At 100 ms RTT that is ~300 ms of
pure serialisation before the figures are even requested. Same on all five
reporting screens.

Three options, cheapest first:

**(a) Start the leaf query from the URL's period.** When the URL carries
`?year=2025&month=3` the period is already known; `/periods` is needed only to
validate it and build the filter. 3 RTTs → 2 on any bookmarked or navigated URL.
Low risk. **This also subsumes B2**: coverage becomes an after-the-fact empty
state driven by the response, so `isCovered` and the B9 sentinel both go away.
*Trade-off*: a request is issued for a period that turns out to be empty — the
API answers it cheaply and honestly.

**(b) Let `/periods` start alongside `/auth/me`.** Blocked today by
`app/providers.tsx:53`, which turns any non-`me` 401 into `endSession`. Exempting
queries whose 401 arrives while `["auth","me"]` has never resolved to a user is
correct — that is a session that never began, not one ending. Shell drops to
1 RTT.

**(c) Server-side prefetch** of `/auth/me` + `/periods` in the `(app)` layout,
shipped through `HydrationBoundary`. Removes both round trips entirely.
**This is an architecture decision, not a cleanup**: it puts private data in the
RSC payload, which reverses the stance in `apps/web/README.md` 8.2. README 8.3
already says how it would have to be done — verify the session *at that data
access point* with the incoming cookie and honour its 401. **Recommendation: do
not do this before delivery.** It is defensible, but it changes a documented
security boundary and deserves its own spec.

### C2. The whole shell waits on `/auth/me`

`components/auth-gate.tsx:70` returns a single `Skeleton h-8 w-48` while pending,
and `AuthGate` wraps the entire layout (`app/(app)/layout.tsx:15`). The sidebar,
brand, nav and header are all public and data-free, yet none paints until the
network answers — a poor LCP and a guaranteed layout shift.

**Fix**: render the chrome unconditionally and gate `<main>` only. `UserMenu`
already returns `null` without a user, and `AppNav` is static, so this is safe.
Small diff, largest paint win.

### C3. Changing the period blanks the table

`components/period-scope.tsx:79` — `router.replace` changes the query key and the
table drops to a skeleton on every month change.

**Fix**: `placeholderData: keepPreviousData` on the analytics queries. Verified
present in the installed `@tanstack/query-core@5.102.8`. Optionally wrap
`router.replace` in `startTransition` and dim off `isPending`. Highest
felt-quality change in this list, ~6 lines.

**Related**: the global `staleTime: 30_000` (`app/providers.tsx:36`) makes
Dashboard → Projects → Dashboard refetch everything after 30 s for no reason.
Analytics data changes only on an import or an assumptions save, and **both
already invalidate explicitly** (`lib/imports.ts:66`, `lib/settings.ts`). Because
invalidation is trustworthy, analytics queries can take a much longer
`staleTime`. Leave `["auth","me"]` at 30 s — README 3.8 documents that on
purpose.

### C4. Cheap computation cleanups

| Location | Issue |
| --- | --- |
| `components/productivity/productivity-view.tsx:60` | `map → filter → Set → sort` rebuilds the department list on every render |
| `components/productivity/productivity-view.tsx:68` | `filter` then `reduce` over the same rows — one pass, memoised on `[employees, department]` |
| `components/departments/departments-view.tsx:69` | two `find`s run before the `length === 0` early return — move the return up |
| `components/projects/projects-view.tsx:70` | totals `reduce` over every project on each render — `useMemo` |
| `components/data/uploads-view.tsx:180` | `new Date(...).toLocaleString("en-AE")` per row builds an `Intl` formatter each time — hoist one module-level `Intl.DateTimeFormat`, exactly as `lib/format.ts` already does for numbers |

### C5. Housekeeping

`shadcn` (a CLI, ~900 KB) sits in `dependencies` in `apps/web/package.json:20`
but is only reached at build time through `@import "shadcn/tailwind.css"`. It
belongs in `devDependencies`. No effect on the client bundle; install and deploy
image only.

---

## D. Corrections to the performance report

**D1. `/projects/[refCode]` cannot be made static — the stated cause is wrong.**

The report claims the route is dynamic "solely because `page.tsx:14` does
`await params`", and that reading the ref code with `useParams()` would let it
prerender.

**Verified empirically**: the page was temporarily replaced with one that takes
no props, awaits nothing and renders a static skeleton. It still builds as
`ƒ /projects/[refCode]`. The cause is that it is a dynamic segment with no
`generateStaticParams` — Next's documented default. `useParams()` changes
nothing.

Making it static would require `generateStaticParams`, which would mean
enumerating ref codes at build time from imported, private, changing data.
**No action. The route is correctly dynamic.**

(The experiment was reverted; the tree is clean.)

**D2. Bundle advice is right — do not act on it.** `lucide-react` is already in
Next's default `optimizePackageImports` (confirmed in
`next/dist/server/config.js`) and `@base-ui/react` is imported by deep path.
Adding config would be a no-op. 240 KB gzipped is not this app's problem.

**D3. Route count**: the build prints 10 route rows, not 11. Cosmetic.

**D4. Virtualization / `content-visibility`** (report §6): the largest table in
the supplied dataset is 12 employees. No action until a real dataset says
otherwise.

---

## E. Recommended order before delivery

**Tier 1 — correctness, small diffs, do these**
1. A1 month filter contradiction
2. A2 staged file survives a rejected upload
3. A3 group loading shape

**Tier 2 — felt quality, small diffs, do these**
4. C2 render the shell without waiting on `/auth/me`
5. C3 `keepPreviousData` + longer analytics `staleTime`

**Tier 3 — simplification, mechanical, do these**
6. B4 one shape in `analytics.ts` + delete the four dead exports
7. B3 one `PeriodDescriptor`
8. B1 productivity footer uses `companyProductivity`
9. B5 + B6 one skeleton, one retry sentence
10. B7 `TablePanel` replaces the eight `py-0` overrides
11. B8 delete dead code and unused fields
12. C4 the five memo/early-exit/Intl cleanups
13. C5 move `shadcn` to `devDependencies`

**Tier 4 — needs your decision**
14. C1(a) start the leaf query from the URL — also removes B2 and B9.
    Recommended: yes.
15. C1(b) exempt pre-session 401s so `/periods` runs alongside `/auth/me`.
    Recommended: yes, it is also more correct.
16. C1(c) server-side prefetch. **Recommended: not before delivery** — it
    reverses a documented boundary and needs its own spec.

**Explicitly not doing**
- B10 `VerdictBanner` prop trim — cosmetic, touches the approved design's copy.
- D1 `/projects/[refCode]` static — impossible as described.
- D2 bundle config — no-op.
- D4 virtualization — no evidence of need.
- Consolidating the `scope.gate ?? (isPending ? … : isError ? … : <Table/>)`
  chain repeated in five views. It is six lines five times, but a render-prop
  `<QueryState>` would hide the loading/error decision inside a component and
  make the flow harder to follow. Explicit wins.

**None of the above changes the approved design.** B7 removes an override that
cancels padding, so the rendered result is identical; A3 and B5 change skeleton
shapes only; everything else is behaviour or structure.

---

## F. Verification checklist for whoever implements this

Behaviour changes to confirm, not just compile:

| Change | Check |
| --- | --- |
| A1 | `/?year=2025&month=<uncovered>` — filter and gate agree |
| A2 | Upload a text file named `.xlsx` — the staged panel and the year survive |
| B1 | Filter Productivity to a department — footer reads `companyProductivity` |
| C2 | Throttle the network — sidebar and nav paint before `/auth/me` answers |
| C3 | Change month — the previous table stays, dimmed, and does not blank |
| C1(a) | Network panel: a bookmarked URL issues two requests, not three |
| C1(b) | Signed out, load `/` — no spurious `endSession`, no redirect loop |
| Every tier-3 item | Walk all six screens plus the project page against the running API — the analytics rewrite touches every query key, and a wrong key serves the wrong period silently instead of failing |

Then: `tsc --noEmit`, `lint`, `build`, and a 375 px pass for horizontal
overflow.
