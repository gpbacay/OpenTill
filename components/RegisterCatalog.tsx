"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Product, Tenant, reorderLevel } from "@/lib/types";
import { money } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RegisterCatalogProps {
  products: Product[];
  activeTenant: Tenant;
  onAddToCart: (product: Product) => void;
}

export function RegisterCatalog({ products, activeTenant, onAddToCart }: RegisterCatalogProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanMessage, setScanMessage] = useState("");

  const tenantProducts = useMemo(
    () => products.filter((product) => product.tenantId === activeTenant.id),
    [products, activeTenant.id]
  );

  const categories = useMemo(() => {
    const list = new Set(tenantProducts.map((product) => product.category).filter(Boolean));
    return ["All", ...list];
  }, [tenantProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tenantProducts.filter((product) => {
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        Object.values(product.custom ?? {}).some((value) => value.toLowerCase().includes(query));
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [tenantProducts, search, selectedCategory]);

  const handleBarcodeSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const sku = barcodeInput.trim().toLowerCase();
    if (!sku) return;
    const matched = tenantProducts.find((product) => product.sku.toLowerCase() === sku);
    if (!matched) {
      setScanMessage(`No product with SKU ${barcodeInput.trim()}`);
      return;
    }
    if (matched.stock <= 0) {
      setScanMessage(`${matched.name} is out of stock`);
      return;
    }
    onAddToCart(matched);
    setBarcodeInput("");
    setScanMessage(`Added ${matched.name}`);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product or SKU"
          aria-label="Search products"
        />
        <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
          <Input
            value={barcodeInput}
            onChange={(event) => setBarcodeInput(event.target.value)}
            placeholder="Scan SKU"
            aria-label="Scan SKU"
          />
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
      </div>
      {scanMessage ? <p className="text-sm text-muted-foreground">{scanMessage}</p> : null}

      <div className="flex gap-2 overflow-x-auto">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm ${
              selectedCategory === category
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {filteredProducts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {tenantProducts.length === 0 ? (
              <>
                No products yet.{" "}
                <Link href="/products" className="text-foreground underline-offset-4 hover:underline">
                  Add one
                </Link>
              </>
            ) : (
              "Nothing matches that search."
            )}
          </p>
        ) : (
          <ul>
            {filteredProducts.map((product) => {
              const out = product.stock <= 0;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => onAddToCart(product)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{product.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {product.sku}
                        {out ? "  Out of stock" : product.stock <= reorderLevel(product) ? `  ${product.stock} left` : ""}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">
                      {money(activeTenant.currency, product.price)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      <p className="hidden text-xs text-muted-foreground lg:block">
        F2 search, F4 hold, F8 charge, Esc clear
      </p>
    </div>
  );
}
