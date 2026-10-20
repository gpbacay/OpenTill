"use client";

import BentoDashboard from "@/components/dashboard/BentoDashboard";
import { usePos } from "@/contexts/pos-context";

export default function DashboardPage() {
  const { products, syncedOrders, activeTenant } = usePos();
  if (!activeTenant) return null;

  return (
    <BentoDashboard
      products={products}
      orders={syncedOrders}
      activeTenant={activeTenant}
    />
  );
}
