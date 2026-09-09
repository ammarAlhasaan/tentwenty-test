"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  isCancelledError,
} from "@tanstack/react-query";
import { useState } from "react";
import { isAbortError, isApiError } from "@/lib/api";
import { authKeys, dropPrivateSession, endSession, isStampCurrent } from "@/lib/session";

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isCancelledError(error) || isAbortError(error)) return false;
  // Any 4xx — 400, 401, 403 and 429 included — fails identically on a second
  // attempt, and retrying a 429 makes it worse.
  if (isApiError(error) && error.status !== null && error.status < 500) return false;
  return failureCount < 1;
}

function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

function isMeQuery(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === authKeys.me()[0] && queryKey[1] === authKeys.me()[1];
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    // The cache callbacks close over the client they are given to. They only run
    // after construction, so the reference is resolved by the time it is read.
    const client: QueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: shouldRetry, staleTime: 30_000 },
        mutations: { retry: false },
      },

      queryCache: new QueryCache({
        onSuccess: (data, query) => {
          // Expiry also arrives as /auth/me answering 401, which fetchMe turns
          // into null. That is still the end of a session and must run the same
          // cleanup a protected 401 runs. Starting out signed out is the same
          // call with nothing to clean: no message, no navigation, no refetch.
          if (isMeQuery(query.queryKey) && data === null) {
            void dropPrivateSession(client);
          }
        },
        onError: (error, query) => {
          // /auth/me never reaches here with a 401 — it resolved to null above.
          if (!isMeQuery(query.queryKey) && isUnauthorized(error)) {
            void endSession(client);
          }
        },
      }),

      mutationCache: new MutationCache({
        // v5.102.8 signature: (error, variables, onMutateResult, mutation, context).
        onError: (error, _variables, onMutateResult, mutation) => {
          // Sign-in and sign-out own their own 401s.
          if (mutation.options.mutationKey?.[0] === authKeys.all[0]) return;
          // A mutation from a previous session must not sign out the new user.
          if (!isStampCurrent(onMutateResult)) return;
          if (isUnauthorized(error)) void endSession(client);
        },
      }),
    });

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
