import { Suspense } from "react";
import { InventoryView } from "@/components/inventory/InventoryView";

// useSearchParams (for dashboard deep links like ?period=today) needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <InventoryView />
    </Suspense>
  );
}
