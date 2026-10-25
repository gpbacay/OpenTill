"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useCollection } from "@/lib/use-collection";
import { useAuth } from "@/contexts/auth-context";
import { usePos } from "@/contexts/pos-context";
import { canOpen } from "@/components/layout/Sidebar";
import type { Category, CustomColumn, CustomColumnTable, Expense, StockMovement, Supplier } from "@/lib/types";

/** Back-office data for the active store: suppliers, expenses, the stock ledger and user-defined columns. */
interface OpsValue {
  suppliers: Supplier[];
  expenses: Expense[];
  movements: StockMovement[];
  columns: CustomColumn[];
  categories: Category[];
  ready: {
    suppliers: boolean;
    expenses: boolean;
    movements: boolean;
    columns: boolean;
    categories: boolean;
  };
  pending: number;
  saveSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  saveExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  /** Apply a stock change locally and queue it for the server. */
  recordMovement: (movement: StockMovement) => void;
  saveColumn: (column: CustomColumn) => void;
  deleteColumn: (id: string) => void;
  columnsFor: (table: CustomColumnTable) => CustomColumn[];
  saveCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
}

const OpsContext = createContext<OpsValue | null>(null);

export function OpsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const { activeTenant, handleApplyMovement } = usePos();
  // A cashier only gets the lists behind the pages their admin gave them (see PAGE_ROUTES in auth.guard); the rest stay empty.
  const { user } = useAuth();
  const inventory = canOpen(user, "/inventory");
  const spending = canOpen(user, "/expenses");
  const admin = canOpen(user, "/settings");
  const suppliers = useCollection<Supplier>(userId, "suppliers", "suppliers", "suppliers", inventory || spending);
  const expenses = useCollection<Expense>(userId, "expenses", "expenses", "expenses", spending);
  const movements = useCollection<StockMovement>(userId, "movements", "stock-movements", "stock", inventory);
  // Every page that lists products or sales shows the custom columns, so everyone loads them.
  const columns = useCollection<CustomColumn>(userId, "columns", "columns", "columns");
  const categories = useCollection<Category>(userId, "categories", "categories", "categories", inventory || admin);

  const tenantId = activeTenant?.id;
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((row) => row.tenantId === tenantId);

  const value = useMemo<OpsValue>(
    () => {
      const tenantColumns = mine(columns.items);
      return {
        suppliers: mine(suppliers.items),
        expenses: mine(expenses.items),
        movements: mine(movements.items),
        columns: tenantColumns,
        categories: mine(categories.items).sort((a, b) => a.name.localeCompare(b.name)),
        ready: {
          suppliers: suppliers.ready,
          expenses: expenses.ready,
          movements: movements.ready,
          columns: columns.ready,
          categories: categories.ready,
        },
        pending: suppliers.pending + expenses.pending + movements.pending + columns.pending + categories.pending,
        saveSupplier: suppliers.upsert,
        deleteSupplier: suppliers.remove,
        saveExpense: expenses.upsert,
        deleteExpense: expenses.remove,
        recordMovement: (movement) => {
          handleApplyMovement(movement);
          movements.upsert(movement);
        },
        saveColumn: columns.upsert,
        deleteColumn: columns.remove,
        columnsFor: (table) => tenantColumns.filter((column) => column.tableName === table),
        saveCategory: categories.upsert,
        deleteCategory: categories.remove,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId, suppliers.items, expenses.items, movements.items, columns.items, categories.items, suppliers.ready, expenses.ready, movements.ready, columns.ready, categories.ready, suppliers.pending, expenses.pending, movements.pending, columns.pending, categories.pending]
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error("useOps must be used within an OpsProvider");
  return ctx;
}
