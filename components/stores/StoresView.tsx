"use client";

import { useMemo, useState } from "react";
import { usePos } from "@/contexts/pos-context";
import { Tenant } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { DetailPanel, Fields, SplitView } from "@/components/data-table/DetailPanel";
import { ExportButton } from "@/components/data-table/bulk";
import { FilterBar, FilterSelect, ResetFiltersButton, SearchBox, StatTile, ViewBySelect, matches, useViewMode } from "@/components/data-table/controls";
import { DeleteStoresDialog } from "./DeleteStoresDialog";
import { StoreDialog } from "./StoreDialog";
import { useCashiers } from "./use-cashiers";

const pct = (rate: number) => `${+(rate * 100).toFixed(2)}%`;

export function StoresView() {
  const { tenants, activeTenant, products, syncedOrders, handleSwitchTenant, handleDeleteTenants } = usePos();
  const { cashiers, reload } = useCashiers();
  const [query, setQuery] = useState("");
  const [business, setBusiness] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [view, setView] = useViewMode("stores", "table");
  const [target, setTarget] = useState<Tenant | "new" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<{ stores: Tenant[]; after?: () => void } | null>(null);

  // Per store: products, sales and cashiers. Computed once, not per cell.
  const stats = useMemo(() => {
    const byId = new Map<string, { products: number; sales: number; cashiers: number }>();
    const slot = (id: string) => {
      if (!byId.has(id)) byId.set(id, { products: 0, sales: 0, cashiers: 0 });
      return byId.get(id)!;
    };
    products.forEach((p) => (slot(p.tenantId).products += 1));
    syncedOrders.forEach((o) => (slot(o.tenantId).sales += 1));
    cashiers?.forEach((c) => (slot(c.tenantId).cashiers += 1));
    return byId;
  }, [products, syncedOrders, cashiers]);
  const statsOf = (id: string) => stats.get(id) ?? { products: 0, sales: 0, cashiers: 0 };

  const businesses = [...new Set(tenants.map((t) => t.businessType))].sort();
  const currencies = [...new Set(tenants.map((t) => t.currency))].sort();
  const rows = useMemo(
    () =>
      tenants
        .filter(
          (t) =>
            (business === "all" || t.businessType === business) &&
            (currency === "all" || t.currency === currency) &&
            matches(query, t.id, t.name, t.businessType, t.currency)
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tenants, business, currency, query]
  );
  const filtersActive = query.trim() !== "" || business !== "all" || currency !== "all";
  const resetFilters = () => {
    setQuery("");
    setBusiness("all");
    setCurrency("all");
    setSelectedId(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { stores, after } = deleting;
    const message = await handleDeleteTenants(stores.map((t) => t.id));
    setError(message ?? "");
    setDeleting(null);
    after?.();
    void reload();
    setSelectedId((current) => (stores.some((t) => t.id === current) ? null : current));
  };

  const columns: Column<Tenant>[] = [
    {
      id: "name",
      header: "Store",
      cell: (t) => (
        <div className="min-w-40">
          <p className="flex items-center gap-2 font-medium">
            {t.name}
            {t.id === activeTenant?.id ? <Badge variant="secondary">Current</Badge> : null}
          </p>
          <p className="text-xs text-muted-foreground">{t.businessType}</p>
        </div>
      ),
    },
    { id: "currency", header: "Currency", cell: (t) => t.currency },
    { id: "tax", header: "Sales tax", align: "right", cell: (t) => pct(t.taxRate) },
    { id: "products", header: "Products", align: "right", cell: (t) => statsOf(t.id).products },
    { id: "sales", header: "Sales", align: "right", cell: (t) => statsOf(t.id).sales },
    { id: "cashiers", header: "Cashiers", align: "right", cell: (t) => (cashiers ? statsOf(t.id).cashiers : "—") },
    { id: "created", header: "Created", cell: (t) => new Date(t.createdAt).toLocaleDateString() },
  ];

  const selected = tenants.find((t) => t.id === selectedId) ?? null;
  const panel = selected ? (
    <DetailPanel
      title={selected.name}
      subtitle={selected.id === activeTenant?.id ? "Current store" : selected.businessType}
      onClose={() => setSelectedId(null)}
      actions={
        <>
          {selected.id !== activeTenant?.id ? (
            <Button onClick={() => handleSwitchTenant(selected.id)}>Switch to this store</Button>
          ) : null}
          <Button variant="secondary" onClick={() => setTarget(selected)}>Edit</Button>
          <Button variant="ghost" className="text-destructive" onClick={() => setDeleting({ stores: [selected] })}>Delete</Button>
        </>
      }
    >
      <Fields
        rows={[
          ["ID", <span key="id" className="break-all font-mono text-xs">{selected.id}</span>],
          ["Business", selected.businessType],
          ["Currency", selected.currency],
          ["Sales tax", pct(selected.taxRate)],
          ["Products", statsOf(selected.id).products],
          ["Sales recorded", statsOf(selected.id).sales],
          ["Cashiers", cashiers ? statsOf(selected.id).cashiers : "—"],
          ["Created", new Date(selected.createdAt).toLocaleDateString()],
        ]}
      />
    </DetailPanel>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SplitView panel={panel}>
        <div className="hidden shrink-0 grid-cols-3 gap-3 sm:grid">
          <StatTile label="Stores" value={tenants.length} />
          <StatTile label="Products" value={products.length} />
          <StatTile label="Cashiers" value={cashiers ? cashiers.length : "—"} />
        </div>
        <FilterBar active={filtersActive} actions={<Button onClick={() => setTarget("new")}>Add store</Button>}>
          <SearchBox value={query} onChange={setQuery} placeholder="Search store name, business…" />
          <FilterSelect label="Business" value={business} onChange={setBusiness} options={[{ value: "all", label: "All businesses" }, ...businesses.map((b) => ({ value: b, label: b }))]} />
          <FilterSelect label="Currency" value={currency} onChange={setCurrency} options={[{ value: "all", label: "All currencies" }, ...currencies.map((c) => ({ value: c, label: c }))]} />
          <ViewBySelect value={view} onChange={setView} />
          {filtersActive ? <ResetFiltersButton onClick={resetFilters} /> : null}
        </FilterBar>
        {error ? (
          <p role="alert" className="shrink-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(t) => t.id}
          view={view}
          cardValue="products"
          onRowClick={(t, checked) => setSelectedId((current) => (checked ? t.id : current === t.id ? null : current))}
          selectedKey={selectedId}
          bulkActions={(chosen, clear) => (
            <>
              <ExportButton
                filename="stores.csv"
                headers={["ID", "Name", "Business", "Currency", "Sales tax %", "Products", "Sales", "Created"]}
                rows={chosen.map((t) => [t.id, t.name, t.businessType, t.currency, +(t.taxRate * 100).toFixed(2), statsOf(t.id).products, statsOf(t.id).sales, t.createdAt])}
              />
              <Button size="sm" variant="secondary" className="text-destructive" onClick={() => setDeleting({ stores: chosen, after: clear })}>
                Delete
              </Button>
            </>
          )}
          resetKey={`${query}|${business}|${currency}`}
          empty="Nothing matches those filters."
        />
      </SplitView>
      <StoreDialog target={target} onClose={() => setTarget(null)} />
      <DeleteStoresDialog
        stores={deleting?.stores ?? null}
        sales={deleting?.stores.reduce((sum, t) => sum + statsOf(t.id).sales, 0) ?? 0}
        accounts={deleting?.stores.reduce((sum, t) => sum + statsOf(t.id).cashiers, 0) ?? 0}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
