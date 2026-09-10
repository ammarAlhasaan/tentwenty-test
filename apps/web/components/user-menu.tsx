"use client";

import { Button } from "@/components/ui/button";
import { useLogout, useMe } from "@/lib/auth";

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

/**
 * The design puts this in the sidebar footer, which its own stylesheet then
 * hides below 880px — leaving no way to sign out on a phone. It lives in the
 * sticky header here instead, so it is reachable at every width.
 */
export function UserMenu() {
  const { data: user } = useMe();
  const signOut = useLogout();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2.5">
      {signOut.isError ? (
        <p role="alert" className="text-xs font-medium text-negative">
          Couldn&apos;t sign out — you are still signed in.
        </p>
      ) : (
        <div className="hidden items-center gap-2.5 sm:flex">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-[11px] bg-brand-line font-mono text-xs font-bold text-brand-strong"
          >
            {initials(user.email)}
          </span>
          <span className="max-w-[18ch] truncate text-[13px] text-ink-2">
            {user.email}
          </span>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
      >
        {signOut.isPending
          ? "Signing out…"
          : signOut.isError
            ? "Try again"
            : "Sign out"}
      </Button>
    </div>
  );
}
