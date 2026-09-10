"use client";

/**
 * The assumptions feature: which categories count as billable, and the monthly
 * overhead. Both change every figure the API reports, so saving them
 * invalidates the reporting cache.
 *
 * Types are duplicated from `apps/api`'s contract per the HTTP-only boundary.
 */

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "./api";
import { analyticsKeys } from "./analytics";
import { isStampCurrent, stampSession } from "./session";

export const settingsKeys = {
  all: ["settings"] as const,
  current: () => ["settings", "current"] as const,
};

export type SettingsResponse = {
  billableCategories: string[];
  monthlyOverhead: number;
  currency: string;
  knownCategories: { category: string; billable: boolean; hours: number }[];
};

type SettingsInput = {
  billableCategories: string[];
  monthlyOverhead: number;
};

function fetchSettings(signal?: AbortSignal): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>("/settings", { signal });
}

export function useSettings(enabled: boolean) {
  return useQuery(
    queryOptions({
      queryKey: settingsKeys.current(),
      queryFn: ({ signal }) => fetchSettings(signal),
      enabled,
    }),
  );
}

export function useSaveSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...settingsKeys.all, "save"],
    // A private mutation stamps the session it started under, so a response
    // arriving after a sign-out cannot write into the next user's cache
    // (apps/web/README.md, 5.2).
    onMutate: () => stampSession(),
    mutationFn: (input: SettingsInput) =>
      apiFetch<SettingsResponse>("/settings", { method: "PUT", body: input }),
    onSuccess: (data, _input, stamp) => {
      if (!isStampCurrent(stamp)) return;
      queryClient.setQueryData(settingsKeys.current(), data);
      // Every reported figure is derived from these two values.
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
    },
  });
}
