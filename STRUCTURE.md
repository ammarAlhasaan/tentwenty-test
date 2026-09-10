# Folder structure

The layout follows the conventions each tool documents for itself — a pnpm workspace with an
`apps/*` root (the standard monorepo shape used by pnpm workspaces, Turborepo and Nx), NestJS
feature modules, and the Next.js App Router.

```
.
├── apps
│   ├── api          # NestJS backend
│   └── web          # Next.js frontend
├── specs            # Spec Kit: one folder per feature (spec, plan, tasks)
├── AGENTS.md        # project rules
└── pnpm-workspace.yaml
```

Nothing is shared between the two apps — no shared package, no shared types. A type needed on both
sides is written twice. That is the price of keeping the apps genuinely independent, and it is
cheap at this size.

## apps/api — NestJS

The standard NestJS shape: one folder per feature, each holding its module, controller, service and
Zod schema.

```
src
├── main.ts, app.module.ts, config.ts
├── auth/            # login, session cookie, guard, Prisma session store
├── imports/         # spreadsheet upload + one parser per file type
├── analytics/       # dashboard, projects, departments, productivity, categories
│   └── cost-model.ts   # the pure calculation — no Nest, no Prisma
├── settings/        # overhead and billable categories
├── prisma/          # Prisma module and service
└── common/          # origin guard, HTTP exception filter
```

Two things worth pointing at:

- **`cost-model.ts` is pure functions.** No framework, no database. That's what makes it testable in
  a single file with no mocks, and it keeps the arithmetic readable on its own.
- **Controllers validate, services decide, Prisma persists.** Every request body goes through a Zod
  schema at the edge.

## apps/web — Next.js App Router

```
app
├── (auth)/login/    # route group: the unauthenticated page
├── (app)/           # route group: everything behind the session
│   ├── page.tsx     # dashboard
│   ├── projects/[refCode]
│   ├── departments/ productivity/ categories/
│   └── uploads/ assumptions/
├── layout.tsx, providers.tsx, globals.css
components
├── ui/              # shadcn primitives
├── dashboard/ projects/ departments/ ...   # one folder per feature view
└── *.tsx            # shared pieces (page header, nav, states, notices)
lib
└── api.ts + one file per feature's endpoints (auth, analytics, imports, settings)
```

- **Route groups** (`(app)`, `(auth)`) separate the authenticated shell from the login page without
  adding a segment to the URL — the App Router's documented way to do that.
- **Pages stay thin**; each one renders a `*-view` component that holds the feature.
- **One transport.** Every request goes through `apiFetch` in `lib/api.ts`; no component calls
  `fetch` itself. Endpoint functions live beside their feature.
- **React Query owns server data, Zustand owns shared UI state**, and API data is never copied into
  a store.
