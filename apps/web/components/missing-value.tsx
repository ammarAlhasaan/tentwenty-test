import { ABSENT } from "@/lib/format";
import { cn } from "cn";

/**
 * A value the source data does not contain — not a zero. The em dash alone is
 * ambiguous to a screen reader, so the meaning is spelled out for it while the
 * sighted reader keeps the design's compact dash.
 */
export function MissingValue({ className }: { className?: string }) {
  return (
    <span
      className={cn("font-mono text-ink-3", className)}
      title="No value in the source data — this is not zero"
    >
      <span aria-hidden>{ABSENT}</span>
      <span className="sr-only">Missing from the source data</span>
    </span>
  );
}

export function isAbsent(value: string): boolean {
  return value === ABSENT;
}
