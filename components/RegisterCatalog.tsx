"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Product, Tenant, reorderLevel } from "@/lib/types";
import { money } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { customColumnDefs } from "@/components/data-table/custom-columns";
import { useOps } from "@/contexts/ops-context";
import { FilterBar, FilterSelects, passesFilters, type RowFilter, ResetFiltersButton, ViewBySelect, GroupBySelect, useGroupBy, useFilter, useViewMode } from "@/components/data-table/controls";

interface RegisterCatalogProps {
  products: Product[];
  activeTenant: Tenant;
  onAddToSale: (product: Product) => void;
}

export function RegisterCatalog({ products, activeTenant, onAddToSale }: RegisterCatalogProps) {
  const [search, setSearch] = useFilter("register_query", "");
  const [selectedCategory, setSelectedCategory] = useFilter("register_category", "all");
  // Saved before "all" was lowercase here.
  const categoryOn = selectedCategory.toLowerCase() !== "all";
  const [view, setView] = useViewMode("register", "cards");
  const [groupBy, setGroupBy] = useGroupBy("register");
  const [message, setMessage] = useState("");
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
  }, [tenantProducts, search, selectedCategory]);

  const query = search.trim().toLowerCase();
  const match = useMemo(() => {
    if (!query) return null;
    return tenantProducts.find((product) => product.sku.toLowerCase() === query) ?? (filteredProducts.length === 1 ? filteredProducts[0] : null);
  }, [filteredProducts, query, tenantProducts]);

  const addMatch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query) {
      setMessage("Type a product name or scan a SKU.");
      return;
    }
    if (!match) {
      setMessage(filteredProducts.length > 1 ? "More than one product matches. Choose one from the list." : "No product matches.");
      return;
    }
    if (match.stock <= 0) {
      setMessage(`${match.name} is out of stock.`);
      return;
    }
    onAddToSale(match);
    setSearch("");
    setMessage(`Added ${match.name} to the sale.`);
  };

  const columns: Column<Product>[] = [
    { id: "category", header: "Category", cell: (product) => product.category || "—" },
    {
      id: "name",
      header: "Product",
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

  const filtersActive = search.trim() !== "" || categoryOn;
  const resetFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setMessage("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <FilterBar
        label="Filters"
        active={categoryOn}
        leading={
          <form onSubmit={addMatch} className="min-w-0 flex-1">
            <Input
              data-register-action="product-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setMessage("");
              }}
              placeholder="Search or scan a SKU"
              aria-label="Search or scan a SKU"
            />
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
        resetKey={`${activeTenant.id}|${search}|${selectedCategory}`}
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
    </div>
  );
}
