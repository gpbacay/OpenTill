"use client";

import BentoDashboard from "@/components/dashboard/BentoDashboard";
import { usePos } from "@/contexts/pos-context";

export default function HomePage() {
  const { products, syncedOrders, activeTenant } = usePos();

  return (
    <BentoDashboard
      products={products}
      orders={syncedOrders}
      activeTenant={activeTenant}
    />
  );
}
