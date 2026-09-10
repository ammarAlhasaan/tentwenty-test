import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="mb-1 grid size-14 place-items-center rounded-[18px] bg-brand-soft text-brand-strong">
          <Icon className="size-6" aria-hidden />
        </span>
        <h2 className="font-heading text-xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="max-w-[46ch] text-sm text-ink-2 text-pretty">
          {description}
        </p>
        {action ? <div className="mt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
