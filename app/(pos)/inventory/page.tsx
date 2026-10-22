import { Suspense } from "react";
import { InventoryView } from "@/components/inventory/InventoryView";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";

// useSearchParams (for dashboard deep links like ?period=today) needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<TablePageSkeleton stats={4} />}>
      <InventoryView />
    </Suspense>
  );
}
