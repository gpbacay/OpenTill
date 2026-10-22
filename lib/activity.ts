import { money } from "@/lib/money";
import type { Expense, Order, StockMovement, Supplier } from "@/lib/types";

export type ActivityKind = "sale" | "expense" | "stock" | "supplier";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  date: string;
  href: string;
}

interface ActivitySource {
  orders: Order[];
  expenses: Expense[];
  movements: StockMovement[];
  suppliers: Supplier[];
  currency: string;
}

export function buildActivity({ orders, expenses, movements, suppliers, currency }: ActivitySource) {
  const sales: ActivityItem[] = orders.map((order) => ({
    id: `sale-${order.id}`,
    kind: "sale",
    title:
      order.status === "PENDING_SYNC"
        ? "Sale queued for sync"
        : order.status === "FAILED"
          ? "Sale needs attention"
          : "Sale completed",
    description: `${order.customerName || "Walk-in customer"} · ${money(currency, order.total)}`,
    date: order.date,
    href: `/records?preset=all&sale=${encodeURIComponent(order.id)}`,
  }));

  const costs: ActivityItem[] = expenses.map((expense) => ({
    id: `expense-${expense.id}`,
    kind: "expense",
    title: "Expense recorded",
    description: `${expense.description || expense.category} · ${money(currency, expense.amount)}`,
    date: expense.createdAt || expense.date,
    href: "/expenses?preset=all",
  }));

  const stock: ActivityItem[] = movements
    .filter((movement) => movement.type !== "SALE")
    .map((movement) => ({
      id: `stock-${movement.id}`,
      kind: "stock",
      title:
        movement.type === "RESTOCK"
          ? "Stock received"
          : movement.type === "OPENING"
            ? "Opening stock added"
            : "Stock adjusted",
      description: `${movement.productName} · ${movement.quantity > 0 ? "+" : ""}${movement.quantity}`,
      date: movement.date,
      href: "/inventory",
    }));

  const partners: ActivityItem[] = suppliers.map((supplier) => ({
    id: `supplier-${supplier.id}`,
    kind: "supplier",
    title: supplier.active ? "Supplier added" : "Supplier updated",
    description: supplier.name,
    date: supplier.createdAt,
    href: "/suppliers",
  }));

  return [...sales, ...costs, ...stock, ...partners]
    .filter((item) => !Number.isNaN(new Date(item.date).getTime()))
    .sort((left, right) => right.date.localeCompare(left.date));
}
