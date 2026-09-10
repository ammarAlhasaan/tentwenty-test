import { MissingValue } from "@/components/missing-value";
import { ABSENT, formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "cn";

/**
 * The design's one-glance answer. Three tones, because "we don't know" is a real
 * answer here: when a month's salaries or prices are incomplete the API withholds
 * profit and margin rather than presenting a subtotal as a result.
 */
export function VerdictBanner({
  periodLabel,
  profit,
  margin,
  revenue,
  cost,
}: {
  periodLabel: string;
  profit: number | null;
  margin: number | null;
  revenue: number | null;
  cost: number | null;
}) {
  const tone = profit == null ? "unknown" : profit >= 0 ? "profit" : "loss";

  const answer =
    tone === "unknown"
      ? "We can't tell yet — the figures behind this month are incomplete."
      : tone === "profit"
        ? "Yes — the agency made money this month."
        : "No — the agency lost money this month.";

  const because =
    tone === "unknown"
      ? "Cost or revenue is missing an input, so profit and margin are withheld rather than reported as a subtotal."
      : `${formatCurrency(revenue)} of work earned against ${formatCurrency(cost)} of fully-loaded cost — salaries, unbillable time and overhead included.`;

  return (
    <div
      className={cn(
        "grid items-center gap-8 rounded-2xl px-6 py-8 text-brand-foreground sm:px-9 sm:py-9 lg:grid-cols-[minmax(0,1.1fr)_auto]",
        tone === "profit" && "bg-brand shadow-lift",
        tone === "loss" && "bg-[var(--negative-strong)] shadow-lift",
        tone === "unknown" && "bg-foreground text-background shadow-lift",
      )}
    >
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-current/75 uppercase">
          {periodLabel}
        </p>
        <p className="mt-2.5 mb-2 font-heading text-[clamp(1.75rem,3.2vw,2.625rem)] leading-[1.1] font-bold tracking-display text-pretty">
          {answer}
        </p>
        <p className="max-w-[56ch] text-[15px] text-current/85 text-pretty">
          {because}
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-9 gap-y-5">
        <Figure label="Profit" value={formatCurrency(profit)} note="revenue minus cost" />
        <Figure
          label="Margin"
          value={formatPercent(margin)}
          note="profit as a share of revenue"
        />
      </dl>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div>
      <dt className="text-[11.5px] font-semibold tracking-[0.12em] text-current/70 uppercase">
        {label}
      </dt>
      <dd className="font-mono text-[34px] leading-tight font-bold tracking-display tabular-nums">
        {value === ABSENT ? <MissingValue className="text-current/80" /> : value}
      </dd>
      <dd className="text-[12.5px] text-current/70">{note}</dd>
    </div>
  );
}
