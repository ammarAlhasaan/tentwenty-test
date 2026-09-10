import { Card, CardContent } from "@/components/ui/card";
import { MissingValue } from "@/components/missing-value";
import { ShareBar } from "@/components/pill";
import { ABSENT } from "@/lib/format";
import { cn } from "cn";

export function StatCard({
  label,
  value,
  hint,
  share,
  tone = "neutral",
}: {
  label: string;
  /** Already formatted. An em dash means the source had no value. */
  value: string;
  hint?: React.ReactNode;
  /** 0–1. Draws the design's progress bar under the value. */
  share?: number | null;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5">
        <p className="text-[12.5px] font-semibold text-ink-3">{label}</p>

        {value === ABSENT ? (
          <MissingValue className="text-3xl font-bold" />
        ) : (
          <p
            className={cn(
              "font-mono text-3xl leading-tight font-bold tracking-display tabular-nums",
              tone === "positive" && "text-positive",
              tone === "negative" && "text-negative",
            )}
          >
            {value}
          </p>
        )}

        {share == null ? null : <ShareBar value={share} />}

        {hint ? (
          <p className="text-[12.5px] text-ink-2 text-pretty">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
