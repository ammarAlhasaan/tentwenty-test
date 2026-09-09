import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AuthGate } from "@/components/auth-gate";
import { UserMenu } from "@/components/user-menu";

// The shell FE-01 established, now behind the session check. AuthGate returns a
// fragment, so the body's flex column still lays these out.
//
// The gate is a user-experience boundary. SessionAuthGuard in apps/api is the
// authorization boundary; nothing rendered below is private data.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="font-heading text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Margin Dashboard
          </Link>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
        <nav
          aria-label="Sections"
          className="mx-auto max-w-7xl px-4 pb-2 sm:px-6 md:hidden"
        >
          <AppNav layout="bar" />
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-6 sm:px-6">
        <nav aria-label="Sections" className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-24">
            <AppNav layout="rail" />
          </div>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AuthGate>
  );
}
