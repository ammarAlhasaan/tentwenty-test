# Frontend API conventions — moved

The maintained source is **[`apps/web/README.md`](../../../apps/web/README.md)**, next to the code it
governs. There is deliberately only one copy: a duplicate here would drift.

It covers, for every FE spec from FE-02 onward:

1. Talking to the API — one `apiFetch`, one base URL, `credentials: "include"`, JSON vs `FormData`,
   `204` and empty bodies, status checked before an empty result.
2. Errors — one `ApiError`; HTTP vs network vs cancellation kept distinct; non-JSON failure bodies.
3. React Query — one client, one key per resource, `signal` forwarding, the retry policy, freshness
   for `["auth","me"]`, no polling, the `networkMode` pause, and the v5.102.8 callback signatures.
4. Session and cache lifecycle — `beginSession` / `endSession` / `dropPrivateSession`, and why a
   `401` from `/auth/me` performs the same cleanup as any other `401`.
5. Protecting the current session from a previous one — the session generation counter and the
   mutation stamp, because `cancelQueries` does not cancel mutations.
6. Navigation ownership — one owner per transition; deliberate sign-out vs expiry.
7. Credentials — what mutation state actually retains, and what we do about it.
8. Next.js boundaries — the client gate as a UX boundary only, and loading/error/not-found placement.
9. State ownership — React Query only; no Zustand auth store.
10. A checklist for adding the next API-backed feature.
