"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/auth";
import { consumeDeliberateSignOut, safeReturnTo } from "@/lib/session";

/**
 * Shows the page body only once the session check has answered.
 *
 * This is the single owner of navigation away from the application: sign-out,
 * expiry and a plain signed-out visit all leave through here, so two redirects
 * can never race. It navigates on the *cache state* rather than on an event, so
 * several 401s arriving together still produce one navigation.
 *
 * It is a UX boundary, not a security one — apps/api's SessionAuthGuard decides
 * what data anyone may have.
 *
 * It wraps `<main>` rather than the whole shell: the sidebar, brand, navigation
 * and header are public and need no data, so making them wait on /auth/me only
 * delays the largest paint on the screen and guarantees a layout shift.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isPending, isError, refetch } = useMe();

  const sawUser = useRef(false);
  const navigated = useRef(false);

  useEffect(() => {
    if (user) sawUser.current = true;
  }, [user]);

  useEffect(() => {
    if (user !== null) {
      navigated.current = false;
      return;
    }
    if (navigated.current) return;
    navigated.current = true;

    const deliberate = consumeDeliberateSignOut();
    // Only a session we actually had can expire. A first visit while signed out
    // gets a plain login page with no notice.
    const expired = !deliberate && sawUser.current;
    sawUser.current = false;

    const params = new URLSearchParams();
    if (expired) params.set("reason", "expired");
    if (!deliberate) {
      const back = safeReturnTo(pathname);
      if (back !== "/") params.set("returnTo", back);
    }

    const query = params.toString();
    router.replace(query ? `/login?${query}` : "/login");
  }, [user, pathname, router]);

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <ErrorState
          title="Can't reach the service"
          description="We couldn't check whether you're signed in. The API may be down or unreachable."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (isPending || user === null) {
    return (
      <div className="flex flex-col gap-2" aria-busy role="status">
        <span className="sr-only">Checking your session</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }

  return <>{children}</>;
}
