"use client";

import { useMemo, useState } from "react";
import { Product, Tenant } from "@/lib/types";
import { money } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const tenantProducts = useMemo(
    () => products.filter((product) => product.tenantId === activeTenant.id),
    [products, activeTenant.id]
  );

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

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setCategory(product.category);
    setSku(product.sku);
    setPrice(product.price.toString());
    setStock(product.stock.toString());
    setDescription(product.description || "");
    setError("");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock, 10);
    if (!name.trim() || !category.trim() || !sku.trim()) {
      setError("Name, category, and SKU are required.");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0 || Number.isNaN(stockNum) || stockNum < 0) {
      setError("Price and stock need to be zero or more.");
      return;
    }
    const duplicate = tenantProducts.find(
      (product) => product.sku.toLowerCase() === sku.trim().toLowerCase() && product.id !== editingId
    );
    if (duplicate) {
      setError(`SKU ${sku.trim()} is already used.`);
      return;
    }

    const next: Product = {
      id: editingId ?? `prod-${Date.now()}`,
      tenantId: activeTenant.id,
      name: name.trim(),
      category: category.trim(),
      sku: sku.trim().toUpperCase(),
      price: priceNum,
      stock: stockNum,
      description: description.trim(),
    };
    if (editingId) onUpdateProduct(next);
    else onAddProduct(next);
    resetForm();
  };

  return (
    <div className="grid h-full gap-4 overflow-y-auto lg:grid-cols-3 lg:overflow-hidden">
      <Card className="border-0 shadow-none lg:col-span-2 lg:overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">{tenantProducts.length} products</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 lg:h-[calc(100%-4rem)]">
          <ScrollArea className="h-full">
            {tenantProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products yet.</p>
            ) : (
              <ul>
                {tenantProducts.map((product) => (
                  <li key={product.id} className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku} {product.category}
                        {product.stock === 0
                          ? "  Out of stock"
                          : product.stock < 5
                            ? `  ${product.stock} left`
                            : `  ${product.stock} in stock`}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums">{money(activeTenant.currency, product.price)}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(product)}>
                      Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onDeleteProduct(product.id)}>
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Edit product" : "New product"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="space-y-1">
              <Label htmlFor="product-name">Name</Label>
              <Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="product-category">Category</Label>
                <Input id="product-category" value={category} onChange={(event) => setCategory(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-sku">SKU</Label>
                <Input id="product-sku" value={sku} onChange={(event) => setSku(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="product-price">Price</Label>
                <Input id="product-price" type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-stock">Stock</Label>
                <Input id="product-stock" type="number" min={0} value={stock} onChange={(event) => setStock(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="product-description">Description</Label>
              <Textarea id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </div>
            <div className="flex gap-2">
              {editingId ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" className="flex-1">
                {editingId ? "Save changes" : "Add product"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
