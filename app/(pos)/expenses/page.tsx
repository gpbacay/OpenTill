import { Suspense } from "react";
import { ExpensesView } from "@/components/expenses/ExpensesView";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";

// useSearchParams (for dashboard deep links like ?from=..&to=..) needs a Suspense boundary.
export default function ExpensesPage() {
  return (
    <Suspense fallback={<TablePageSkeleton stats={4} />}>
      <ExpensesView />
    </Suspense>
  );
}
