import { Suspense } from "react";
import {
  DashboardView,
  DashboardViewFallback,
} from "@/components/dashboard/dashboard-view";

// A server shell only. Nothing private is rendered here: the figures live in a
// client component behind AuthGate, and the gate is a UX boundary, not an
// authorization one (apps/web/README.md, section 8).
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardViewFallback />}>
      <DashboardView />
    </Suspense>
  );
}
