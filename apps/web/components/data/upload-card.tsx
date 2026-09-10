"use client";

import { useRef, useState } from "react";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isApiError } from "@/lib/api";
import { useUploadWorkbook, type ImportKind, type ImportResult } from "@/lib/imports";
import { formatNumber } from "@/lib/format";
import { cn } from "cn";

const ACCEPT = ".xlsx,.xls";

function messageFor(error: unknown): string {
  if (!isApiError(error)) return "Something went wrong. Please try again.";
  if (error.kind === "network") {
    return "Could not reach the service. Nothing was changed.";
  }
  // 400 and 422 carry the row-level detail the API produced; showing anything
  // else would throw away the only thing that says which row to fix.
  if (error.status === 413) {
    return "That file is larger than the service accepts. Nothing was changed.";
  }
  return error.messages.join(" ") || "The import failed. Nothing was changed.";
}

export function UploadCard({
  kind,
  title,
  grain,
  columns,
  needsYear = false,
}: {
  kind: ImportKind;
  title: string;
  grain: string;
  columns: string;
  needsYear?: boolean;
}) {
  const upload = useUploadWorkbook();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [year, setYear] = useState("");

  const result = upload.data?.kind === kind ? upload.data : null;
  const busy = upload.isPending && upload.variables?.kind === kind;
  const failed = upload.isError && upload.variables?.kind === kind;

  function send(file: File) {
    const parsed = Number(year);
    upload.mutate({
      kind,
      file,
      year: needsYear && year !== "" && Number.isInteger(parsed) ? parsed : undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
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
            if (file) send(file);
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
              if (file) send(file);
              // Let the same file be chosen again after a failed import.
              event.target.value = "";
            }}
          />
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
              onChange={(event) => setYear(event.target.value)}
              className="h-10 w-32 rounded-[11px] border border-input bg-card px-3 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
        ) : null}

        <p className="text-[13px] text-ink-2">{grain}</p>
        <p className="font-mono text-[11.5px] leading-relaxed text-ink-3">
          {columns}
        </p>

        {failed ? (
          <Notice tone="danger" title="Import failed — nothing was changed">
            {messageFor(upload.error)}
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
