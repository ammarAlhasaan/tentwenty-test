import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { cn } from "cn";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <CardDescription className="text-xs font-medium tracking-wide uppercase">
          {label}
        </CardDescription>
        <p
          className={cn(
            // No responsive step-up: the page container is capped at
            // max-w-7xl, so these cards are no wider at 2xl than at xl and a
            // larger size would clip the longest currency figure.
            "font-heading text-xl font-semibold tabular-nums",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative"
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
