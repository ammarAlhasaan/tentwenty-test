import { MissingValue } from "@/components/missing-value";
import { ABSENT, formatPercent, formatShare } from "@/lib/format";
import { cn } from "cn";

/**
 * The design's measure pill: a percentage on a tinted background whose colour
 * carries the sign. `unknown` is its own state, not a zero.
 */
export function PercentPill({
  value,
  kind = "signed",
  warnBelow,
}: {
  value: number | null | undefined;
  /** `signed` for a result (margin), `share` for a portion (productivity). */
  kind?: "signed" | "share";
  /** A share below this reads as a warning rather than a plain figure. */
  warnBelow?: number;
}) {
  const text = kind === "share" ? formatShare(value) : formatPercent(value);

  if (text === ABSENT) {
    return (
      <span className="inline-block rounded-[9px] bg-line-2 px-2.5 py-1.5">
        <MissingValue />
      </span>
    );
  }

  const negative = value != null && value < 0;
  const low = warnBelow != null && value != null && value < warnBelow;

  return (
    <span
      className={cn(
        "inline-block rounded-[9px] px-2.5 py-1.5 font-mono font-semibold tabular-nums",
        negative
          ? "bg-negative-soft text-negative"
          : low
            ? "bg-warning-soft text-warning"
            : "bg-positive-soft text-positive",
      )}
    >
      {text}
    </span>
  );
}

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-[7px] px-2 py-1 text-[10.5px] font-bold tracking-[0.06em] whitespace-nowrap uppercase",
        tone === "brand" && "bg-brand-soft text-brand-strong",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "neutral" && "bg-line-2 text-ink-3",
      )}
    >
      {children}
    </span>
  );
}

/** A proportion drawn as a bar. Presentation of a ratio the API computed. */
export function ShareBar({
  value,
  tone = "brand",
}: {
  value: number | null | undefined;
  tone?: "brand" | "muted";
}) {
  return (
    <div className="h-2 w-full min-w-24 overflow-hidden rounded-full bg-line-2">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "brand" ? "bg-brand" : "bg-[var(--brand-line)]",
        )}
        style={{ width: `${Math.max(0, Math.min(1, value ?? 0)) * 100}%` }}
      />
    </div>
  );
}
