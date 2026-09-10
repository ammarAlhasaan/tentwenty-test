import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "cn";

type Tone = "info" | "warning" | "danger" | "success";

const tones: Record<
  Tone,
  { surface: string; icon: string; glyph: LucideIcon; role: "status" | "alert" }
> = {
  info: {
    surface: "border-brand-line bg-brand-soft",
    icon: "bg-card text-brand-strong",
    glyph: Info,
    role: "status",
  },
  warning: {
    surface: "border-warning/25 bg-warning-soft",
    icon: "bg-card text-warning",
    glyph: TriangleAlert,
    role: "status",
  },
  danger: {
    surface: "border-negative/25 bg-negative-soft",
    icon: "bg-card text-negative",
    glyph: TriangleAlert,
    role: "alert",
  },
  success: {
    surface: "border-positive/25 bg-positive-soft",
    icon: "bg-card text-positive",
    glyph: CheckCircle2,
    role: "status",
  },
};

/**
 * The design's banner: a coloured strip that states a fact about the data on the
 * page. `danger` is the only tone that interrupts a screen reader, because it is
 * the only one that means something is wrong right now.
 */
export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { surface, icon, glyph: Glyph, role } = tones[tone];

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-foreground",
        surface,
      )}
    >
      <span
        className={cn(
          "mt-px grid size-7 shrink-0 place-items-center rounded-[10px]",
          icon,
        )}
      >
        <Glyph className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {children ? (
          <div className="mt-0.5 text-[13px] text-ink-2 text-pretty">
            {children}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
