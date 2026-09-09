# Phase 0 Research: FE-01 — Frontend Foundation

All versions below were read from the installed tree in this worktree's checkout
(`apps/web/package.json` and `node_modules`), not from memory. Documentation was read from the
copy shipped inside the installed package (`apps/web/node_modules/next/dist/docs/`), which is the
source `apps/web/AGENTS.md` requires for this Next.js version.

## Installed versions

| Package | Declared | Installed |
|---|---|---|
| `next` | `16.3.4` | 16.3.4 |
| `react` / `react-dom` | `19.2.8` | 19.2.8 |
| `tailwindcss` | `^4` | 4.3.3 |
| `@base-ui/react` | `^1.8.0` | 1.8.0 |
| `@tanstack/react-query` | `^5.102.8` | 5.102.8 |
| `zustand` | `^5.0.15` | 5.0.15 |
| `class-variance-authority` | `^0.7.1` | 0.7.1 |
| `cn` | `^0.2.6` | 0.2.6 |
| `lucide-react` | `^1.43.0` | 1.43.0 |
| `shadcn` (CLI) | `^4.21.0` | 4.21.0 |
| `tw-animate-css` | `^1.4.0` | 1.4.0 |

Node `>=24.15.0` (root `engines`), pnpm 11.9.0.

## Decision 1 — Error boundaries use `retry`

**Decision**: `app/error.tsx` is a Client Component whose props are `{ error, retry }`, and the
retry control calls `retry()`.

**Evidence**: `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`, section
"Nested error boundaries", shows `export default function ErrorPage({ error, retry }: { error:
Error & { digest?: string }; retry: () => void })`. The installed type
(`node_modules/next/dist/client/components/error-boundary.d.ts`, lines 5-6) declares **both**
`reset: () => void` and `retry: () => void` on `ErrorInfo`.

**Why `retry`**: both props exist and both are callable, so this is a consistency choice rather
than a correctness one — `retry` is what the documentation shipped with this version uses, and
Constitution Principle I says to follow the framework's own documentation. There is no runtime
difference to guard against.

**Rejected**: `catchError` from `next/error` for component-level recovery. It is the right tool
once a page has several independently failing regions; this spec has one failure surface per route,
which the file convention already covers.

## Decision 2 — One root layout, no route group

**Decision**: The shell lives in `app/layout.tsx`. No `(app)` route group is introduced.

**Why**: A route group earns its place when some routes must opt out of a layout, or when a segment
needs its own `loading.tsx`
(`docs/01-app/01-getting-started/02-project-structure.md`, "Organizing your project"). Every route
in this spec, and every route foreseen in the next one, sits inside the same shell. Adding the
group now would be structure ahead of a requirement (Constitution Principle II).

**Revisit when**: authentication lands and a signed-out route needs a different frame, or one
section needs a segment-specific skeleton.

## Decision 3 — Server Components by default; two client boundaries

**Decision**: Everything is a Server Component except `components/app-nav.tsx` and
`components/error-state.tsx`.

**Why**: `app-nav.tsx` needs `usePathname()` to mark the current section (FR-003).
`error-state.tsx` carries the retry control and is rendered from `app/error.tsx`, which the
framework requires to be a Client Component. Nothing else in this spec has state, effects or event
handlers. The existing `app/providers.tsx` is already a client boundary and is reused unchanged.

**Consequence**: the shell, the page content and the navigation *links* are server-rendered and
readable before hydration; only the current-item highlight and the retry button need JavaScript.

**Corrected after implementation**: the shadcn generator emits `components/ui/table.tsx` with
`"use client"` at the top, so there are *three* client boundaries, not two. The file has no state,
effect or handler, so the directive buys nothing here — but it was left exactly as generated
(T008a permits only the `scope` change), because editing it would drift from what the next
`shadcn add` produces. The table's markup is still server-rendered; only its hydration cost is
affected.

## Decision 4 — Reuse the React Query provider unchanged; add no Zustand store

**Decision**: `app/providers.tsx` stays exactly as it is. No store is created.

**Why**: FE-01 makes no request, so there is no API data for React Query to own and nothing to
configure defaults against — defaults chosen without a query to apply them to would be guesses.
Zustand is for shared UI state (Constitution, Repository Boundaries), and this spec has none: the
only piece of UI state is the current route, which the router already owns and `usePathname()`
already reads. Creating a store here would be the textbook case of Principle II.

**Note for FE-02**: the provider's `useState(() => new QueryClient())` form is the pattern TanStack
documents for the App Router and needs no change. The Next.js guide
(`docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md`) shows a module-singleton
variant; both keep the server render isolated. Leaving it alone avoids churn on a file this spec
has no reason to touch.

## Decision 5 — UI primitives come from the configured shadcn style, with a lockfile guard

