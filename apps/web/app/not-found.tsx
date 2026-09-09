import Link from "next/link";
import { Button } from "@/components/ui/button";

// Global 404: a URL that matched no route belongs to no route group, so this
// renders on the bare root layout and brings its own page frame.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        We couldn&apos;t find that page
      </h1>
      <p className="max-w-prose text-muted-foreground">
        The address may be mistyped, or the section may not exist yet.
      </p>
      <Button
        nativeButton={false}
        render={<Link href="/">Back to the dashboard</Link>}
      />
    </div>
  );
}
