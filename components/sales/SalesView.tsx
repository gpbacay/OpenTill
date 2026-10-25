"use client";

import { useMemo, useState } from "react";
import { usePos } from "@/contexts/pos-context";
import { useOps } from "@/contexts/ops-context";
import { money } from "@/lib/money";
import { inRange, presetRange } from "@/lib/periods";
import { useSearchParams } from "next/navigation";
import { Order, Product } from "@/lib/types";
import { DetailPanel, Fields, SplitView } from "@/components/data-table/DetailPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { PrintReceipt } from "@/components/PrintReceipt";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteButton, ExportButton } from "@/components/data-table/bulk";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { DateRangeFilter, useRangeFilter } from "@/components/data-table/DateRangeFilter";
import { FilterSelects, passesFilters, type RowFilter, ResetFiltersButton, SearchBox, StatTile, FilterBar, Toolbar, ViewBySelect, GroupBySelect, useGroupBy, useFilter, matches, useViewMode } from "@/components/data-table/controls";

const STATUS = [
  { value: "all", label: "All sales" },
  { value: "COMPLETED", label: "Saved" },
  { value: "PENDING_SYNC", label: "Queued" },
  { value: "FAILED", label: "Failed" },
];
const PAYMENT = [
  { value: "all", label: "Any payment" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "MOBILE_WALLET", label: "Wallet" },
];
const PAY_LABEL: Record<string, string> = { CASH: "Cash", CARD: "Card", MOBILE_WALLET: "Wallet" };