**Decision**: Generate `button`, `card`, `table` and `skeleton` with the already-installed `shadcn`
CLI against the project's configured `base-nova` style, then verify that neither
`apps/web/package.json` nor `pnpm-lock.yaml` changed. If either did, revert the dependency change,
keep the component source, and record the missing package in this spec's notes for coordination
instead of installing it.

**Why the guard**: BE-02 is in flight in a sibling worktree. `pnpm-lock.yaml` is a shared file; a
lockfile change here would land in the backend's next rebase for no backend reason (FR-024). The
brief's own constraint — no `--force`, no `--legacy-peer-deps` (Constitution Principle VII) — makes
an unplanned install doubly unwelcome mid-stream.

**Why it is expected to be a no-op**: `components.json` sets `"style": "base-nova"`, whose
primitives are built on `@base-ui/react`, `class-variance-authority`, `cn` and `lucide-react` — all
four already installed. `button` and `card` in this style are plain elements with `cva` variants;
`skeleton` is a single `div`; `table` is semantic table markup. None of them reaches for a
component from `@base-ui/react`'s interactive set. This is an expectation, not a verified result —
the guard task exists precisely because it is unverified until run.

**Rejected**: hand-writing the four primitives. It would sidestep the lockfile question entirely,
but it also abandons the project's configured style, so the components added by FE-02 through the
CLI would not match the ones written by hand here.

## Decision 6 — Tokens extend the existing Tailwind v4 `@theme`, and only by two

**Decision**: Keep every token already in `app/globals.css`. Add exactly two colour pairs —
`--positive` and `--negative`, defined for both `:root` and `.dark` — plus one utility for
fixed-width digits.

**Why**: The neutral shadcn scale, radii, and both colour schemes are already defined and already
correct. What the file does not have is any way to render a signed financial figure, which is the
whole subject of this application (FR-008). Everything else the pages need — spacing, radius, the
type scale — Tailwind v4 already provides.

**Why not a semantic chart palette now**: `--chart-1` … `--chart-5` already exist as a neutral
ramp. No chart is rendered by this spec; re-colouring them for charts that do not exist would be
speculative.

**Fixed-width digits**: Tailwind v4 ships `tabular-nums` (`font-variant-numeric`), so FR-009 needs
a class applied at the right places, not a new token. The Geist family already configured supports
tabular figures.

## Decision 7 — Responsive navigation without a drawer

**Decision**: A persistent side rail at `md` and above; below it, the same links as a horizontally
scrollable row inside the header.

**Why**: A drawer needs a dialog primitive, focus trapping, a scroll lock and an open/close state —
a client component and a Zustand-or-local state decision, for four links. A scrollable link row
needs none of that, stays server-rendered, keeps every link reachable by keyboard in reading order
(FR-011), and cannot trap focus because it never traps anything.

**Rejected**: `@base-ui/react`'s `drawer`. It is installed and would work; it is simply more
machinery than four links justify (Constitution Principle II).

## Decision 8 — Repair the sans font binding (an existing token, deliberately changed)

**Decision**: Change two lines in the existing `@theme inline` block of `apps/web/app/globals.css`:

```css
/* before */                          /* after */
--font-sans: var(--font-sans);        --font-sans: var(--font-geist-sans);
--font-heading: var(--font-sans);     --font-heading: var(--font-geist-sans);
```

**Why this is a defect, not a preference**: `app/layout.tsx` loads Geist under the CSS variable
`--font-geist-sans` (`layout.tsx:7`) and Geist Mono under `--font-geist-mono` (`layout.tsx:12`).
The mono token is wired correctly (`--font-mono: var(--font-geist-mono)`), but the sans token
resolves to itself — `--font-sans: var(--font-sans)` — so `html { @apply font-sans }`
(`globals.css:128`) inherits nothing and the whole document silently falls back to the browser's
default sans. `--font-heading` chains off the same broken reference.

**Why it belongs in this spec**: FR-007 makes typography part of the token set, and US1 is assessed
on legible typography. Delivering a foundation whose heading and body font never loads would put
the defect under new code rather than fixing it, and every later spec would inherit it.

**Scope of the exception**: these two lines only. No other existing token is renamed, removed or
re-valued — T004 carries the exception explicitly so the rule and its one exception are read
together.

## Not applicable

- **Database / data model** — this spec persists nothing and reads nothing. `data-model.md` records
  why.
- **API contracts** — this spec issues no request. `contracts/README.md` records why. The contracts
  the later frontend specs consume are defined by the backend specs, per Constitution Principle V.
- **Performance targets** — a single local reader, no data, no request. The build's own output is
  the only size signal, and no budget is set.
- **Automated test strategy** — excluded by FR-026 at the owner's direction, consistent with BE-01,
  which removed its test suite for the same reason. `quickstart.md` carries the manual checks.
