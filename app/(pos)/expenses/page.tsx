import { Suspense } from "react";
import { ExpensesView } from "@/components/expenses/ExpensesView";

// useSearchParams (for dashboard deep links like ?from=..&to=..) needs a Suspense boundary.
export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesView />
    </Suspense>
  );
}
