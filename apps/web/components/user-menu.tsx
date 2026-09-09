"use client";

import { Button } from "@/components/ui/button";
import { useLogout, useMe } from "@/lib/auth";

export function UserMenu() {
  const { data: user } = useMe();
  const signOut = useLogout();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {signOut.isError ? (
        <p role="alert" className="text-xs text-negative">
          Couldn&apos;t sign out — you are still signed in.
        </p>
      ) : (
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user.email}
        </span>
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
