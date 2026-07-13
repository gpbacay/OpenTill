"use client";

import React, { useState, useMemo } from "react";
import { Product, Tenant } from "@/lib/types";
import { Search, Plus, Tag, AlertCircle, ShoppingBag, QrCode, Keyboard, CheckCircle } from "lucide-react";

interface RegisterCatalogProps {
  products: Product[];
  activeTenant: Tenant;
  onAddToCart: (product: Product) => void;
}

export function RegisterCatalog({ products, activeTenant, onAddToCart }: RegisterCatalogProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanSuccess, setScanSuccess] = useState("");

  // Filter products belonging to current active tenant
  const tenantProducts = useMemo(() => {
    return products.filter((p) => p.tenantId === activeTenant.id);
  }, [products, activeTenant.id]);

  // Extract categories
  const categories = useMemo(() => {
    const list = new Set<string>();
    tenantProducts.forEach((p) => {
      if (p.category) list.add(p.category);
    });
    return ["All", ...Array.from(list)];
  }, [tenantProducts]);

  // Filter by search query and category
  const filteredProducts = useMemo(() => {
    return tenantProducts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === "All" || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [tenantProducts, search, selectedCategory]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matchedProduct = tenantProducts.find(
      (p) => p.sku.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (matchedProduct) {
      if (matchedProduct.stock <= 0) {
        setScanError(`SKU "${matchedProduct.sku}" is Out of Stock!`);
        setScanSuccess("");
      } else {
        onAddToCart(matchedProduct);
        setScanSuccess(`Scanned & Added: ${matchedProduct.name}`);
        setScanError("");
        setBarcodeInput("");
        setTimeout(() => setScanSuccess(""), 2000);
      }
    } else {
      setScanError(`No product found with SKU "${barcodeInput}"`);
      setScanSuccess("");
      setTimeout(() => setScanError(""), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#024959]/10 rounded-xl border border-[#024959] p-3 overflow-hidden">
      {/* Search & Scanner Row */}
      <div className="space-y-2 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Text Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#89D9C2]/60" />
            <input
              type="text"
              placeholder="Search by product or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg py-1.5 pl-8 pr-3 text-xs font-mono text-white placeholder-[#89D9C2]/30 focus:outline-none focus:border-[#208C8C] transition-colors"
            />
          </div>

          {/* Simulated Barcode Scanner */}
          <form onSubmit={handleBarcodeSubmit} className="relative flex gap-1">
            <div className="relative flex-1">
              <QrCode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#89D9C2]/60" />
              <input
                type="text"
                placeholder="Simulate Laser SKU Scan..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg py-1.5 pl-8 pr-3 text-xs font-mono text-white placeholder-[#89D9C2]/30 focus:outline-none focus:border-[#208C8C]"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 bg-[#208C8C]/20 border border-[#208C8C]/50 hover:bg-[#208C8C]/40 text-[#89D9C2] rounded-lg text-[10px] font-mono transition-all font-bold"
            >
              SCAN
            </button>
          </form>
        </div>

        {/* Scan Status Feedback Indicators */}
        {scanSuccess && (
          <div className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30 flex items-center gap-1.5 animate-pulse">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            {scanSuccess}
          </div>
        )}
        {scanError && (
          <div className="text-[9px] font-mono text-red-400 bg-red-950/20 px-2 py-0.5 rounded border border-red-900/30 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-red-400" />
            {scanError}
          </div>
        )}

        {/* Categories Chips */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none pt-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-all duration-150 shrink-0 ${
                selectedCategory === cat
                  ? "bg-[#208C8C]/25 text-white border border-[#89D9C2]/30 shadow-[0_0_8px_rgba(137,217,194,0.15)] font-bold"
                  : "bg-[#024959]/20 text-[#89D9C2] hover:bg-[#024959]/45 border border-[#024959]/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="flex-1 overflow-y-auto pr-0.5">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-5 bg-[#024959]/5 rounded-lg border border-dashed border-[#024959] min-h-[220px]">
            <ShoppingBag className="w-7 h-7 text-[#024959] mb-1.5 stroke-[1.5]" />
            <p className="text-xs text-[#89D9C2]/70 font-mono">No products available</p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {search || selectedCategory !== "All"
                ? "Try resetting your search query or filters."
                : "Go to the 'Manage Products' tab to add items."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
            {filteredProducts.map((prod) => {
              const isOutOfStock = prod.stock <= 0;
              const isLowStock = prod.stock > 0 && prod.stock < 5;
              return (
                <div
                  key={prod.id}
                  onClick={() => !isOutOfStock && onAddToCart(prod)}
                  className={`group relative flex flex-col justify-between rounded-lg p-2.5 transition-all duration-150 ${
                    isOutOfStock
                      ? "bg-[#0D0D0D]/40 border border-red-950/20 opacity-50 cursor-not-allowed"
                      : isLowStock
                      ? "bg-amber-950/10 border border-amber-500/40 hover:border-amber-400 hover:bg-amber-950/20 cursor-pointer shadow-sm hover:shadow-[0_0_10px_rgba(245,158,11,0.15)]"
                      : "bg-[#0D0D0D]/40 hover:bg-[#024959]/10 border border-[#024959] hover:border-[#89D9C2]/45 cursor-pointer shadow-sm hover:shadow-[0_0_10px_rgba(32,140,140,0.1)]"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-white group-hover:text-[#89D9C2] transition-colors leading-snug">
                          {prod.name}
                        </span>
                        {isLowStock && (
                          <span className="inline-flex items-center gap-0.5 text-[7.5px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded border border-amber-400/20 w-fit">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            LOW STOCK
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono bg-[#208C8C]/10 text-[#89D9C2] px-1 py-0.2 rounded border border-[#208C8C]/15 shrink-0">
                        {activeTenant.currency === "EUR" ? "€" : activeTenant.currency === "PHP" ? "₱" : "$"}
                        {prod.price.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 line-clamp-2 min-h-[26px] leading-relaxed">
                      {prod.description || "No SKU description entered."}
                    </p>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-[#024959]/30 flex items-center justify-between text-[8px] font-mono">
                    <span className="text-[#89D9C2]/60 flex items-center gap-0.5">
                      <Tag className="w-2.5 h-2.5" />
                      {prod.sku}
                    </span>
                    <span
                      className={`font-semibold flex items-center gap-0.5 ${
                        isOutOfStock
                          ? "text-red-400"
                          : isLowStock
                          ? "text-amber-400 font-bold"
                          : "text-slate-400"
                      }`}
                    >
                      {isOutOfStock ? (
                        "OUT_OF_STOCK"
                      ) : (
                        <>
                          {isLowStock && <AlertCircle className="w-2.5 h-2.5 text-amber-400 animate-pulse" />}
                          QTY: {prod.stock}
                        </>
                      )}
                    </span>
                  </div>

                  {/* Add feedback on hover */}
                  {!isOutOfStock && (
                    <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#208C8C]/80 text-[#010326] p-0.5 rounded">
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Quick-Ref Bar */}
      <div className="mt-2 pt-2 border-t border-[#024959]/40 flex flex-wrap items-center justify-between text-[8px] font-mono text-slate-400 gap-1 select-none">
        <span className="flex items-center gap-1">
          <Keyboard className="w-3 h-3 text-[#89D9C2]" />
          <span>OPERATOR SHORTCUTS:</span>
        </span>
        <div className="flex gap-2">
          <span><kbd className="bg-[#0D0D0D] border border-[#024959] px-1 py-0.2 rounded text-[#89D9C2]">F2</kbd> Focus Search</span>
          <span><kbd className="bg-[#0D0D0D] border border-[#024959] px-1 py-0.2 rounded text-[#89D9C2]">F4</kbd> Hold Cart</span>
          <span><kbd className="bg-[#0D0D0D] border border-[#024959] px-1 py-0.2 rounded text-[#89D9C2]">F8</kbd> Checkout</span>
          <span><kbd className="bg-[#0D0D0D] border border-[#024959] px-1 py-0.2 rounded text-[#89D9C2]">ESC</kbd> Clear Cart</span>
        </div>
      </div>
    </div>
  );
}
