# Margin Dashboard

Upload the timesheet, salary and project spreadsheets, and the app answers one question straight
away: **did we make money, and where?**

Two independent apps in one repository, talking only over HTTP:

- `apps/web` — Next.js frontend (port 3000)
- `apps/api` — NestJS backend (port 4000)

## Requirements

- Node **24.15+** (`.nvmrc` pins 24.21.0 — `nvm use`)
- pnpm **11.9.0** (`corepack enable`)

No database server, no cloud account, no API key. SQLite file on disk.

## Install and run

```bash
pnpm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
pnpm --filter api db:deploy
```

```bash
pnpm dev
```

| App | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:4000 |

Health check: `curl http://localhost:4000/health` → `{"status":"ok"}`

Every `.env` value has a working local default, so no edits are needed. Details on the settings and
the error shape live in [apps/api/README.md](apps/api/README.md).

## Sign in

A demo user is created on first start — no seed command, password hashed with Argon2id.

| email | password |
| --- | --- |
| `demo@tentwenty.local` | `demo-password-2026` |

## What's inside

Upload the three spreadsheets under **Data → Uploads** — or press **Load the sample workbooks**
to fill the app with the provided data in one click — then read the results:

| Page | Answers |
| --- | --- |
| Dashboard | Did the agency make money this period? |
| Projects | Which projects paid off, which cost more than they sold for? |
| Departments | Which departments carry their cost? |
| Productivity | How much of paid time is billable? |
| Categories | Which kinds of work are worth doing? |
| Assumptions | The overhead figure and the billable categories, editable |

## Decisions, and why

**NestJS for the backend, not Next.js route handlers.** Splitting the two apps was deliberate. A
separate backend keeps the calculation in one place, gives more flexibility later (a second client,
a different deployment, background jobs), and let me spend the bulk of the assessment on the
frontend without the API bleeding into it. NestJS itself because it's TypeScript-first, has an
obvious structure (module / controller / service), and needs no ceremony to get running.

**All calculation happens on the backend.** Exactly as a production app would do it: the browser
never computes profit, cost or margin — it renders what the API returns. Numbers the user can edit
in the UI can't be nudged into a better-looking result, and there is a single source of truth for
the arithmetic.

**Honest gaps instead of quiet subtotals.** When a month is missing salaries or a project price,
the API withholds profit and margin rather than reporting a partial figure that looks complete. The
UI shows that as an explicit "we can't tell yet".

**Prisma + SQLite** for persistence — zero-setup, and the schema is versioned in migrations.

**React Query owns all API data; Zustand only holds shared UI state.** API data is never copied
into a store.

**Spec Kit** was used throughout to keep the work tracked and the quality consistent: every feature
started as a spec, a plan, and a task list under [`specs/`](specs), and was implemented against
them. That's why the history reads as deliberate steps rather than one large drop.

## Design

- **One large answer box at the top of the dashboard.** The whole point of the tool is a verdict, so
  the verdict is the first thing on screen, in a full-width box — "Yes, the agency made money this
  month", with profit and margin beside it. No hunting through tables for the number that matters.
  The same box appears on a project page, scoped to that project.
- **Colours are taken from the TenTwenty website**, so the app looks like it belongs to the brand
  rather than to a component library's defaults.
- Contrast was checked: any brand value that failed WCAG AA as text was darkened, with the measured
  ratio recorded next to it in [`globals.css`](apps/web/app/globals.css).

## Tests

**In progress — landing shortly.** The plan is written up in
[`specs/009-cost-model-tests/`](specs/009-cost-model-tests): nine focused cases on
[`cost-model.ts`](apps/api/src/analytics/cost-model.ts), run with Vitest.

The cases were chosen to cover the calculation that actually carries risk, not to inflate a
coverage number:

- the assessment's own reconciliation self-check — with overhead at zero, total cost must equal
  total salaries **to the dirham** (this is what catches double counting), across one month and
  across two months with changing salaries;
- overhead enters once per month, not once per employee;
- the direct rate divides salary by *all* logged hours, not billable hours only;
- the indirect pool and rate are composed without including themselves;
- an employee with hours but no salary row is reported as incomplete, and the balance still closes;
- a month with no billable hours yields no rate instead of dividing by zero;
- the billable-category match is case-insensitive, and a negative margin stays negative.

Deliberately out of scope: parsers, controllers, the Prisma-backed service, and the frontend. High
cost, low return here — the calculation layer is where a mistake changes a number.

## Further reading

- [STRUCTURE.md](STRUCTURE.md) — folder layout and the conventions behind it
- [ROADMAP.md](ROADMAP.md) — what's left and what I'd build next
- [apps/api/README.md](apps/api/README.md) — endpoints, settings, database
- [apps/web/README.md](apps/web/README.md) — frontend conventions
