"use client";

/**
 * The auth feature's endpoints and React Query definitions.
 *
 * Types are duplicated from `apps/api`'s contract rather than shared, per the
 * HTTP-only boundary.
 */

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch, isApiError } from "./api";
import {
  authKeys,
  beginSession,
  endSession,
  isStampCurrent,
  markDeliberateSignOut,
  stampSession,
  type AuthUser,
} from "./session";

type AuthResponse = { user: AuthUser };

type LoginInput = { email: string; password: string };

function login(
  input: LoginInput,
  signal?: AbortSignal,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: input,
    signal,
  });
}

function logout(signal?: AbortSignal): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST", signal });
}

async function fetchMe(signal?: AbortSignal): Promise<AuthUser | null> {
  try {
    const { user } = await apiFetch<AuthResponse>("/auth/me", { signal });
    return user;
  } catch (error) {
    // 401 here is the API's ordinary "nobody is signed in" answer, not a
    // failure. Resolving to null keeps it distinguishable from an unreachable
    // service, which must never be read as a sign-out. The cleanup an expiry
    // needs still happens, centrally, in the QueryCache success callback.
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}

function meQueryOptions() {
  return queryOptions({
    queryKey: authKeys.me(),
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 30_000,
  });
}

export function useMe() {
  return useQuery(meQueryOptions());
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...authKeys.all, "login"],
    retry: false,
    // The submitted password is part of `variables` and stays in mutation state
    // for as long as the mutation is cached. gcTime 0 drops it as soon as the
    // form stops observing it; the form also calls reset() once it succeeds.
    // Neither guarantees the string is erased from memory — JavaScript offers
    // no such guarantee — but nothing retains a reference on purpose.
    gcTime: 0,
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (data) => beginSession(queryClient, data.user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...authKeys.all, "logout"],
    retry: false,
    onMutate: () => stampSession(),
    mutationFn: () => logout(),
    onSuccess: async (_data, _variables, stamp) => {
      // A sign-out that resolves after a newer session began must not end it.
      if (!isStampCurrent(stamp)) return;
      markDeliberateSignOut();
      await endSession(queryClient);
    },
    // No onError transition: a sign-out the API did not confirm did not happen.
  });
}
