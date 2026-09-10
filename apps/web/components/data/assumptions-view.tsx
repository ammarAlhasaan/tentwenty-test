"use client";

import { useState } from "react";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { QueryError, TableSkeleton } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isApiError } from "@/lib/api";
import { useMe } from "@/lib/auth";
import {
  useSaveSettings,
  useSettings,
  type SettingsResponse,
} from "@/lib/settings";
import { formatNumber } from "@/lib/format";

export function AssumptionsView() {
  const { data: user } = useMe();
  const settings = useSettings(Boolean(user));
  // The mutation lives here rather than in the form, because the form is
  // remounted whenever the saved values change and would otherwise lose the
  // result of the save that changed them.
  const save = useSaveSettings();

  return (
    <>
      <PageHeader
        title="Assumptions"
        description="What counts as billable, and what the agency spends beyond salaries. Both change every figure."
      />

      {settings.isPending ? (
        <TableSkeleton rows={2} />
      ) : settings.isError ? (
        <QueryError
          what="the assumptions"
          onRetry={() => void settings.refetch()}
        />
      ) : (
        <AssumptionsForm
          // Remounting on a change re-seeds the draft from the saved values,
          // which is React's own answer to "reset state when a prop changes"
          // and keeps setState out of an effect.
          key={savedIdentity(settings.data)}
          settings={settings.data}
          save={save}
        />
      )}
    </>
  );
}

function savedIdentity(settings: SettingsResponse): string {
  return `${settings.monthlyOverhead}|${settings.billableCategories.join(",")}`;
}

function AssumptionsForm({
  settings,
  save,
}: {
  settings: SettingsResponse;
  save: ReturnType<typeof useSaveSettings>;
}) {
  const [overhead, setOverhead] = useState(String(settings.monthlyOverhead));
  const [billable, setBillable] = useState<string[]>(
    settings.billableCategories,
  );

  const parsedOverhead = Number(overhead);
  const overheadError =
    overhead.trim() === "" ||
    !Number.isFinite(parsedOverhead) ||
    parsedOverhead < 0
      ? `Enter an amount of ${settings.currency} 0 or more.`
      : null;
  const billableError =
    billable.length === 0
      ? "At least one category must count as billable."
      : null;

  const dirty =
    parsedOverhead !== settings.monthlyOverhead ||
    billable.join(" ") !== settings.billableCategories.join(" ");

  function toggle(category: string) {
    setBillable((current) =>
      current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (overheadError || billableError || save.isPending) return;
        save.mutate({
          billableCategories: billable,
          monthlyOverhead: parsedOverhead,
        });
      }}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] items-start gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Monthly overhead</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-ink-2 text-pretty">
              Costs that are not salaries. The API adds them to the indirect pool
              and spreads that pool across billable hours.
            </p>
            <label htmlFor="overhead" className="mt-2 text-[13px] font-semibold">
              Amount ({settings.currency} per month)
            </label>
            <input
              id="overhead"
              type="number"
              inputMode="decimal"
              min={0}
              // Any non-negative amount the API accepts must be enterable: a
              // fixed step makes the browser reject 1,250 or 1,234.50 before
              // the form is ever submitted.
              step="any"
              value={overhead}
              aria-invalid={overheadError ? true : undefined}
              aria-describedby="overhead-hint"
              onChange={(event) => setOverhead(event.target.value)}
              className="h-12 w-full rounded-[13px] border border-input bg-card px-3.5 font-mono text-[14.5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-negative"
            />
            <p
              id="overhead-hint"
              className={
                overheadError
                  ? "text-[13px] font-medium text-negative"
                  : "text-[12.5px] text-ink-3"
              }
            >
              {overheadError ??
                "Any amount from zero upwards, whole dirhams or not. Zero is what the assessment's own self-check uses."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What counts as billable</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-ink-2 text-pretty">
              Ticked categories are charged to a project. The rest is internal
              time the agency absorbs. The hours beside each one are what the
              loaded timesheet holds.
            </p>
            <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2">
              <legend className="sr-only">Billable categories</legend>
              {settings.knownCategories.map((category) => (
                <label
                  key={category.category}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-[13.5px] font-medium hover:border-brand hover:bg-brand-tint"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand)]"
                    checked={billable.includes(category.category)}
                    onChange={() => toggle(category.category)}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {category.category}
                  </span>
                  <span className="font-mono text-[11.5px] tabular-nums text-ink-3">
                    {formatNumber(category.hours)}
                  </span>
                </label>
              ))}
            </fieldset>
            {billableError ? (
              <p className="text-[13px] font-medium text-negative">
                {billableError}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {save.isError ? (
        <Notice tone="danger" title="Couldn't save the assumptions">
          {isApiError(save.error)
            ? save.error.messages.join(" ")
            : "Something went wrong. Nothing was changed."}
        </Notice>
      ) : save.isSuccess && !dirty ? (
        <Notice tone="success" title="Assumptions saved">
          Every reporting screen has been recalculated.
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={
            save.isPending || !dirty || Boolean(overheadError || billableError)
          }
        >
          {save.isPending ? "Saving…" : "Save assumptions"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setOverhead(String(settings.monthlyOverhead));
            setBillable(settings.billableCategories);
          }}
        >
          Discard changes
        </Button>
      </div>
    </form>
  );
}
