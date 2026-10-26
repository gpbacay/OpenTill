"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { QrCodeScanIcon } from "@hugeicons/core-free-icons";
import { Product, Tenant, reorderLevel } from "@/lib/types";
import { money } from "@/lib/money";
import { productIdFromScan } from "@/lib/scan";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QrScanDialog } from "@/components/QrScanDialog";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { customColumnDefs } from "@/components/data-table/custom-columns";
import { useOps } from "@/contexts/ops-context";
import { FilterBar, FilterSelects, brandFilter, passesFilters, type RowFilter, ResetFiltersButton, ViewBySelect, GroupBySelect, useGroupBy, useFilter, useViewMode } from "@/components/data-table/controls";

interface RegisterCatalogProps {
  products: Product[];
  activeTenant: Tenant;
  onAddToSale: (product: Product) => void;
  /** A scan that added a product: the sale is where the cashier pays. */
  onScanned: () => void;
}

export function RegisterCatalog({ products, activeTenant, onAddToSale, onScanned }: RegisterCatalogProps) {
  const [search, setSearch] = useFilter("register_query", "");
  const [selectedCategory, setSelectedCategory] = useFilter("register_category", "all");
  const [view, setView] = useViewMode("register", "cards");
  const [groupBy, setGroupBy] = useGroupBy("register");
  const [brand, setBrand] = useFilter("register_brand", "all");
  // toLowerCase: the category was saved as "All" before.
  const filtersOn = selectedCategory.toLowerCase() !== "all" || brand !== "all";
  const [message, setMessage] = useState("");
  const [scanning, setScanning] = useState(false);
  const { columnsFor } = useOps();

  const tenantProducts = useMemo(
    () => products.filter((product) => product.tenantId === activeTenant.id),
    [products, activeTenant.id]
  );

  const categories = useMemo(() => {
    const list = new Set(tenantProducts.map((product) => product.category).filter(Boolean));
    return [...list];
  }, [tenantProducts]);

  const filters: RowFilter<Product>[] = [
    {
      id: "category",
      label: "Category",
      value: selectedCategory,
      onChange: (value) => {
        setSelectedCategory(value);
        setMessage("");
      },
      options: [{ value: "all", label: "All categories" }, ...categories.map((category) => ({ value: category, label: category }))],
      test: (product, value) => product.category === value,
    },
    brandFilter(tenantProducts, brand, (value) => {
      setBrand(value);
      setMessage("");
    }),
  ];

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tenantProducts.filter((product) => {
      const matchesQuery =
        !query ||
        product.id.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query) ||
        (product.brand ?? "").toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        Object.values(product.custom ?? {}).some((value) => value.toLowerCase().includes(query));
      const matchesCategory = passesFilters(product, filters);
      return matchesQuery && matchesCategory;
    });
  }, [tenantProducts, search, selectedCategory, brand]);

  const query = search.trim().toLowerCase();
  const match = useMemo(() => {
    if (!query) return null;
    return tenantProducts.find((product) => product.sku.toLowerCase() === query) ?? (filteredProducts.length === 1 ? filteredProducts[0] : null);
  }, [filteredProducts, query, tenantProducts]);

  const addProduct = (product: Product | undefined, missing: string) => {
    if (!product) {
      setMessage(missing);
      return { status: missing, close: false };
    }
    if (product.stock <= 0) {
      const out = `${product.name} is out of stock.`;
      setMessage(out);
      return { status: out, close: false };
    }
    onAddToSale(product);
    setSearch("");
    const added = `Added ${product.name} to the sale.`;
    setMessage(added);
    return { status: added, close: true };
  };

  const addFromScan = (raw: string) => {
    const id = productIdFromScan(raw);
    if (!id) {
      const bad = "That code isn't a product QR.";
      setMessage(bad);
      return { status: bad, close: false };
    }
    const result = addProduct(
      tenantProducts.find((product) => product.id === id),
      "No product matches that code."
    );
    // One scan, one unit, then the sale. The camera stops so a held QR can't add it again.
    if (result.close) {
      setScanning(false);
      onScanned();
    }
    return result;
  };

  const addMatch = (event: React.FormEvent) => {
    event.preventDefault();
    if (productIdFromScan(search)) {
      addFromScan(search);
      return;
    }
    if (!query) {
      setMessage("Type a product name or scan a product QR.");
      return;
    }
    if (!match) {
      setMessage(filteredProducts.length > 1 ? "More than one product matches. Choose one from the list." : "No product matches.");
      return;
    }
    addProduct(match, "No product matches.");
  };

  const columns: Column<Product>[] = [
    { id: "category", header: "Category", cell: (product) => product.category || "—" },
    {
      id: "name",
      header: "Name",
      groupable: false,
      cell: (product) => <span className="font-medium">{product.name}</span>,
    },
    { id: "brand", header: "Brand", cell: (product) => product.brand || "—" },
    {
      id: "sku",
      header: "SKU",
      cell: (product) => <span className="text-xs text-muted-foreground">{product.sku}</span>,
    },
    {
      id: "stock",
      header: "Available",
      align: "right",
      cell: (product) => {
        if (product.stock <= 0) return <span className="text-destructive">Out of stock</span>;
        const low = product.stock <= reorderLevel(product);
        return <span className={low ? "text-amber-400" : ""}>{product.stock}</span>;
      },
    },
    {
      id: "price",
      header: "Price",
      align: "right",
      cell: (product) => money(activeTenant.currency, product.price),
    },
    ...customColumnDefs<Product>(columnsFor("products")),
  ];

  const addSelected = (selected: Product[], clear: () => void) => {
    selected.forEach(onAddToSale);
    clear();
    setMessage(
      `Added ${selected.length} ${selected.length === 1 ? "product" : "products"} to the sale.`
    );
  };

  const filtersActive = search.trim() !== "" || filtersOn;
  const resetFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setBrand("all");
    setMessage("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <FilterBar
        label="Filters"
        active={filtersOn}
        leading={
          <form onSubmit={addMatch} className="flex min-w-0 flex-1 gap-2">
            <Input
              data-register-action="product-search"
              className="min-w-0 flex-1"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setMessage("");
              }}
              placeholder="Search or scan a product QR"
              aria-label="Search or scan a product QR"
            />
            <Button type="button" variant="outline" size="icon" aria-label="Scan product QR" title="Scan product QR" onClick={() => setScanning(true)}>
              <HugeiconsIcon icon={QrCodeScanIcon} size={16} />
            </Button>
          </form>
        }
      >
        <FilterSelects filters={filters} />
        <ViewBySelect value={view} onChange={setView} />
        <GroupBySelect columns={columns} value={groupBy} onChange={setGroupBy} />
        {filtersActive ? <ResetFiltersButton onClick={resetFilters} /> : null}
      </FilterBar>
      {match && match.stock <= 0 ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">{match.name} is out of stock.</p>
      ) : message ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">{message}</p>
      ) : null}

      <DataTable
        rows={filteredProducts}
        columns={columns}
          groupBy={groupBy}
          rowFilters={filters}
        rowKey={(product) => product.id}
        view={view}
        cardTitle="name"
        cardValue="price"
        columnOrderKey="register"
        image={(product) => product.image}
        isRowDisabled={(product) => product.stock <= 0}
        resetKey={`${activeTenant.id}|${search}|${selectedCategory}|${brand}`}
        bulkActions={(selected, clear) => (
          <Button size="sm" onClick={() => addSelected(selected, clear)}>
            Add {selected.length} to sale
          </Button>
        )}
        empty={
          tenantProducts.length === 0 ? (
            <>
              No products yet.{" "}
              <Link href="/inventory" className="text-foreground underline-offset-4 hover:underline">
                Add one
              </Link>
            </>
          ) : (
            "Nothing matches those filters."
          )
        }
      />

      <p className="hidden text-xs text-muted-foreground lg:block">
        F2 search, F4 hold, F8 charge, Esc clear
      </p>
      {scanning ? <QrScanDialog onClose={() => setScanning(false)} onCode={addFromScan} /> : null}
    </div>
  );
}
