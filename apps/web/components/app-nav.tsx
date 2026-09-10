// Client boundary: the current-section highlight needs usePathname(). The links
// themselves render on the server, so navigation works before hydration.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CloudUpload,
  FolderKanban,
  Gauge,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import { cn } from "cn";

/**
 * The two groups the design uses: what the agency reads, and what feeds it.
 * Every entry here is a route that exists and shows something.
 */
const groups = [
  {
    label: "Reporting",
    sections: [
      { href: "/", label: "Dashboard", icon: BarChart3 },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/departments", label: "Departments", icon: Building2 },
      { href: "/productivity", label: "Productivity", icon: Gauge },
      { href: "/categories", label: "Categories", icon: Tags },
    ],
  },
  {
    label: "Data",
    sections: [
      { href: "/uploads", label: "Uploads", icon: CloudUpload },
      { href: "/assumptions", label: "Assumptions", icon: SlidersHorizontal },
    ],
  },
] as const;

function isCurrent(pathname: string, href: string) {
  // Exact match for the dashboard, or "/" would be current everywhere.
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNav({ layout }: { layout: "rail" | "bar" }) {
  const pathname = usePathname();

  // The rail has room for the group headings the design shows; the bar does not,
  // so it flattens to one scrollable row.
  if (layout === "rail") {
    return (
      <div className="flex flex-col gap-1">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pt-3 pb-1.5 text-[10.5px] tracking-[0.14em] text-ink-3 uppercase">
              {group.label}
            </p>
            <NavList
              sections={group.sections}
              pathname={pathname}
              layout="rail"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <NavList
      sections={groups.flatMap((group) => [...group.sections])}
      pathname={pathname}
      layout="bar"
    />
  );
}

type Section = { href: string; label: string; icon: typeof BarChart3 };

function NavList({
  sections,
  pathname,
  layout,
}: {
  sections: readonly Section[];
  pathname: string;
  layout: "rail" | "bar";
}) {
  return (
    <ul
      className={cn(
        "flex gap-1",
        layout === "rail" ? "flex-col" : "flex-row overflow-x-auto",
      )}
    >
      {sections.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(pathname, href);

        return (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
                "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                // Current state is carried by weight as well as colour, so it
                // survives a monochrome or high-contrast view.
                current
                  ? "bg-brand-soft font-bold text-brand-strong"
                  : "font-medium text-ink-2 hover:bg-brand-tint hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
