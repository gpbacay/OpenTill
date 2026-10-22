import { Suspense } from "react";
import { ReportsView } from "@/components/reports/ReportsView";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";

// useSearchParams (for links like ?type=sales&from=..) needs a Suspense boundary.
export default function ReportsPage() {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <ReportsView />
    </Suspense>
  );
}
