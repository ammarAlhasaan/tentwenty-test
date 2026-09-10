export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <h1 className="font-heading text-[23px] leading-tight font-bold tracking-tight">
          {title}
        </h1>
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
