# Quickstart: verifying the cleanup

Every command below is run from the worktree root. All of them must be executed and their real
output reported (constitution Principle VIII).

## Prerequisites

```bash
pnpm install --frozen-lockfile
```

Dependencies are removed in the last pass, so run this again after that pass and confirm the
lockfile change is limited to the three removed packages.

## Gate 1 — the test suite

The nine cost-model cases are the regression gate for the backend pass. They are not modified by
this change.

```bash
pnpm --filter api test
```

**Expected**: `Test Files 1 passed (1)`, `Tests 9 passed (9)`.

A failure here after pass 1 means an export was narrowed that the suite imports, or the unpriced
predicate change reached further than intended.

## Gate 2 — type checking

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
```

**Expected**: no output, exit code 0, from both.

This is the gate that catches a removed export still being imported, a removed prop still being
passed, and a removed type still being referenced.

## Gate 3 — linting

```bash
pnpm --filter api lint
pnpm --filter web lint
```

**Expected**: no findings from either.

## Gate 4 — builds

Run only at the end. A build is slow, and nothing before the stylesheet pass can break one without
also failing the typecheck.

```bash
pnpm --filter api build
pnpm --filter web build
```

**Expected**: both succeed. The frontend build is the only check that compiles the stylesheet, so
it is the one that would catch a token removed from `@theme` while a utility still references it.

## Gate 5 — unused-code analysis

```bash
npx knip@latest --no-progress
```

**Expected**: no unused files, and no unused dependencies other than `@prisma/client`, which the
tool cannot see through the generated client. `prisma7.config.ts` is also expected to remain
listed as an unused file; it is loaded by the Prisma CLI, which the tool does not model.

Both are documented in [research.md](research.md) as verified false positives. Every other entry
the tool reported before this change should be gone.

## Gate 6 — behaviour unchanged

The application must render the same content as before. Start both processes:

```bash
pnpm dev
```

Sign in, then confirm each page still loads and shows the same figures: Dashboard, Projects, a
project detail page, Departments, Productivity, Categories, Assumptions, Uploads.

Pay attention to three places the change touches directly:

1. **Uploads → import history** — the table renders as before. This is the type corrected by
   FR-010; nothing visible should change, because the removed fields were always `undefined`.
2. **Statistic cards on the dashboard** — the share bar renders as before. It is now the shared
   component rather than a second copy.
3. **The period filter** — the year and month selects behave as before, including when only one
   year is present. The `disabled` prop was removed and its guard simplified.

## Gate 7 — the one intended behaviour change

FR-011 is the single exception to "nothing changes". To see it:

1. Load the sample data.
2. Import a timesheet carrying billable hours for a ref code whose project row has a null or
   zero price.
3. **Expected**: the import now reports that ref code as having billable hours and no price. It
   did not before. The dashboard already reported the same gap, so the two now agree.

If no such ref code exists in the sample data, this gate is verified by reading the two predicates
and confirming they are now identical, and that fact is reported as such rather than as a run.
