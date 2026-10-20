"use client";

import { useMemo, useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { money } from "@/lib/money";
import { Supplier } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { FilterSelect, SearchBox, StatTile, Toolbar, matches } from "@/components/data-table/controls";
import { ColumnManager, customColumnDefs, customFieldRows, customText } from "@/components/data-table/custom-columns";
import { DetailPanel, Fields, PanelSection, SplitView } from "@/components/data-table/DetailPanel";
import { SupplierDialog } from "./SupplierDialog";

const STATUS = [
  { value: "all", label: "All suppliers" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function SuppliersView() {
  const { products, activeTenant } = usePos();
  const { suppliers, movements, expenses, columnsFor } = useOps();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [target, setTarget] = useState<Supplier | "new" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currency = activeTenant?.currency ?? "PHP";

  // Per supplier: product count, restocks bought, and last delivery. Computed once, not per cell.
  const stats = useMemo(() => {
    const byId = new Map<string, { products: number; spent: number; last?: string }>();
    const slot = (id: string) => {
      if (!byId.has(id)) byId.set(id, { products: 0, spent: 0 });
      return byId.get(id)!;
    };
    products.filter((p) => p.tenantId === activeTenant?.id && p.supplierId).forEach((p) => (slot(p.supplierId!).products += 1));
    movements
      .filter((m) => m.type === "RESTOCK" && m.supplierId)
      .forEach((m) => {
        const s = slot(m.supplierId!);
        s.spent += m.quantity * (m.unitCost ?? 0);
        if (!s.last || m.date > s.last) s.last = m.date;
      });
    return byId;
  }, [products, movements, activeTenant?.id]);

  const rows = useMemo(
    () =>
      suppliers
        .filter(
          (s) =>
            (status === "all" || (status === "active") === s.active) &&
            matches(query, s.name, s.contactPerson, s.phone, s.email, s.address, customText(s))
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers, status, query]
  );

  const columns: Column<Supplier>[] = [
    {
      id: "name",
      header: "Supplier",
      cell: (s) => (
        <div className="min-w-40">
          <p className="font-medium">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.contactPerson || "No contact person"}</p>
        </div>
      ),
    },
    { id: "phone", header: "Phone", cell: (s) => s.phone || "—" },
    { id: "email", header: "Email", cell: (s) => s.email || "—" },
    { id: "products", header: "Products", align: "right", cell: (s) => stats.get(s.id)?.products ?? 0 },
    { id: "spent", header: "Bought (restocks)", align: "right", cell: (s) => money(currency, stats.get(s.id)?.spent ?? 0) },
    {
      id: "last",
      header: "Last delivery",
      cell: (s) => {
        const last = stats.get(s.id)?.last;
        return last ? new Date(last).toLocaleDateString() : "—";
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (s) => (s.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>),
    },
    ...customColumnDefs<Supplier>(columnsFor("suppliers")),
  ];

  if (!activeTenant) return null;
  const now = new Date();
  const paidThisMonth = expenses
    .filter((e) => e.supplierId && new Date(e.date).getMonth() === now.getMonth() && new Date(e.date).getFullYear() === now.getFullYear())
    .reduce((sum, e) => sum + e.amount, 0);

  const selected = suppliers.find((s) => s.id === selectedId) ?? null;
  const supplied = selected ? products.filter((p) => p.tenantId === activeTenant.id && p.supplierId === selected.id) : [];
  const deliveries = selected
    ? movements.filter((m) => m.type === "RESTOCK" && m.supplierId === selected.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    : [];
  const panel = selected ? (
    <DetailPanel
      title={selected.name}
      subtitle={selected.active ? "Active supplier" : "Inactive supplier"}
      onClose={() => setSelectedId(null)}
      actions={<Button onClick={() => setTarget(selected)}>Edit</Button>}
    >
      <Fields
        rows={[
          ["Contact", selected.contactPerson || "—"],
          ["Phone", selected.phone ? <a className="underline-offset-4 hover:underline" href={`tel:${selected.phone}`}>{selected.phone}</a> : "—"],
          ["Email", selected.email ? <a className="underline-offset-4 hover:underline" href={`mailto:${selected.email}`}>{selected.email}</a> : "—"],
          ["Address", selected.address || "—"],
          ["Bought (restocks)", money(currency, stats.get(selected.id)?.spent ?? 0)],
          ...customFieldRows(columnsFor("suppliers"), selected.custom),
        ]}
      />
      {selected.notes ? <p className="text-sm text-muted-foreground">{selected.notes}</p> : null}
      <PanelSection title={`Products they supply (${supplied.length})`}>
        {supplied.length === 0 ? (
          <p className="text-sm text-muted-foreground">None linked yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {supplied.slice(0, 8).map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="tabular-nums text-muted-foreground">{p.stock}</span>
              </li>
            ))}
            {supplied.length > 8 ? <li className="text-xs text-muted-foreground">and {supplied.length - 8} more</li> : null}
          </ul>
        )}
      </PanelSection>
      <PanelSection title="Recent deliveries">
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No restocks recorded.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {deliveries.map((m) => (
              <li key={m.id} className="flex justify-between gap-2">
                <span className="truncate">{m.quantity} × {m.productName}</span>
                <span className="shrink-0 text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </DetailPanel>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SplitView panel={panel}>
      <div className="hidden shrink-0 grid-cols-3 gap-3 sm:grid">
        <StatTile label="Suppliers" value={suppliers.length} />
        <StatTile label="Active" value={suppliers.filter((s) => s.active).length} />
        <StatTile label="Paid to suppliers this month" value={money(currency, paidThisMonth)} />
      </div>
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, contact, phone…" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS} />
        <div className="ml-auto flex gap-2">
          <ColumnManager table="suppliers" />
          <Button onClick={() => setTarget("new")}>Add supplier</Button>
        </div>
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        onRowClick={(s) => setSelectedId((current) => (current === s.id ? null : s.id))}
        selectedKey={selectedId}
        resetKey={`${query}|${status}`}
        empty={suppliers.length === 0 ? "No suppliers yet. Add the people you buy stock from." : "Nothing matches those filters."}
      />
      </SplitView>
      <SupplierDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
