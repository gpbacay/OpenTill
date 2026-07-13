import React, { useState, useMemo } from "react";
import { Product, Tenant } from "../types";
import { Plus, Trash2, Edit, AlertCircle, RefreshCw, BarChart2, Check, Package } from "lucide-react";

interface ProductsManagerProps {
  products: Product[];
  activeTenant: Tenant;
  onAddProduct: (newProduct: Product) => void;
  onUpdateProduct: (updatedProduct: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

export function ProductsManager({
  products,
  activeTenant,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}: ProductsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const tenantProducts = useMemo(() => {
    return products.filter((p) => p.tenantId === activeTenant.id);
  }, [products, activeTenant.id]);

  const resetForm = () => {
    setName("");
    setCategory("");
    setSku("");
    setPrice("");
    setStock("");
    setDescription("");
    setEditingId(null);
    setError("");
  };

  const handleEditClick = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setCategory(p.category);
    setSku(p.sku);
    setPrice(p.price.toString());
    setStock(p.stock.toString());
    setDescription(p.description || "");
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !category || !sku || !price || !stock) {
      setError("Please fill out all required fields.");
      return;
    }

    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock, 10);

    if (isNaN(priceNum) || priceNum < 0) {
      setError("Please enter a valid price (>= 0).");
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      setError("Please enter a valid stock level (>= 0).");
      return;
    }

    // Check SKU duplication for other products within the same tenant
    const existingSku = tenantProducts.find(
      (p) => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== editingId
    );
    if (existingSku) {
      setError(`SKU "${sku}" is already in use by another product in this store.`);
      return;
    }

    if (editingId) {
      const updated: Product = {
        id: editingId,
        tenantId: activeTenant.id,
        name,
        category,
        sku: sku.toUpperCase(),
        price: priceNum,
        stock: stockNum,
        description,
      };
      onUpdateProduct(updated);
    } else {
      const created: Product = {
        id: "prod-" + Date.now(),
        tenantId: activeTenant.id,
        name,
        category,
        sku: sku.toUpperCase(),
        price: priceNum,
        stock: stockNum,
        description,
      };
      onAddProduct(created);
    }

    resetForm();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 h-full bg-transparent overflow-y-auto lg:overflow-hidden pr-0.5 pb-10 lg:pb-0">
      {/* Products list table */}
      <div className="lg:col-span-2 flex flex-col h-[400px] lg:h-full bg-[#024959]/10 rounded-xl border border-[#024959] p-3 overflow-hidden shadow-md">
        <div className="flex justify-between items-center mb-2.5">
          <div>
            <h4 className="text-[10px] font-mono text-[#89D9C2] uppercase tracking-wider">Inventory Catalog</h4>
            <p className="text-[9px] text-slate-400">
              Active inventory list of <span className="text-white font-semibold">{activeTenant.name}</span>
            </p>
          </div>
          <div className="bg-[#208C8C]/15 border border-[#208C8C]/30 px-2 py-0.5 rounded text-[9px] font-mono text-[#89D9C2]">
            Total SKU: {tenantProducts.length}
          </div>
        </div>

        {/* Inventory list viewport */}
        <div className="flex-1 overflow-y-auto pr-0.5">
          {tenantProducts.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-5 bg-[#024959]/5 rounded-lg border border-dashed border-[#024959]">
              <Package className="w-6 h-6 text-[#024959] mb-1.5" />
              <p className="text-[10px] text-slate-400 font-mono">No products in inventory.</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Use the entry form to add your first store SKU.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {tenantProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock < 5;
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-lg transition-all gap-2 shadow-sm ${
                      isOutOfStock
                        ? "bg-[#0D0D0D]/20 border border-red-950/20 opacity-60"
                        : isLowStock
                        ? "bg-amber-950/10 border border-amber-500/40 hover:bg-amber-950/20 hover:border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.05)]"
                        : "bg-[#0D0D0D]/45 hover:bg-[#024959]/10 border border-[#024959] hover:shadow-[0_0_8px_rgba(32,140,140,0.05)]"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-white">{p.name}</span>
                        <span className="text-[8px] font-mono bg-[#208C8C]/15 text-[#89D9C2] px-1 py-0.2 rounded border border-[#208C8C]/10">
                          {p.category}
                        </span>
                        {isLowStock && (
                          <span className="inline-flex items-center gap-0.5 text-[7.5px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded border border-amber-400/20">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            LOW STOCK
                          </span>
                        )}
                        {isOutOfStock && (
                          <span className="inline-flex items-center gap-0.5 text-[7.5px] font-mono font-bold text-red-400 bg-red-400/10 px-1 py-0.2 rounded border border-red-400/20">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            OUT OF STOCK
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[8.5px] font-mono text-slate-400">
                        <span>SKU: <span className="text-[#89D9C2]">{p.sku}</span></span>
                        <span>•</span>
                        <span>Price: <span className="text-white">{activeTenant.currency === "EUR" ? "€" : activeTenant.currency === "PHP" ? "₱" : "$"} {p.price.toFixed(2)}</span></span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          QTY:{" "}
                          <span
                            className={`font-semibold ${
                              isOutOfStock
                                ? "text-red-400 font-bold"
                                : isLowStock
                                ? "text-amber-400 font-bold"
                                : "text-[#89D9C2]"
                            }`}
                          >
                            {p.stock}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleEditClick(p)}
                        className="p-1 bg-[#208C8C]/10 hover:bg-[#208C8C]/20 text-[#89D9C2] border border-[#208C8C]/20 rounded transition-colors"
                        title="Edit details"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteProduct(p.id)}
                        className="p-1 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/20 rounded transition-colors"
                        title="Delete SKU"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Editor/Add Form panel */}
      <div className="flex flex-col bg-[#024959]/10 rounded-xl border border-[#024959] p-3 shadow-md">
        <h4 className="text-[10px] font-mono text-[#89D9C2] uppercase tracking-wider mb-0.5">
          {editingId ? "Edit SKU Entry" : "Create New Product"}
        </h4>
        <p className="text-[9px] text-slate-400 mb-3 font-mono">
          Isolated per active store environment.
        </p>

        <form onSubmit={handleSubmit} className="space-y-2.5 flex-1 flex flex-col justify-between">
          <div className="space-y-2.5">
            {error && (
              <div className="p-1.5 bg-red-950/40 border border-red-900/40 rounded flex items-start gap-1 text-[8px] text-red-200">
                <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                <p className="leading-tight">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Product Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lavender Matcha Latte"
                className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Beverages"
                  className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C]"
                />
              </div>

              <div>
                <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  SKU Code *
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. LAV-MTC-03"
                  className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C] font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Price ({activeTenant.currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C] font-mono"
                />
              </div>

              <div>
                <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Stock Units *
                </label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product snapshot detail or notes..."
                rows={2}
                className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C] resize-none"
              />
            </div>
          </div>

          <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-[#024959]/40">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-[#0D0D0D] hover:bg-[#0D0D0D]/80 border border-[#024959] text-slate-400 py-1.5 rounded-lg text-[10px] font-mono transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-[2] bg-[#208C8C] hover:bg-[#208C8C]/85 text-[#010326] font-bold py-1.5 rounded-lg text-[10px] font-mono transition-all uppercase tracking-widest flex items-center justify-center gap-1 border border-[#89D9C2]/20"
            >
              <Plus className="w-3 h-3" />
              {editingId ? "Save SKU" : "Register Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
