"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { isCashier } from "@/lib/local-auth";
import { money } from "@/lib/money";
import { useSearchParams } from "next/navigation";
import { inPeriod, inRange, presetRange, rangeFromParams } from "@/lib/periods";
import { Expense } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DeleteButton, ExportButton } from "@/components/data-table/bulk";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { DateRangeFilter } from "@/components/data-table/DateRangeFilter";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { ToolbarButton, FilterSelect, ResetFiltersButton, SearchBox, StatTile, FilterBar, ViewBySelect, GroupBySelect, useGroupBy, matches, useViewMode } from "@/components/data-table/controls";
import { ColumnManager, customColumnDefs, customFieldRows, customText } from "@/components/data-table/custom-columns";
import { DetailPanel, Fields, SplitView } from "@/components/data-table/DetailPanel";
import { ExpenseDialog } from "./ExpenseDialog";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";

const PAY_LABEL = { CASH: "Cash", CARD: "Card", MOBILE_WALLET: "Wallet" } as const;

export function ExpensesView() {
  // A cashier's sales list holds only their own sales, and profit stays with the admin.
  const cashier = isCashier(useAuth().user);
  const { activeTenant, tenantSyncedOrders } = usePos();
  const { expenses, suppliers, columnsFor, deleteExpense, ready } = useOps();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const params = useSearchParams();
  const [range, setRange] = useState(() => rangeFromParams(params, "month"));
  const [supplier, setSupplier] = useState("all");
  const [view, setView] = useViewMode("expenses", "table");
  const [groupBy, setGroupBy] = useGroupBy("expenses");
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
            inRange(e.date, range) &&
            (category === "all" || e.category === category) &&
            (supplier === "all" || (e.supplierId ?? "") === (supplier === "none" ? "" : supplier)) &&
            matches(query, e.id, e.description, e.category, supplierName(e.supplierId), customText(e))
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, range, category, supplier, query, suppliers]
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
    { id: "category", header: "Category", cell: (e) => e.category },
    { id: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</span>, group: (e) => new Date(e.date).toLocaleDateString() },
    { id: "description", header: "Description", cell: (e) => <span className="block min-w-40">{e.description || "—"}</span> },
    { id: "supplier", header: "Supplier", cell: (e) => supplierName(e.supplierId) },
    { id: "pay", header: "Paid with", cell: (e) => PAY_LABEL[e.paymentMethod] ?? e.paymentMethod },
    { id: "amount", header: "Amount", align: "right", cell: (e) => money(currency, e.amount) },
    ...customColumnDefs<Expense>(columnsFor("expenses")),
  ];

  if (!activeTenant) return null;
  if (!ready.expenses || !ready.suppliers || !ready.columns) return <TablePageSkeleton stats={4} />;
  const net = month.salesTotal - month.spentTotal;
  const shown = rows.reduce((sum, e) => sum + e.amount, 0);
  const filtersActive = query.trim() !== "" || category !== "all" || supplier !== "all" || range.preset !== "month";
  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setSupplier("all");
    setRange(presetRange("month"));
    setSelectedId(null);
  };

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
          ["ID", <span key="expense-id" className="break-all font-mono text-xs">{selected.id}</span>],
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
      <div className={`hidden shrink-0 grid-cols-2 gap-3 sm:grid ${cashier ? "" : "lg:grid-cols-4"}`}>
        <StatTile label="Spent this month" value={money(currency, month.spentTotal)} />
        {cashier ? null : (
          <>
            <StatTile label="Sales this month" value={money(currency, month.salesTotal)} />
            <StatTile
              label="Left after expenses"
              value={<span className={net < 0 ? "text-destructive" : ""}>{money(currency, net)}</span>}
              hint="Sales minus expenses"
            />
          </>
        )}
        <StatTile label="Biggest cost" value={month.top ? month.top[0] : "—"} hint={month.top ? money(currency, month.top[1]) : undefined} />
      </div>
      <FilterBar
        active={filtersActive}
        actions={
          <>
            <ColumnManager table="expenses" />
            <ToolbarButton icon={PlusSignIcon} label="Add expense" short="Add" onClick={() => setTarget("new")} />
          </>
        }
      >
        <SearchBox value={query} onChange={setQuery} placeholder="Search expenses…" />
        <DateRangeFilter value={range} onChange={setRange} />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
        <FilterSelect
          label="Supplier"
          value={supplier}
          onChange={setSupplier}
          options={[{ value: "all", label: "All suppliers" }, { value: "none", label: "No supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <ViewBySelect value={view} onChange={setView} />
        <GroupBySelect columns={columns} value={groupBy} onChange={setGroupBy} />
        {filtersActive ? <ResetFiltersButton onClick={resetFilters} /> : null}
        <span className="text-sm text-muted-foreground">Showing {money(currency, shown)}</span>
      </FilterBar>
      <DataTable
        rows={rows}
        columns={columns}
          groupBy={groupBy}
        rowKey={(e) => e.id}
        view={view}
        cardTitle="date"
        cardValue="amount"
        columnOrderKey="expenses"
        onRowClick={(e, checked) => setSelectedId((current) => (checked ? e.id : current === e.id ? null : current))}
        selectedKey={selectedId}
        bulkActions={(chosen, clear) => (
          <>
            <span className="text-muted-foreground">Total {money(currency, chosen.reduce((sum, e) => sum + e.amount, 0))}</span>
            <ExportButton
              filename="expenses.csv"
              headers={["ID", "Date", "Category", "Description", "Supplier", "Paid with", "Amount", ...columnsFor("expenses").map((c) => c.label)]}
              rows={chosen.map((e) => [e.id, new Date(e.date).toLocaleDateString(), e.category, e.description, supplierName(e.supplierId), PAY_LABEL[e.paymentMethod] ?? e.paymentMethod, e.amount, ...columnsFor("expenses").map((c) => e.custom?.[c.id] ?? "")])}
            />
            <DeleteButton
              count={chosen.length}
              noun="expense"
              onConfirm={() => {
                chosen.forEach((e) => deleteExpense(e.id));
                if (chosen.some((e) => e.id === selectedId)) setSelectedId(null);
                clear();
              }}
            />
          </>
        )}
        resetKey={`${query}|${range.from}|${range.to}|${category}|${supplier}`}
        empty={expenses.length === 0 ? "No expenses yet. Add rent, bills and anything else you pay for." : "Nothing matches those filters."}
      />
      </SplitView>
      <ExpenseDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
