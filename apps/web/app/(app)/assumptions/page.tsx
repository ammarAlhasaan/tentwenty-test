import type { Metadata } from "next";
import { AssumptionsView } from "@/components/data/assumptions-view";

export const metadata: Metadata = { title: "Assumptions" };

export default function AssumptionsPage() {
  return <AssumptionsView />;
}
