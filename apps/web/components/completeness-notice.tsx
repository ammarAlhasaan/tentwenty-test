import Link from "next/link";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import type { Completeness } from "@/lib/analytics";

/**
 * The API reports arithmetic balance and dataset completeness separately. When
 * either input is partial it withholds the derived figures and says why, and
 * those reasons are scoped to the period that was requested — which is exactly
 * why this renders the response's own `issues` rather than a standing warning
 * list that describes some other period.
 */
export function CompletenessNotice({
  completeness,
  periodLabel,
}: {
  completeness: Completeness;
  periodLabel: string;
}) {
  const partial =
    completeness.cost === "partial" || completeness.revenue === "partial";

  if (!partial) return null;

  const what =
    completeness.cost === "partial" && completeness.revenue === "partial"
      ? "Cost and revenue"
      : completeness.cost === "partial"
        ? "Cost"
        : "Revenue";

  return (
    <Notice
      tone="danger"
      title={`${what} for ${periodLabel} is a known subtotal, not the whole answer`}
      // Naming a gap without offering the screen that closes it leaves the
      // reader with a problem and no move.
      action={
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/uploads">Open uploads</Link>}
        />
      }
    >
      {completeness.issues.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {completeness.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>{issue.message}</li>
          ))}
        </ul>
      ) : (
        <p>
          An input behind {periodLabel} is missing, so any figure derived from it
          is withheld rather than reported as though it were complete.
        </p>
      )}
    </Notice>
  );
}
