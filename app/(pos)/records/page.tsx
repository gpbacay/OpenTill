import { Suspense } from "react";
import { SalesView } from "@/components/sales/SalesView";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";

// useSearchParams (for dashboard deep links like ?period=today) needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <SalesView />
    </Suspense>
  );
}
