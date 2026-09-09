"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // The message is logged for the developer but not rendered: it can carry
  // internals a reader has no use for.
  return <ErrorState onRetry={retry} />;
}
