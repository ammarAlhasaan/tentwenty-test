import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

// Global 404: a URL that matched no route belongs to no route group, so this
// renders on the bare root layout and brings its own page frame.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-6">
      <Brand className="mb-2" />
      <p className="font-mono text-sm text-ink-3">404</p>
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        We couldn&apos;t find that page
      </h1>
      <p className="max-w-[46ch] text-sm text-ink-2 text-pretty">
        The address may be mistyped, or the section may not exist yet. Everything
        the app can show is listed in the sidebar.
      </p>
      <Button
        className="mt-2"
        nativeButton={false}
        render={<Link href="/">Back to the dashboard</Link>}
      />
    </div>
  );
}
