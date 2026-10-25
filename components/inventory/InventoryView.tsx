"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ImageAdd01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { money } from "@/lib/money";
import { useSearchParams } from "next/navigation";
import { pickParam } from "@/lib/query";
import { Product, StockMovement, reorderLevel, stockState } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteButton, ExportButton } from "@/components/data-table/bulk";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { ToolbarButton, FilterSelects, brandFilter, passesFilters, type RowFilter, ResetFiltersButton, SearchBox, StatTile, FilterBar, ViewBySelect, GroupBySelect, useGroupBy, useFilter, matches, useViewMode } from "@/components/data-table/controls";
import { ColumnManager, customColumnDefs, customFieldRows, customText } from "@/components/data-table/custom-columns";
import { DetailPanel, Fields, PanelSection, SplitView } from "@/components/data-table/DetailPanel";
import { ProductDialog } from "./ProductDialog";
import { StockDialog, type StockAction } from "./StockDialog";
import { ProductQrCode } from "./ProductQrCode";
import { TablePageSkeleton } from "@/components/loading/PageSkeletons";

const STATUS_OPTIONS = [
  { value: "all", label: "All stock" },
  { value: "restock", label: "Needs restocking" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
  { value: "ok", label: "In stock" },
];

const byStockLevel = (p: Product, value: string) => (value === "restock" ? stockState(p) !== "ok" : stockState(p) === value);
const bySupplier = (row: { supplierId?: string | null }, value: string) => (row.supplierId ?? "") === (value === "none" ? "" : value);

const TYPE_OPTIONS = [
  { value: "all", label: "All changes" },
  { value: "RESTOCK", label: "Restocks" },
  { value: "SALE", label: "Sales" },
  { value: "ADJUSTMENT", label: "Adjustments" },
  { value: "OPENING", label: "Opening" },
];

const TYPE_LABEL: Record<string, string> = { RESTOCK: "Restock", SALE: "Sale", ADJUSTMENT: "Adjustment", OPENING: "Opening" };

export function InventoryView() {
  const { products, activeTenant, handleDeleteProduct } = usePos();
  const { suppliers, movements, columnsFor, ready } = useOps();
  const params = useSearchParams();
  const [tab, setTab] = useFilter<"stock" | "history">("inventory_tab", "stock");
  const [query, setQuery] = useFilter("inventory_query", "");
  const [category, setCategory] = useFilter("inventory_category", "all");
  const linkedStatus = params.get("status");
  const [status, setStatus] = useFilter("inventory_status", "all", linkedStatus ? pickParam(linkedStatus, STATUS_OPTIONS.map((o) => o.value), "all") : undefined);
  const [supplier, setSupplier] = useFilter("inventory_supplier", "all");
  const [brand, setBrand] = useFilter("inventory_brand", "all");
  const [type, setType] = useFilter("stock-history_type", "all");
  const [productTarget, setProductTarget] = useState<Product | "new" | null>(null);
  const [stockAction, setStockAction] = useState<StockAction | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stockView, setStockView] = useViewMode("inventory", "cards");
  const [historyView, setHistoryView] = useViewMode("stock-history", "table");
  const [stockGroup, setStockGroup] = useGroupBy("inventory");
  const [historyGroup, setHistoryGroup] = useGroupBy("stock-history");

  const tenantId = activeTenant?.id;
  const catalog = useMemo(() => products.filter((p) => p.tenantId === tenantId), [products, tenantId]);
  const currency = activeTenant?.currency ?? "PHP";
  const supplierName = (id?: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const customColumns = columnsFor("products");

  const categories = useMemo(() => [...new Set(catalog.map((p) => p.category))].sort(), [catalog]);
  const stats = useMemo(
    () => ({
      value: catalog.reduce((sum, p) => sum + Math.max(0, p.stock) * (p.costPrice ?? 0), 0),
      low: catalog.filter((p) => stockState(p) === "low").length,
      out: catalog.filter((p) => stockState(p) === "out").length,
    }),
    [catalog]
  );

  const stockFilters: RowFilter<Product>[] = [
    { id: "category", label: "Category", value: category, onChange: setCategory, options: [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))], test: (p, v) => p.category === v },
    brandFilter(catalog, brand, setBrand),
    { id: "status", label: "Stock level", value: status, onChange: setStatus, options: STATUS_OPTIONS, test: byStockLevel },
    {
      id: "supplier",
      label: "Supplier",
      value: supplier,
      onChange: setSupplier,
      options: [{ value: "all", label: "All suppliers" }, { value: "none", label: "No supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
      test: bySupplier,
    },
  ];
  const historyFilters: RowFilter<StockMovement>[] = [
    { id: "type", label: "Change type", value: type, onChange: setType, options: TYPE_OPTIONS, test: (m, v) => m.type === v },
  ];

  const stockRows = useMemo(
    () =>
      catalog
        .filter(
          (p) =>
            passesFilters(p, stockFilters) &&
            matches(query, p.id, p.name, p.brand, p.sku, p.category, supplierName(p.supplierId), customText(p))
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, category, brand, status, supplier, query, suppliers]
  );

  const historyRows = useMemo(
    () =>
      movements
        .filter((m) => passesFilters(m, historyFilters) && matches(query, m.id, m.productName, m.note, supplierName(m.supplierId)))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movements, type, query, suppliers]
  );

  const stockColumns: Column<Product>[] = [
    { id: "category", header: "Category", cell: (p) => p.category },
    {
      id: "name",
      header: "Product",
      groupable: false,
      cell: (p) => (
        <div className="min-w-40">
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-muted-foreground">{p.sku}</p>
        </div>
      ),
    },
    { id: "brand", header: "Brand", cell: (p) => p.brand || "—" },
    { id: "supplier", header: "Supplier", cell: (p) => supplierName(p.supplierId) },
    { id: "cost", header: "Cost", align: "right", cell: (p) => money(currency, p.costPrice ?? 0) },
    { id: "price", header: "Price", align: "right", cell: (p) => money(currency, p.price) },
    {
      id: "stock",
      header: "In stock",
      align: "right",
      cell: (p) => {
        const state = stockState(p);
        return (
          <span className="inline-flex items-center justify-end gap-2">
            {state === "out" ? <Badge variant="destructive">Out</Badge> : state === "low" ? <Badge variant="secondary" className="text-amber-400">Low</Badge> : null}
            {p.stock}
          </span>
        );
      },
    },
    ...customColumnDefs<Product>(customColumns),
  ];

  const historyColumns: Column<StockMovement>[] = [
    { id: "date", header: "Date", cell: (m) => <span className="whitespace-nowrap">{new Date(m.date).toLocaleString()}</span>, group: (m) => new Date(m.date).toLocaleDateString() },
    { id: "product", header: "Product", cell: (m) => m.productName },
    { id: "type", header: "Type", cell: (m) => <Badge variant="secondary">{TYPE_LABEL[m.type] ?? m.type}</Badge> },
    {
      id: "qty",
      header: "Change",
      align: "right",
      cell: (m) => <span className={m.quantity < 0 ? "text-amber-400" : "text-primary"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>,
    },
    { id: "cost", header: "Cost each", align: "right", cell: (m) => (m.unitCost ? money(currency, m.unitCost) : "—") },
    { id: "supplier", header: "Supplier", cell: (m) => supplierName(m.supplierId) },
    { id: "note", header: "Note", cell: (m) => m.note || "—" },
  ];

  if (!activeTenant) return null;
  const selected = catalog.find((p) => p.id === selectedId) ?? null;
  const recent = selected ? movements.filter((m) => m.productId === selected.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5) : [];
  const state = selected ? stockState(selected) : "ok";
  const margin = selected && selected.price > 0 ? Math.round(((selected.price - (selected.costPrice ?? 0)) / selected.price) * 100) : 0;
  const panel = selected ? (
    <DetailPanel
      title={selected.name}
      subtitle={selected.sku}
      onClose={() => setSelectedId(null)}
      actions={
        <>
          <Button onClick={() => setStockAction({ product: selected, mode: "restock" })}>Restock</Button>
          <Button variant="secondary" onClick={() => setStockAction({ product: selected, mode: "adjust" })}>
            Adjust
          </Button>
          <Button variant="secondary" onClick={() => setProductTarget(selected)}>
            Edit
          </Button>
        </>
      }
    >
      {selected.image ? (
        <img src={selected.image} alt={selected.name} className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => setProductTarget(selected)}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ImageAdd01Icon} size={28} />
          Add a photo
        </button>
      )}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{selected.stock}</span>
        <span className="text-sm text-muted-foreground">in stock</span>
        {state === "out" ? <Badge variant="destructive">Out</Badge> : state === "low" ? <Badge variant="secondary" className="text-amber-400">Low</Badge> : null}
      </div>
      <Fields
        rows={[
          ["ID", <span key="product-id" className="break-all font-mono text-xs">{selected.id}</span>],
          ["Category", selected.category],
          ["Brand", selected.brand || "—"],
          ["Supplier", supplierName(selected.supplierId)],
          ["Cost", money(currency, selected.costPrice ?? 0)],
          ["Price", `${money(currency, selected.price)} (${margin}% margin)`],
          ["Stock value", money(currency, Math.max(0, selected.stock) * (selected.costPrice ?? 0))],
          ["Warn me at", reorderLevel(selected)],
          ...customFieldRows(customColumns, selected.custom),
        ]}
      />
      {selected.description ? <p className="text-sm text-muted-foreground">{selected.description}</p> : null}
      <PanelSection title="Product QR code">
        <ProductQrCode product={selected} tenant={activeTenant} />
      </PanelSection>
      <PanelSection title="Recent stock changes">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {TYPE_LABEL[m.type] ?? m.type} · {new Date(m.date).toLocaleDateString()}
                </span>
                <span className={`tabular-nums ${m.quantity < 0 ? "text-amber-400" : "text-primary"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </DetailPanel>
  ) : null;
  if (!ready.suppliers || !ready.movements || !ready.columns) return <TablePageSkeleton stats={4} />;
  const filtered = tab === "stock" ? `${query}|${category}|${brand}|${status}|${supplier}` : `${query}|${type}`;
  const filtersActive = query.trim() !== "" || (tab === "stock" ? category !== "all" || brand !== "all" || status !== "all" || supplier !== "all" : type !== "all");
  const resetFilters = () => {
    setQuery("");
    setSelectedId(null);
    if (tab === "stock") {
      setCategory("all");
      setBrand("all");
      setStatus("all");
      setSupplier("all");
    } else {
      setType("all");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SplitView panel={selected && tab === "stock" ? panel : null}>
      <div className="hidden shrink-0 grid-cols-2 gap-3 sm:grid lg:grid-cols-4">
        <StatTile label="Products" value={catalog.length} />
        <StatTile label="Stock value (at cost)" value={money(currency, stats.value)} />
        <StatTile label="Running low" value={stats.low} />
        <StatTile label="Out of stock" value={stats.out} />
      </div>

      <FilterBar
        active={filtersActive}
        leading={
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "stock" | "history");
              setSelectedId(null);
            }}
          >
            <TabsList>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        actions={
          tab === "stock" ? (
            <>
              <ColumnManager table="products" />
              <ToolbarButton icon={PlusSignIcon} label="Add product" short="Add" onClick={() => setProductTarget("new")} />
            </>
          ) : null
        }
      >
        <SearchBox value={query} onChange={setQuery} placeholder={tab === "stock" ? "Search name, SKU, brand…" : "Search history"} />
        {tab === "stock" ? <FilterSelects filters={stockFilters} /> : <FilterSelects filters={historyFilters} />}
        <ViewBySelect value={tab === "stock" ? stockView : historyView} onChange={tab === "stock" ? setStockView : setHistoryView} />
        <GroupBySelect
          columns={tab === "stock" ? stockColumns : historyColumns}
          value={tab === "stock" ? stockGroup : historyGroup}
          onChange={tab === "stock" ? setStockGroup : setHistoryGroup}
        />
        {filtersActive ? <ResetFiltersButton onClick={resetFilters} /> : null}
      </FilterBar>

      {tab === "stock" ? (
        <DataTable
          rows={stockRows}
          columns={stockColumns}
          groupBy={stockGroup}
          rowFilters={stockFilters}
          rowKey={(p) => p.id}
          view={stockView}
          cardTitle="name"
          cardValue="price"
          columnOrderKey="inventory"
          image={(p) => p.image}
          onRowClick={(p, checked) => setSelectedId((current) => (checked ? p.id : current === p.id ? null : current))}
          selectedKey={selectedId}
          resetKey={filtered}
          bulkActions={(chosen, clear) => (
            <>
              <ExportButton
                filename="products.csv"
                headers={["ID", "Name", "Brand", "SKU", "Category", "Supplier", "Cost", "Price", "In stock", "Warn at", ...customColumns.map((c) => c.label)]}
                rows={chosen.map((p) => [p.id, p.name, p.brand ?? "", p.sku, p.category, supplierName(p.supplierId), p.costPrice ?? 0, p.price, p.stock, reorderLevel(p), ...customColumns.map((c) => p.custom?.[c.id] ?? "")])}
              />
              <DeleteButton
                count={chosen.length}
                noun="product"
                onConfirm={() => {
                  chosen.forEach((p) => handleDeleteProduct(p.id));
                  if (chosen.some((p) => p.id === selectedId)) setSelectedId(null);
                  clear();
                }}
              />
            </>
          )}
          empty={catalog.length === 0 ? "No products yet. Add your first one." : "Nothing matches those filters."}
        />
      ) : (
        <DataTable
          rows={historyRows}
          columns={historyColumns}
          groupBy={historyGroup}
          stateKey="stock-history"
          rowFilters={historyFilters}
          rowKey={(m) => m.id}
          view={historyView}
          cardValue="qty"
          resetKey={filtered}
          bulkActions={(chosen) => (
            <ExportButton
              filename="stock-history.csv"
              headers={["ID", "Date", "Product", "Type", "Change", "Cost each", "Supplier", "Note"]}
              rows={chosen.map((m) => [m.id, new Date(m.date).toLocaleString(), m.productName, TYPE_LABEL[m.type] ?? m.type, m.quantity, m.unitCost, supplierName(m.supplierId), m.note])}
            />
          )}
          empty="No stock changes yet."
        />
      )}

      </SplitView>

      <ProductDialog target={productTarget} onClose={() => setProductTarget(null)} />
      <StockDialog action={stockAction} onClose={() => setStockAction(null)} />
    </div>
  );
}
