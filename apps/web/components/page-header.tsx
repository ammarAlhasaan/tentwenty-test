export function PageHeader({
  title,
  badge,
  description,
  actions,
}: {
  title: string;
  /**
   * The period these figures describe, as the design's chip. A label, not a
   * control — the filter beside it is the control. A string, because the period
   * label is the only thing it will ever carry.
   */
  badge?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="font-heading text-[23px] leading-tight font-bold tracking-tight">
            {title}
          </h1>
          {badge ? (
            <span className="rounded-full bg-brand-soft px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap text-brand-strong">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-ink-2 text-pretty">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
