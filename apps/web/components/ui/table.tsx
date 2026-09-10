import { cn } from "cn";

/**
 * A table in the design's panel: the card surface with no vertical padding of
 * its own, because the header and the table bring theirs. Every table screen was
 * writing `<Card className="py-0">` and then cancelling the header padding too,
 * which meant the card's spacing token had no effect anywhere it was used.
 */
function TablePanel({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-sm text-card-foreground shadow-card">
      {title ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-5 pb-3.5">
          <h2 className="font-heading text-base leading-snug font-bold">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-[12.5px] text-ink-3">{subtitle}</p>
          ) : null}
          {actions ? <div className="ms-auto">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * The design's table. Every figure column is right-aligned and mono; the first
 * column is the row's name and stays left. `minWidth` keeps columns readable on
 * a phone and lets the wrapper scroll rather than the page.
 */
function TableScroller({
  minWidth = 560,
  className,
  children,
}: {
  minWidth?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
}

function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

function TableFooter({ children }: { children: React.ReactNode }) {
  return <tfoot>{children}</tfoot>;
}

function TableRow({
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "[&>td]:border-b [&>td]:border-line-2 last:[&>td]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({
  align = "end",
  className,
  ...props
}: Omit<React.ComponentProps<"th">, "align"> & { align?: "start" | "end" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-y border-border bg-brand-tint px-5 py-3 text-[11.5px] font-semibold whitespace-nowrap text-ink-3",
        align === "start" ? "text-left" : "text-right",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  align = "end",
  numeric = false,
  className,
  ...props
}: Omit<React.ComponentProps<"td">, "align"> & {
  align?: "start" | "end";
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-5 py-4 align-middle whitespace-nowrap",
        align === "start" ? "text-left" : "text-right",
        numeric && "font-mono tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

function TableFooterCell({
  align = "end",
  numeric = false,
  className,
  ...props
}: Omit<React.ComponentProps<"td">, "align"> & {
  align?: "start" | "end";
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-t border-border bg-brand-tint px-5 py-3.5 font-bold whitespace-nowrap",
        align === "start" ? "text-left" : "text-right",
        numeric && "font-mono tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/** The two-line name cell the design uses: a bold name over a mono reference. */
function TableName({
  name,
  detail,
  children,
}: {
  name: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 whitespace-normal">
      <span className="font-semibold text-foreground">{name}</span>
      {detail ? (
        <span className="font-mono text-[11.5px] text-ink-3">{detail}</span>
      ) : null}
      {children}
    </div>
  );
}

export {
  TablePanel,
  TableScroller,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableFooterCell,
  TableName,
};
