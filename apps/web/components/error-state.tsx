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
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <TriangleAlert className="size-6 text-negative" aria-hidden />
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
