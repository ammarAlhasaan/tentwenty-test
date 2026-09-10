import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AuthGate } from "@/components/auth-gate";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";

// The shell FE-01 established, wearing the approved design.
//
// The chrome renders unconditionally: brand, navigation and header are public
// and data-free, so they paint immediately. AuthGate wraps <main> alone, which
// is where anything private appears.
//
// The gate is a user-experience boundary. SessionAuthGuard in apps/api is the
// authorization boundary; nothing rendered here is private data.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-lg bg-card px-4 py-2 text-sm font-semibold shadow-lift focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <div className="flex flex-1 lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-7 border-r border-border bg-card px-4 py-6 lg:flex">
          <Link
            href="/"
            className="rounded-lg px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Brand />
          </Link>
          <nav aria-label="Sections" className="overflow-y-auto">
            <AppNav layout="rail" />
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <Link
                href="/"
                className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
              >
                <Brand />
              </Link>
              <div className="ml-auto">
                <UserMenu />
              </div>
            </div>
            <nav
              aria-label="Sections"
              className="px-4 pb-2 sm:px-6 lg:hidden"
            >
              <AppNav layout="bar" />
            </nav>
          </header>

          <main
            id="main"
            className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            <AuthGate>{children}</AuthGate>
          </main>
        </div>
      </div>
    </>
  );
}
