"use client";

import { CloudUpload } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { QueryError, TableSkeleton } from "@/components/query-states";
import { ImportSummary, UploadCard } from "@/components/data/upload-card";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableName,
  TablePanel,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { usePeriods } from "@/lib/analytics";
import { useMe } from "@/lib/auth";
import { isApiError } from "@/lib/api";
import { useImportHistory, useLoadSampleData } from "@/lib/imports";
import { formatDateTime, formatNumber } from "@/lib/format";

/**
 * The three imports do not behave alike, and the confirmation has to say which
 * one is about to run. Checked against `apps/api`'s ImportsService: the
 * timesheet and salary imports delete every row for the months the file covers
 * before inserting, while the project import upserts by ref code and leaves
 * anything it does not mention alone.
 */
const WORKBOOKS = [
  {
    kind: "timesheet" as const,
    title: "Timesheet",
    grain: "One row per person, per task, per month.",
    columns:
      "Month · Employee No. · Employee Name · Type of Expense (DL/IDL) · Department · Designation · Category · Ref Code · Project / Task Name · Company · Description · Hours",
    effect:
      "Importing replaces every hour already recorded for the months this file covers. Other months, and your assumptions, are untouched.",
    confirmLabel: "Upload and replace",
  },
  {
    kind: "salaries" as const,
    title: "Salary overview",
    grain: "One row per person, one column per month.",
    columns: "Employee Name, then January … December",
    effect:
      "Importing replaces every salary already recorded for the months this file has columns for — a blank column clears that month rather than leaving the old figure. Other months are untouched.",
    confirmLabel: "Upload and replace",
    needsYear: true,
  },
  {
    kind: "projects" as const,
    title: "Project prices",
    grain: "One row per project.",
    columns:
      "Ref Code · Project Name · Project Price · Sales month · Category · Status",
    // Not a replacement: the API upserts by ref code, and a catalogue that omits
    // a project is far likelier to be partial than to mean "delete it".
    effect:
      "Importing adds the projects in this file and updates the ones already on record, matching on Ref Code. Projects the file does not mention are left exactly as they are, and no month of hours is touched.",
    confirmLabel: "Upload and update",
  },
];

export function UploadsView() {
  const { data: user } = useMe();
  const signedIn = Boolean(user);

  const periods = usePeriods(signedIn);
  const history = useImportHistory(signedIn);
  const sample = useLoadSampleData();

  return (
    <>
      <PageHeader
        title="Uploads"
        description="Load the three spreadsheets every figure is built from. Each one says what it will change before it runs."
        actions={
          <Button
            onClick={() => sample.mutate()}
            disabled={sample.isPending}
          >
            {sample.isPending ? "Loading…" : "Load the sample workbooks"}
          </Button>
        }
      />

      {sample.isError ? (
        <Notice tone="danger" title="Couldn't load the sample workbooks">
          {isApiError(sample.error)
            ? sample.error.messages.join(" ")
            : "Something went wrong. Nothing was changed."}
        </Notice>
      ) : sample.isSuccess ? (
        <Notice tone="success" title="Sample workbooks loaded">
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {sample.data.results.map((result) => (
              <li key={result.importId}>
                <ImportSummary result={result} />
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {/* The standing gaps the API reports for the loaded data as a whole. They
          belong here, beside the files that produced them, rather than on a
          reporting screen where they would describe a different period than the
          one on screen. */}
      {periods.data && periods.data.warnings.length > 0 ? (
        <Notice
          tone="warning"
          title={`${periods.data.warnings.length} standing ${periods.data.warnings.length === 1 ? "gap" : "gaps"} in the loaded data`}
        >
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {periods.data.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(19rem,1fr))] gap-5 items-start">
        {WORKBOOKS.map((workbook) => (
          <UploadCard
            key={workbook.kind}
            {...workbook}
            // A network failure leaves the outcome unknown, so the card offers a
            // way to look rather than a claim about what happened.
            onRefreshHistory={() => void history.refetch()}
          />
        ))}
      </div>

      <TablePanel title="Import history">

        {history.isPending ? (
          <div className="p-5">
            <TableSkeleton rows={3} />
          </div>
        ) : history.isError ? (
          <div className="p-5">
            <QueryError
              what="the import history"
              onRetry={() => void history.refetch()}
            />
          </div>
        ) : history.data.imports.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={CloudUpload}
              title="Nothing imported yet"
              description="Upload a spreadsheet above, or load the sample workbooks, and every import is recorded here with what it replaced."
            />
          </div>
        ) : (
          <TableScroller minWidth={720}>
            <TableHeader>
              <TableRow>
                <TableHead align="start">File</TableHead>
                <TableHead align="start">Uploaded</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead align="start">Periods replaced</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.data.imports.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell align="start" className="whitespace-normal">
                    <TableName name={entry.filename} detail={entry.kind} />
                  </TableCell>
                  <TableCell align="start" className="text-ink-2">
                    <time dateTime={entry.uploadedAt}>
                      {formatDateTime(entry.uploadedAt)}
                    </time>
                    {entry.uploadedBy ? (
                      <span className="block text-[11.5px] text-ink-3">
                        {entry.uploadedBy}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell numeric>
                    {formatNumber(entry.rowsAccepted)}
                  </TableCell>
                  <TableCell align="start" className="whitespace-normal text-ink-2">
                    {entry.periodsReplaced.length === 0
                      ? "—"
                      : entry.periodsReplaced
                          .map((period) => period.label)
                          .join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableScroller>
        )}
      </TablePanel>

      <p className="max-w-[90ch] text-[13px] text-ink-3 text-pretty">
        A timesheet or salary import replaces only the months its file covers;
        every other month, and your assumptions, are untouched. A price import
        adds and updates projects by Ref Code and removes nothing. If an import
        is rejected, nothing is changed at all.
      </p>
    </>
  );
}
