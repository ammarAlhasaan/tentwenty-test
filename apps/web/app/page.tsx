import { Info } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatHours, formatPercent } from "@/lib/format";

// Placeholder figures. They are literals here, deliberately not shaped like an
// API response, so nothing downstream can mistake them for ingested data.
const headline = {
  totalHours: 61840,
  billableHours: 44120,
  cost: 8420000,
  revenue: 10310000,
  margin: 0.1833,
};

const projects = [
  { ref: "TT-1042", name: "Meridian rebrand", price: 480000, hours: 2140, cost: 391000 },
  { ref: "TT-1078", name: "Harbour app build", price: 1250000, hours: 6380, cost: 1104000 },
  { ref: "TT-1091", name: "Nova commerce platform", price: 890000, hours: 5210, cost: 963000 },
  { ref: "TT-1103", name: "Atlas annual report", price: 210000, hours: 940, cost: 168000 },
  { ref: "TT-1117", name: "Kestrel campaign site", price: 365000, hours: 1780, cost: 302000 },
  { ref: "TT-1124", name: "Orient hosting retainer", price: 144000, hours: 610, cost: 98000 },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Hours, cost, revenue and margin across the agency.
        </p>
      </div>

      <div
        role="note"
        className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium text-foreground">
            Sample layout — these figures are placeholders.
          </span>{" "}
          No spreadsheets have been ingested yet, so nothing on this page is a
          real measurement.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total hours" value={formatHours(headline.totalHours)} />
        <StatCard
          label="Billable hours"
          value={formatHours(headline.billableHours)}
          hint={`${formatPercent(headline.billableHours / headline.totalHours)} of logged time`}
        />
        <StatCard label="Cost" value={formatCurrency(headline.cost)} />
        <StatCard label="Revenue" value={formatCurrency(headline.revenue)} />
        <StatCard
          label="Margin"
          value={formatPercent(headline.margin)}
          tone={headline.margin >= 0 ? "positive" : "negative"}
          hint={formatCurrency(headline.revenue - headline.cost)}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Projects
        </h2>
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const margin = (project.price - project.cost) / project.price;

                return (
                  <TableRow key={project.ref}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {project.ref}
                    </TableCell>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(project.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatHours(project.hours)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(project.cost)}
                    </TableCell>
                    <TableCell
                      className={
                        margin >= 0
                          ? "text-right font-medium tabular-nums text-positive"
                          : "text-right font-medium tabular-nums text-negative"
                      }
                    >
                      {formatPercent(margin)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
