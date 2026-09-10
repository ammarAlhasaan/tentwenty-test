/**
 * Client-side session bookkeeping: what the current user query is called, what
 * counts as private cached data, and the transitions between sessions.
 *
 * This is request-lifecycle bookkeeping, not a second store of who is signed in.
 * `["auth", "me"]` in the React Query cache remains the only thing the UI reads.
 */

import type { Query, QueryClient } from "@tanstack/react-query";

export type AuthUser = { id: number; email: string };

export const authKeys = {
  all: ["auth"] as const,
  me: () => ["auth", "me"] as const,
};

/**
 * Cache convention: a key whose first segment is `"auth"` is session metadata,
 * every other key is private data belonging to one signed-in user. A later
 * feature keying on `["projects", ...]` is cleared on a session change with no
 * registration step to forget.
 */
export function isPrivateQuery(query: Query): boolean {
  return query.queryKey[0] !== "auth";
}

/**
 * Incremented at every session boundary. `cancelQueries` aborts in-flight
 * *queries*; it does nothing to mutations, so a mutation started under a
 * previous session can still resolve after a new one began. Operations stamp
 * this counter when they start and check it before touching shared state.
 */
let generation = 0;

export type SessionStamp = { generation: number };

export function stampSession(): SessionStamp {
  return { generation };
}

/**
 * `true` for an operation that belongs to the session running now. An unstamped
 * value is treated as current: only session-sensitive callbacks need a stamp,
 * and every private mutation is expected to supply one from `onMutate`.
 */
export function isStampCurrent(stamp: unknown): boolean {
  if (typeof stamp === "object" && stamp !== null && "generation" in stamp) {
    return (stamp as SessionStamp).generation === generation;
  }
  return true;
}

/**
 * Opens a new generation and drops the previous one's cached data.
 *
 * Returns `false` when a newer transition started while this one was awaiting,
 * so a late-finishing sign-out cannot overwrite a newer successful sign-in.
 *
 * Cancelling aborts the browser's requests. It does not undo work `apps/api`
 * has already done for them.
 */
async function rotate(
  queryClient: QueryClient,
  { includeCurrentUser }: { includeCurrentUser: boolean },
): Promise<boolean> {
  const mine = ++generation;

  // An in-flight /auth/me from the old session would write its result over the
  // new current user, so a transition that is about to set one cancels it too.
  // A transition triggered *by* /auth/me must not: cancelling the query that
  // just answered reverts it, its observer refetches, and the two loop.
  await queryClient.cancelQueries(
    includeCurrentUser ? undefined : { predicate: isPrivateQuery },
  );
  if (mine !== generation) return false;

  queryClient.removeQueries({ predicate: isPrivateQuery });
  return true;
}

/** A sign-in succeeded: clear the previous session, then seed the new user. */
export async function beginSession(
  queryClient: QueryClient,
  user: AuthUser,
): Promise<void> {
  if (await rotate(queryClient, { includeCurrentUser: true })) {
    queryClient.setQueryData(authKeys.me(), user);
  }
}

/** The session ended — deliberately, or because the API said 401. */
export async function endSession(queryClient: QueryClient): Promise<void> {
  if (await rotate(queryClient, { includeCurrentUser: true })) {
    queryClient.setQueryData(authKeys.me(), null);
  }
}

/**
 * Same cleanup, for the case where `/auth/me` itself answered 401 and the query
 * already holds `null`. Writing `null` again here would be redundant; the
 * private data still has to go.
 */
export async function dropPrivateSession(queryClient: QueryClient): Promise<void> {
  await rotate(queryClient, { includeCurrentUser: false });
}

/**
 * One-shot marker distinguishing a deliberate sign-out from an expiry, so the
 * single navigation owner can decide whether to say the session ended.
 */
let deliberateSignOut = false;

export function markDeliberateSignOut(): void {
  deliberateSignOut = true;
}

export function consumeDeliberateSignOut(): boolean {
  const value = deliberateSignOut;
  deliberateSignOut = false;
  return value;
}

/**
 * Post-sign-in destinations, as a literal allowlist. Filtering a URL instead
 * invites the browser's parser and the filter to disagree about inputs like
 * `//host` or `/\host`; there is no such gap in a lookup.
 *
 * Pathnames only. A screen whose state lives in the query string — the
 * dashboard's `?year=&month=` — returns to its default period after an expiry.
 * Carrying the query through would mean accepting an arbitrary string here,
 * which is the gap the allowlist exists to close.
 *
 * A new screen is added by appending its path to this list and to AppNav.
 */
const RETURN_TO = ["/", "/projects", "/productivity", "/categories"] as const;

export function safeReturnTo(value: string | null | undefined): string {
  return RETURN_TO.includes(value as (typeof RETURN_TO)[number]) ? value! : "/";
}
