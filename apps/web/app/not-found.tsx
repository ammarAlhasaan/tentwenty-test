import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
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
