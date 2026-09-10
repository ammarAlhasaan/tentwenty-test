import { cn } from "cn";

/** The design's mark: a rounded indigo tile and the two-line wordmark. */
export function Brand({
  tone = "default",
  className,
}: {
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className={cn(
          "grid size-9 place-items-center rounded-[11px] font-heading text-[15px] font-bold tracking-display",
          tone === "inverse"
            ? "bg-card text-brand"
            : "bg-brand text-brand-foreground",
        )}
      >
        M
      </span>
      <span className="leading-tight">
        <span className="block font-heading text-[15.5px] font-bold">
          Margin
        </span>
        <span
          className={cn(
            "block text-[10.5px] tracking-[0.13em] uppercase",
            tone === "inverse" ? "text-brand-foreground/70" : "text-ink-3",
          )}
        >
          Dashboard
        </span>
      </span>
    </span>
  );
}
