"use client";

import { useMemo, useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { money } from "@/lib/money";
import { PERIOD_OPTIONS, inPeriod } from "@/lib/periods";
import { Expense } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { FilterSelect, SearchBox, StatTile, Toolbar, matches } from "@/components/data-table/controls";
import { ColumnManager, customColumnDefs, customFieldRows, customText } from "@/components/data-table/custom-columns";
import { DetailPanel, Fields, SplitView } from "@/components/data-table/DetailPanel";
import { ExpenseDialog } from "./ExpenseDialog";

const PAY_LABEL = { CASH: "Cash", CARD: "Card", MOBILE_WALLET: "Wallet" } as const;

export function ExpensesView() {
  const { activeTenant, tenantSyncedOrders } = usePos();
  const { expenses, suppliers, columnsFor } = useOps();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState("month");
  const [supplier, setSupplier] = useState("all");
  const [target, setTarget] = useState<Expense | "new" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currency = activeTenant?.currency ?? "PHP";
  const supplierName = (id?: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category))].sort(), [expenses]);
  const rows = useMemo(
    () =>
      expenses
        .filter(
          (e) =>
            inPeriod(e.date, period) &&
            (category === "all" || e.category === category) &&
            (supplier === "all" || (e.supplierId ?? "") === (supplier === "none" ? "" : supplier)) &&
            matches(query, e.description, e.category, supplierName(e.supplierId), customText(e))
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, period, category, supplier, query, suppliers]
  );

  const month = useMemo(() => {
    const spent = expenses.filter((e) => inPeriod(e.date, "month"));
    const sales = tenantSyncedOrders.filter((o) => o.status !== "FAILED" && inPeriod(o.date, "month"));
    const byCategory = new Map<string, number>();
    spent.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount));
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    const spentTotal = spent.reduce((sum, e) => sum + e.amount, 0);
    return { spentTotal, salesTotal: sales.reduce((sum, o) => sum + o.total, 0), top };
  }, [expenses, tenantSyncedOrders]);

  const columns: Column<Expense>[] = [
    { id: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</span> },
    { id: "category", header: "Category", cell: (e) => e.category },
    { id: "description", header: "Description", cell: (e) => <span className="block min-w-40">{e.description || "—"}</span> },
    { id: "supplier", header: "Supplier", cell: (e) => supplierName(e.supplierId) },
    { id: "pay", header: "Paid with", cell: (e) => PAY_LABEL[e.paymentMethod] ?? e.paymentMethod },
    { id: "amount", header: "Amount", align: "right", cell: (e) => money(currency, e.amount) },
    ...customColumnDefs<Expense>(columnsFor("expenses")),
  ];

  if (!activeTenant) return null;
  const net = month.salesTotal - month.spentTotal;
  const shown = rows.reduce((sum, e) => sum + e.amount, 0);

  const selected = expenses.find((e) => e.id === selectedId) ?? null;
  const panel = selected ? (
    <DetailPanel
      title={selected.description || selected.category}
      subtitle={new Date(selected.date).toLocaleDateString()}
      onClose={() => setSelectedId(null)}
      actions={<Button onClick={() => setTarget(selected)}>Edit</Button>}
    >
      <p className="text-3xl font-bold tabular-nums">{money(currency, selected.amount)}</p>
      <Fields
        rows={[
          ["Category", selected.category],
          ["Paid with", PAY_LABEL[selected.paymentMethod] ?? selected.paymentMethod],
          ["Supplier", supplierName(selected.supplierId)],
          ["Added", new Date(selected.createdAt).toLocaleString()],
          ...customFieldRows(columnsFor("expenses"), selected.custom),
        ]}
      />
    </DetailPanel>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SplitView panel={panel}>
      <div className="hidden shrink-0 grid-cols-2 gap-3 sm:grid lg:grid-cols-4">
        <StatTile label="Spent this month" value={money(currency, month.spentTotal)} />
        <StatTile label="Sales this month" value={money(currency, month.salesTotal)} />
        <StatTile
          label="Left after expenses"
          value={<span className={net < 0 ? "text-destructive" : ""}>{money(currency, net)}</span>}
          hint="Sales minus expenses"
        />
        <StatTile label="Biggest cost" value={month.top ? month.top[0] : "—"} hint={month.top ? money(currency, month.top[1]) : undefined} />
      </div>
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} placeholder="Search expenses…" />
        <FilterSelect label="Period" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
        <FilterSelect
          label="Supplier"
          value={supplier}
          onChange={setSupplier}
          options={[{ value: "all", label: "All suppliers" }, { value: "none", label: "No supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <span className="text-sm text-muted-foreground">Showing {money(currency, shown)}</span>
        <div className="ml-auto flex gap-2">
          <ColumnManager table="expenses" />
          <Button onClick={() => setTarget("new")}>Add expense</Button>
        </div>
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(e) => e.id}
        onRowClick={(e) => setSelectedId((current) => (current === e.id ? null : e.id))}
        selectedKey={selectedId}
        resetKey={`${query}|${period}|${category}|${supplier}`}
        empty={expenses.length === 0 ? "No expenses yet. Add rent, bills and anything else you pay for." : "Nothing matches those filters."}
      />
      </SplitView>
      <ExpenseDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
