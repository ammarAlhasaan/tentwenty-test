"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ErrorState({
  title = "Something went wrong",
  description = "The page could not be displayed. Trying again will re-render it.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="mb-1 grid size-14 place-items-center rounded-[18px] bg-negative-soft text-negative">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <h2 className="font-heading text-xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="max-w-[46ch] text-sm text-ink-2 text-pretty">
          {description}
        </p>
        <Button variant="outline" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
