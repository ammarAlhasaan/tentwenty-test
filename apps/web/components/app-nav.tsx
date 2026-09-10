// Client boundary: the current-section highlight needs usePathname(). The links
// themselves render on the server, so navigation works before hydration.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderKanban, Gauge, Tags } from "lucide-react";
import { cn } from "cn";

const sections = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/productivity", label: "Productivity", icon: Gauge },
  { href: "/categories", label: "Categories", icon: Tags },
] as const;

function isCurrent(pathname: string, href: string) {
  // Exact match for the dashboard, or "/" would be current everywhere.
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNav({ layout }: { layout: "rail" | "bar" }) {
  const pathname = usePathname();

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
