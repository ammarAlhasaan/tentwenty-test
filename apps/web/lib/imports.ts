"use client";

/**
 * The spreadsheet ingestion feature. Uploads go through `apiFetch` as
 * `FormData`, which it passes through untouched so the browser keeps the
 * multipart boundary it generated (apps/web/README.md, 1.5).
 */

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "./api";
import { analyticsKeys } from "./analytics";
import { settingsKeys } from "./settings";
import { isStampCurrent, stampSession } from "./session";

const importKeys = {
  all: ["imports"] as const,
  history: () => ["imports", "history"] as const,
};

export type ImportKind = "timesheet" | "salaries" | "projects";

export type ImportResult = {
  importId: number;
  kind: ImportKind;
  filename: string;
  rowsAccepted: number;
  rowsSkipped: number;
  periodsReplaced: { year: number; month: number; label: string }[];
  warnings: { code: string; message: string }[];
};

type ImportHistoryResponse = {
  imports: {
    id: number;
    kind: ImportKind;
    filename: string;
    uploadedAt: string;
    uploadedBy: string | null;
    rowsAccepted: number;
    periodsReplaced: { year: number; month: number; label: string }[];
  }[];
};

export function useImportHistory(enabled: boolean) {
  return useQuery(
    queryOptions({
      queryKey: importKeys.history(),
      queryFn: ({ signal }) =>
        apiFetch<ImportHistoryResponse>("/imports", { signal }),
      enabled,
    }),
  );
}

/**
 * Everything an import can change lives behind these keys, so one helper keeps
 * the two mutations below from drifting apart.
 */
function refreshAfterImport(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  void queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
  void queryClient.invalidateQueries({ queryKey: importKeys.all });
  // knownCategories on /settings is derived from the loaded timesheet.
  void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
}

export function useUploadWorkbook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...importKeys.all, "upload"],
    onMutate: () => stampSession(),
    mutationFn: ({ kind, file, year }: { kind: ImportKind; file: File; year?: number }) => {
      const body = new FormData();
      body.append("file", file);
      // Only a salary workbook that names bare months needs a year.
      if (kind === "salaries" && year !== undefined) {
        body.append("year", String(year));
      }
      return apiFetch<ImportResult>(`/imports/${kind}`, {
        method: "POST",
        body,
      });
    },
    onSuccess: (_result, _input, stamp) => {
      if (!isStampCurrent(stamp)) return;
      refreshAfterImport(queryClient);
    },
  });
}

/**
 * Loads the workbooks the API keeps under `apps/api/sample-data` through the
 * same parsing, validation and audit path an upload takes. The bytes are the
 * only difference, so this is a real import, not a simulated one.
 */
export function useLoadSampleData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...importKeys.all, "sample"],
    onMutate: () => stampSession(),
    mutationFn: () =>
      apiFetch<{ results: ImportResult[] }>("/imports/sample", {
        method: "POST",
      }),
    onSuccess: (_result, _input, stamp) => {
      if (!isStampCurrent(stamp)) return;
      refreshAfterImport(queryClient);
    },
  });
}
