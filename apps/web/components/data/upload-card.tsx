"use client";

import { useRef, useState } from "react";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isApiError } from "@/lib/api";
import {
  useUploadWorkbook,
  type ImportKind,
  type ImportResult,
} from "@/lib/imports";
import { formatNumber } from "@/lib/format";
import { cn } from "cn";

const ACCEPT = ".xlsx,.xls";

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A failed request splits into two very different facts.
 *
 * An HTTP failure is the API's own answer: it read the request, rejected it, and
 * the import contract says nothing is replaced when one fails. Saying so is
 * safe.
 *
 * A network failure is not an answer at all. The request may have been received
 * and completed with only the response lost, so promising that nothing changed
 * would be a guarantee this side cannot make.
 */
function describeFailure(error: unknown): {
  title: string;
  detail: string;
  uncertain: boolean;
} {
  if (isApiError(error) && error.kind === "network") {
    return {
      title: "Couldn't confirm the result of this import",
      detail:
        "The service could not be reached before it answered. The import may have been applied, or it may never have arrived. Refresh the history to see which, rather than importing again blind.",
      uncertain: true,
    };
  }

  if (!isApiError(error)) {
    return {
      title: "Import failed — nothing was changed",
      detail: "Something went wrong. Please try again.",
      uncertain: false,
    };
  }

  if (error.status === 413) {
    return {
      title: "Import failed — nothing was changed",
      detail: "That file is larger than the service accepts.",
      uncertain: false,
    };
  }

  return {
    title: "Import failed — nothing was changed",
    // 400 and 422 carry the row-level detail the API produced; replacing it
    // would throw away the only thing that says which row to fix.
    detail: error.messages.join(" ") || "The service rejected that file.",
    uncertain: false,
  };
}

export function UploadCard({
  kind,
  title,
  grain,
  columns,
  needsYear = false,
  onRefreshHistory,
}: {
  kind: ImportKind;
  title: string;
  grain: string;
  columns: string;
  needsYear?: boolean;
  onRefreshHistory: () => void;
}) {
  const upload = useUploadWorkbook();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [year, setYear] = useState("");

  // Choosing a file stages it. Nothing is sent until the replace is confirmed:
  // an import overwrites every month the file covers, which is not something to
  // start by mistake from a mis-click in a file picker.
  const [staged, setStaged] = useState<File | null>(null);

  const mine = upload.variables?.kind === kind;
  const result = mine && upload.isSuccess ? upload.data : null;
  const busy = mine && upload.isPending;
  const failure = mine && upload.isError ? describeFailure(upload.error) : null;

  const parsedYear = Number(year);
  const yearError =
    needsYear && year !== "" && !(Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 9999)
      ? "Enter a four-digit year, or leave this empty."
      : null;

  function confirm() {
    if (!staged || busy || yearError) return;
    upload.mutate({
      kind,
      file: staged,
      year: needsYear && year !== "" ? parsedYear : undefined,
    });
    setStaged(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        {staged ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-brand-line bg-brand-tint px-4 py-4">
            <div>
              <p className="font-mono text-[13px] font-semibold break-all">
                {staged.name}
              </p>
              <p className="text-[12.5px] text-ink-3">{fileSize(staged.size)}</p>
            </div>

            {needsYear ? (
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Year (only if the sheet names bare months)
                <input
                  type="number"
                  inputMode="numeric"
                  value={year}
                  min={1900}
                  max={9999}
                  placeholder="2025"
                  aria-invalid={yearError ? true : undefined}
                  onChange={(event) => setYear(event.target.value)}
                  className="h-10 w-32 rounded-[11px] border border-input bg-card px-3 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-negative"
                />
                {yearError ? (
                  <span className="font-normal text-negative">{yearError}</span>
                ) : null}
              </label>
            ) : null}

            {/* Which months this replaces is only known once the API has read
                the file, so it is reported afterwards rather than guessed at
                here. */}
            <p className="text-[12.5px] text-ink-2 text-pretty">
              Importing replaces every month this file covers. Other months, and
              your assumptions, are untouched.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={busy || Boolean(yearError)} onClick={confirm}>
                {busy ? "Importing…" : "Upload and replace"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setStaged(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) setStaged(file);
            }}
            className={cn(
              "flex flex-col items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed px-5 py-7 text-center",
              dragging
                ? "border-brand bg-brand-soft"
                : "border-brand-line bg-brand-tint",
            )}
          >
            <p className="text-sm font-bold">Drop the file here</p>
            <p className="text-[12.5px] text-ink-3">.xlsx or .xls</p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Importing…" : "Choose file"}
            </Button>
            {/* The visible control is the button above; this stays in the tree so
                the browser's own file picker does the work. */}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label={`${title} spreadsheet`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setStaged(file);
                // Let the same file be chosen again after a cancel or a failure.
                event.target.value = "";
              }}
            />
          </div>
        )}

        <p className="text-[13px] text-ink-2">{grain}</p>
        <p className="font-mono text-[11.5px] leading-relaxed text-ink-3">
          {columns}
        </p>

        {failure ? (
          <Notice
            tone={failure.uncertain ? "warning" : "danger"}
            title={failure.title}
            action={
              failure.uncertain ? (
                <Button size="sm" variant="outline" onClick={onRefreshHistory}>
                  Refresh the history
                </Button>
              ) : undefined
            }
          >
            {failure.detail}
          </Notice>
        ) : result ? (
          <Notice
            tone="success"
            title={`${formatNumber(result.rowsAccepted)} rows accepted`}
          >
            <ImportSummary result={result} />
          </Notice>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <>
      <p>
        {result.filename}
        {result.rowsSkipped > 0
          ? ` · ${formatNumber(result.rowsSkipped)} rows skipped`
          : ""}
        {result.periodsReplaced.length > 0
          ? ` · replaced ${result.periodsReplaced.map((period) => period.label).join(", ")}`
          : ""}
      </p>
      {result.warnings.length > 0 ? (
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
          {result.warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
