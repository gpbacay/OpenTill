"use client";

import { useMemo, useState } from "react";
import { usePos } from "@/contexts/pos-context";
import { money } from "@/lib/money";
import { inRange, rangeFromParams } from "@/lib/periods";
import { useSearchParams } from "next/navigation";
import { Order } from "@/lib/types";
import { DetailPanel, Fields, SplitView } from "@/components/data-table/DetailPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { PrintReceipt } from "@/components/PrintReceipt";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteButton, ExportButton } from "@/components/data-table/bulk";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { DateRangeFilter } from "@/components/data-table/DateRangeFilter";
import { FilterSelect, SearchBox, StatTile, Toolbar, matches } from "@/components/data-table/controls";

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
  const { activeTenant, tenantSyncedOrders } = usePos();
  const params = useSearchParams();
  const [tab, setTab] = useState<"sales" | "reports">("sales");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [cashier, setCashier] = useState("all");
  const [range, setRange] = useState(() => rangeFromParams(params, "month"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currency = activeTenant?.currency ?? "PHP";

  const cashiers = useMemo(
    () => [...new Set(tenantSyncedOrders.map((o) => o.cashierName?.trim()).filter(Boolean) as string[])].sort(),
    [tenantSyncedOrders]
  );

  const rows = useMemo(
    () =>
      tenantSyncedOrders
        .filter(
          (o) =>
            inRange(o.date, range) &&
            (status === "all" || o.status === status) &&
            (payment === "all" || o.paymentMethod === payment) &&
            (cashier === "all" || o.cashierName === cashier) &&
            matches(query, o.id, o.customerName, o.cashierName, ...(o.items ?? []).map((i) => i.name))
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [tenantSyncedOrders, range, status, payment, cashier, query]
  );

  const totals = useMemo(() => {
    const counted = rows.filter((o) => o.status !== "FAILED");
    const sum = counted.reduce((s, o) => s + o.total, 0);
    return { sum, count: counted.length, avg: counted.length ? sum / counted.length : 0 };
  }, [rows]);

  const columns: Column<Order>[] = [
    { id: "date", header: "When", cell: (o) => <span className="whitespace-nowrap">{new Date(o.date).toLocaleString()}</span> },
    { id: "receipt", header: "Receipt", cell: (o) => <span className="text-xs text-muted-foreground">{o.id.slice(-8)}</span> },
    { id: "customer", header: "Customer", cell: (o) => o.customerName || "Walk-in" },
    { id: "cashier", header: "Cashier", cell: (o) => o.cashierName || "—" },
    { id: "items", header: "Items", align: "right", cell: (o) => (o.items ? o.items.reduce((s, i) => s + i.quantity, 0) : "—") },
    { id: "payment", header: "Payment", cell: (o) => PAY_LABEL[o.paymentMethod] ?? o.paymentMethod },
    { id: "discount", header: "Discount", align: "right", cell: (o) => (o.discountAmount ? money(currency, o.discountAmount) : "—") },
    { id: "total", header: "Total", align: "right", cell: (o) => <span className="font-medium">{money(currency, o.total)}</span> },
    {
      id: "status",
      header: "Status",
      cell: (o) =>
        o.status === "PENDING_SYNC" ? <Badge variant="secondary">Queued</Badge> : o.status === "FAILED" ? <Badge variant="destructive">Failed</Badge> : <Badge variant="outline">Saved</Badge>,
    },
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SplitView panel={panel}>
      <Toolbar>
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
      </Toolbar>

      {tab === "reports" ? (
        <div className="min-h-0 flex-1">
          <AnalyticsPanel orders={tenantSyncedOrders} activeTenant={activeTenant} />
        </div>
      ) : (
        <>
          <div className="hidden shrink-0 grid-cols-3 gap-3 sm:grid">
            <StatTile label="Sales in view" value={money(currency, totals.sum)} />
            <StatTile label="Orders" value={totals.count} />
            <StatTile label="Average sale" value={money(currency, totals.avg)} />
          </div>
          <Toolbar>
            <SearchBox value={query} onChange={setQuery} placeholder="Search customer, cashier, item…" />
            <DateRangeFilter value={range} onChange={setRange} />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS} />
            <FilterSelect label="Payment" value={payment} onChange={setPayment} options={PAYMENT} />
            <FilterSelect label="Cashier" value={cashier} onChange={setCashier} options={[{ value: "all", label: "All cashiers" }, ...cashiers.map((c) => ({ value: c, label: c }))]} />
          </Toolbar>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(o) => o.id}
            onRowClick={(o) => setSelectedId((current) => (current === o.id ? null : o.id))}
            selectedKey={selectedId}
            bulkActions={(chosen) => (
              <>
                <span className="text-muted-foreground">Total {money(currency, chosen.filter((o) => o.status !== "FAILED").reduce((sum, o) => sum + o.total, 0))}</span>
                <ExportButton
                  filename="sales.csv"
                  headers={["When", "Receipt", "Customer", "Cashier", "Payment", "Discount", "Total", "Status"]}
                  rows={chosen.map((o) => [new Date(o.date).toLocaleString(), o.id, o.customerName ?? "Walk-in", o.cashierName ?? "", PAY_LABEL[o.paymentMethod] ?? o.paymentMethod, o.discountAmount ?? 0, o.total, o.status])}
                />
              </>
            )}
            resetKey={`${query}|${range.from}|${range.to}|${status}|${payment}|${cashier}`}
            empty={tenantSyncedOrders.length === 0 ? "Completed checkouts show up here." : "Nothing matches those filters."}
          />
        </>
      )}
      </SplitView>
    </div>
  );
}
