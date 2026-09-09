# Project rules

Two independent applications in one repository:

- `apps/web` — Next.js frontend, port 3000
- `apps/api` — NestJS backend, port 4000

## Boundaries

- The apps communicate through HTTP APIs only.
- No shared application code, types, schemas, or logic between them. Duplicate a type rather than introduce a shared package.
- Next.js handles presentation and interaction.
- NestJS handles calculations, validation, and persistence.

## Frontend state

- React Query owns all API data.
- Zustand is only for shared UI state.
- Never duplicate API data in Zustand.

## Working style

- Keep the code simple and readable.
- Add a folder, abstraction, dependency, or script only when an actual requirement calls for it.
- Follow official documentation matching the installed versions.
- Run the relevant checks and report only results you actually verified.