export function SalesView() {
  const { activeTenant, tenantSyncedOrders, products } = usePos();
  const productColumns = useOps().columnsFor("products");
  const params = useSearchParams();
  const [tab, setTab] = useFilter<"sales" | "reports">("sales_tab", "sales");
  const [query, setQuery] = useFilter("sales_query", "");
  const [status, setStatus] = useFilter("sales_status", "all");
  const [payment, setPayment] = useFilter("sales_payment", "all");
  const [cashier, setCashier] = useFilter("sales_cashier", "all");
  const [view, setView] = useViewMode("sales", "table");
  const [groupBy, setGroupBy] = useGroupBy("sales");
  const [range, setRange] = useRangeFilter("sales", params, "month");
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("sale"));
  const currency = activeTenant?.currency ?? "PHP";

  const cashiers = useMemo(
    () => [...new Set(tenantSyncedOrders.map((o) => o.cashierName?.trim()).filter(Boolean) as string[])].sort(),
    [tenantSyncedOrders]
  );

  /** A sale's values for one product field: each distinct value across its items, from the products as they are now. */
  const productValues = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return (o: Order, pick: (p: Product) => string | undefined) =>
      [...new Set((o.items ?? []).map((i) => { const p = byId.get(i.productId); return p && pick(p); }).filter(Boolean))].join(", ");
  }, [products]);
  const brands = (o: Order) => productValues(o, (p) => p.brand);
  const custom = (o: Order, columnId: string) => productValues(o, (p) => p.custom?.[columnId]);

  const filters: RowFilter<Order>[] = [
    { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS, test: (o, v) => o.status === v },
    { id: "payment", label: "Payment", value: payment, onChange: setPayment, options: PAYMENT, test: (o, v) => o.paymentMethod === v },
    { id: "cashier", label: "Cashier", value: cashier, onChange: setCashier, options: [{ value: "all", label: "All cashiers" }, ...cashiers.map((c) => ({ value: c, label: c }))], test: (o, v) => o.cashierName === v },
  ];
  const rows = useMemo(
    () =>
      tenantSyncedOrders
        .filter(
          (o) =>
            inRange(o.date, range) &&
            passesFilters(o, filters) &&
            matches(query, o.id, o.customerName, o.cashierName, ...(o.items ?? []).map((i) => i.name), brands(o), ...productColumns.map((c) => custom(o, c.id)))
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [tenantSyncedOrders, range, status, payment, cashier, query, productColumns, productValues]
  );

  const totals = useMemo(() => {
    const counted = rows.filter((o) => o.status !== "FAILED");
    const sum = counted.reduce((s, o) => s + o.total, 0);
    return { sum, count: counted.length, avg: counted.length ? sum / counted.length : 0 };
  }, [rows]);

  const filtersActive = query.trim() !== "" || status !== "all" || payment !== "all" || cashier !== "all" || range.preset !== "month";
  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setPayment("all");
    setCashier("all");
    setRange(presetRange("month"));
    setSelectedId(null);
  };

  const columns: Column<Order>[] = [
    { id: "date", header: "Date", cell: (o) => <span className="whitespace-nowrap">{new Date(o.date).toLocaleString()}</span>, group: (o) => new Date(o.date).toLocaleDateString() },
    { id: "receipt", header: "Receipt", cell: (o) => <span className="text-xs text-muted-foreground">{o.id.slice(-8)}</span> },
    { id: "customer", header: "Customer", cell: (o) => o.customerName || "Walk-in" },
    { id: "cashier", header: "Cashier", cell: (o) => o.cashierName || "—" },
    { id: "items", header: "Items", align: "right", cell: (o) => (o.items ? o.items.reduce((s, i) => s + i.quantity, 0) : "—") },
    { id: "brand", header: "Brand", cell: (o) => brands(o) || "—" },
    { id: "payment", header: "Payment", cell: (o) => PAY_LABEL[o.paymentMethod] ?? o.paymentMethod },
    { id: "discount", header: "Discount", align: "right", cell: (o) => (o.discountAmount ? money(currency, o.discountAmount) : "—") },
    { id: "total", header: "Total", align: "right", cell: (o) => <span className="font-medium">{money(currency, o.total)}</span> },
    {
      id: "status",
      header: "Status",
      cell: (o) =>
        o.status === "PENDING_SYNC" ? <Badge variant="secondary">Queued</Badge> : o.status === "FAILED" ? <Badge variant="destructive">Failed</Badge> : <Badge variant="outline">Saved</Badge>,
    },
    ...productColumns.map((c): Column<Order> => ({
      id: `custom-${c.id}`,
      header: c.label,
      cell: (o) => custom(o, c.id) || <span className="text-muted-foreground">—</span>,
    })),
  ];

  if (!activeTenant) return null;

  const selected = tenantSyncedOrders.find((o) => o.id === selectedId) ?? null;
  const panel =
    selected && tab === "sales" ? (
      <DetailPanel
        title={`Sale ${selected.id.slice(-8)}`}
        subtitle={new Date(selected.date).toLocaleString()}
        onClose={() => setSelectedId(null)}
      >
        <Fields
          rows={[
            ["ID", <span key="sale-id" className="break-all font-mono text-xs">{selected.id}</span>],
            ["Customer", selected.customerName || "Walk-in"],
            ["Cashier", selected.cashierName || "—"],
            ["Payment", PAY_LABEL[selected.paymentMethod] ?? selected.paymentMethod],
            ["Status", selected.status === "PENDING_SYNC" ? "Queued, not saved yet" : selected.status === "FAILED" ? "Failed" : "Saved"],
          ]}
        />
        {selected.items?.length ? (
          <PrintReceipt order={selected} items={selected.items} tenant={activeTenant} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Item details for this sale aren&apos;t on this device yet. Total {money(currency, selected.total)}.
          </p>
        )}
      </DetailPanel>
    ) : null;

  const tabs = (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as "sales" | "reports");
        setSelectedId(null);
      }}
    >
      <TabsList>
        <TabsTrigger value="sales">Sales</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SplitView panel={panel}>
      {tab === "reports" ? (
        <>
          <Toolbar>{tabs}</Toolbar>
          <div className="min-h-0 flex-1">
            <AnalyticsPanel orders={tenantSyncedOrders} activeTenant={activeTenant} />
          </div>
        </>
      ) : (
        <>
          <div className="hidden shrink-0 grid-cols-3 gap-3 sm:grid">
            <StatTile label="Sales in view" value={money(currency, totals.sum)} />
            <StatTile label="Orders" value={totals.count} />
            <StatTile label="Average sale" value={money(currency, totals.avg)} />
          </div>
          {/* Tabs share the filter button's row so phones don't spend a row on each. */}
          <FilterBar active={filtersActive} leading={tabs}>
            <SearchBox value={query} onChange={setQuery} placeholder="Search customer, cashier, item…" />
            <DateRangeFilter value={range} onChange={setRange} />
            <FilterSelects filters={filters} />
            <ViewBySelect value={view} onChange={setView} />
            <GroupBySelect columns={columns} value={groupBy} onChange={setGroupBy} />
            {filtersActive ? <ResetFiltersButton onClick={resetFilters} /> : null}
          </FilterBar>
          <DataTable
            rows={rows}
            columns={columns}
              groupBy={groupBy}
              stateKey="sales"
              rowFilters={filters}
            rowKey={(o) => o.id}
            view={view}
            cardValue="total"
            onRowClick={(o, checked) => setSelectedId((current) => (checked ? o.id : current === o.id ? null : current))}
            selectedKey={selectedId}
            bulkActions={(chosen) => (
              <>
                <span className="text-muted-foreground">Total {money(currency, chosen.filter((o) => o.status !== "FAILED").reduce((sum, o) => sum + o.total, 0))}</span>
                <ExportButton
                  filename="sales.csv"
                  headers={["Date", "ID", "Customer", "Cashier", "Payment", "Discount", "Total", "Status", "Brand", ...productColumns.map((c) => c.label)]}
                  rows={chosen.map((o) => [new Date(o.date).toLocaleString(), o.id, o.customerName ?? "Walk-in", o.cashierName ?? "", PAY_LABEL[o.paymentMethod] ?? o.paymentMethod, o.discountAmount ?? 0, o.total, o.status, brands(o), ...productColumns.map((c) => custom(o, c.id))])}
                />
              </>
            )}
            resetKey={`${query}|${range.from}|${range.to}|${status}|${payment}|${cashier}`}
            empty={tenantSyncedOrders.length === 0 ? "Completed sales show up here." : "Nothing matches those filters."}
          />
        </>
      )}
      </SplitView>
    </div>
  );
}
