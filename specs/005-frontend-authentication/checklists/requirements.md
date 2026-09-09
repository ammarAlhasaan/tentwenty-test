# Requirements checklist: FE-02 — Frontend Authentication and API Foundation

For the reviewer, before implementation begins. Each item is answerable from the artifacts.

## Scope and constitution

- [ ] Targets `apps/web` exclusively; no `apps/api` file appears anywhere in the plan or tasks
      (Principle V).
- [ ] Does not depend on any unlanded contract — only BE-02's merged endpoints (Principle VI).
- [ ] No shared package, no shared type, no import crossing the two applications (Principle IV).
- [ ] No dependency added; every library decision was checked against the *installed* version
      (Principle VII).
- [ ] Every new file has a stated requirement forcing it (Principle II).
- [ ] No result is asserted anywhere in the artifacts as already verified (Principle VIII).

## Transport

- [ ] One `apiFetch`; components neither call `fetch` nor parse responses.
- [ ] Base URL from one environment setting; `credentials: "include"` always.
- [ ] JSON headers only for JSON bodies; `Content-Type` omitted for `FormData`.
- [ ] `response.ok` checked; `204` and empty bodies not parsed.
- [ ] One normalized error shape; a non-JSON failure body still produces it, without a second error.
- [ ] HTTP status and backend validation messages preserved.
- [ ] Network failure and cancellation distinguishable from HTTP failure.
- [ ] `AbortSignal` accepted and forwarded.
- [ ] No routing, hooks, notifications or cache access inside the transport.
- [ ] No Axios, interceptors, SDK generator, generic repository or transport framework.

## React Query

- [ ] The existing provider and its single stable client are reused.
- [ ] `["auth", "me"]` defined once and imported everywhere.
- [ ] Reads are queries; sign-in and sign-out are mutations.
- [ ] Keys contain every input affecting the result.
- [ ] Retry: none for the auth mutations; none for `400`/`401`/`403`/`429`; none for cancellations;
      at most one for transient read failures.
- [ ] Freshness and refetch behaviour for `/auth/me` stated; no polling.
- [ ] No v4-only `useQuery` callback patterns; the v5.102.8 mutation-callback signature is used.
- [ ] React Query is the only cache for session data — no Zustand auth store, no duplicate
      `isAuthenticated`, no `localStorage`.
- [ ] Form values and password visibility are local to the form.

## Error and session policy

- [ ] One shared policy covering both queries and mutations, via `QueryCache` / `MutationCache`;
      no event bus.
- [ ] Login `401` ≠ `/auth/me` `401` ≠ protected `401`, each handled distinctly.
- [ ] `403` does not sign the user out.
- [ ] `400` produces relevant validation feedback.
- [ ] `429` produces rate-limit feedback with no automatic retry.
- [ ] Network failures and `5xx` are recoverable and never reported as signed out.
- [ ] No duplicated per-page `onError`; concurrent failures produce one message and one navigation.
- [ ] Expected failures land in form or page state; `error.tsx` stays for uncaught rendering failures.

## Auth flow and cache isolation

- [ ] Login page, current-user display, sign-out, authenticated shell, and session-check loading and
      recoverable-failure states all specified.
- [ ] On sign-in: cancel and remove previous private data, seed the current user from the login
      response, then navigate — in that order.
- [ ] On sign-out: cancel, remove, set signed-out, navigate.
- [ ] An in-flight response from an old session cannot repopulate private data; cancellation signals
      reach `fetch`.
- [ ] A failed sign-out is never reported as a success; a retry is offered.
- [ ] Return destinations come from an explicit allowlist; external and protocol-relative targets are
      rejected.
- [ ] The session cookie is never read, decoded, copied or stored; no second session mechanism.

## Routes and Next.js boundaries

- [ ] Root layout keeps the document and providers; public login separated from the authenticated
      shell.
- [ ] `/auth/me` resolves before private UI renders; private queries do not start while unresolved or
      signed-out.
- [ ] One current-user query used across the UI.
- [ ] Direct visits, refresh, navigation and expiry handled with no redirect loop; a signed-in user
      visiting `/login` reaches the application.
- [ ] The client gate is documented as a UX boundary; Nest's guards are the authorization boundary.
- [ ] No private data in server-rendered HTML or the RSC payload behind only a client gate; the rule
      for any future server-side private fetching is stated.
- [ ] No `proxy.ts` cookie-presence check; no copied session secret or database; no Next auth
      framework, BFF, or duplicate API routes.

## Verification

- [ ] No unit, integration or E2E tests; no test dependency, mock, fixture, configuration or script.
- [ ] Manual guide covers every listed scenario: direct protected visit, refresh, successful and
      failed sign-in, input validation, safe return navigation, sign-out and Back, expiry and deleted
      user, backend unavailable without a loop, rate-limit feedback, concurrent `401`s, sign-out or
      account change mid-flight, no previous-account data, `HttpOnly` behaviour in a real browser,
      keyboard and responsive behaviour.
- [ ] Lint, TypeScript and build gates are present and unclaimed.
- [ ] The guide requires an isolated verification database and forbids debug endpoints.

## Deliverables

- [ ] Spec, research, plan, tasks and manual guide all present.
- [ ] A "Frontend API conventions" document exists, distinguishes **[library]** from **[ours]**, and
      carries source links.
- [ ] Exact files and routes listed.
- [ ] Query keys and cache lifecycle listed.
- [ ] Centralized request and error flow described.
- [ ] Auth states and redirects enumerated.
- [ ] Security boundaries and deployment assumptions stated.
- [ ] Contract mismatches requiring backend coordination listed — or their absence stated explicitly.
