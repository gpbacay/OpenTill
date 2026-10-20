import { Suspense } from "react";
import { SalesView } from "@/components/sales/SalesView";

// useSearchParams (for dashboard deep links like ?period=today) needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <SalesView />
    </Suspense>
  );
}
