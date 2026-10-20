"use client";

import { useEffect, useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { uid } from "@/lib/ids";
import { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomFieldInputs } from "@/components/data-table/custom-columns";

interface Props {
  /** null = closed, "new" = add form, Product = edit form */
  target: Product | "new" | null;
  onClose: () => void;
}

const blank = { name: "", sku: "", category: "", supplierId: "", costPrice: "", price: "", stock: "", reorderLevel: "5", description: "" };

export function ProductDialog({ target, onClose }: Props) {
  const { products, activeTenant, handleAddProduct, handleUpdateProduct, handleDeleteProduct } = usePos();
  const { suppliers, columnsFor, recordMovement } = useOps();
  const [form, setForm] = useState(blank);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const editing = target && target !== "new" ? target : null;

  useEffect(() => {
    if (!target) return;
    setError("");
    if (target === "new") {
      setForm(blank);
      setCustom({});
      return;
    }
    setForm({
      name: target.name,
      sku: target.sku,
      category: target.category,
      supplierId: target.supplierId ?? "",
      costPrice: String(target.costPrice ?? 0),
      price: String(target.price),
      stock: "",
      reorderLevel: String(target.reorderLevel ?? 5),
      description: target.description,
    });
    setCustom(target.custom ?? {});
  }, [target]);

  if (!activeTenant) return null;
  const set = (field: keyof typeof blank) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const categories = [...new Set(products.filter((p) => p.tenantId === activeTenant.id).map((p) => p.category))].sort();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const price = parseFloat(form.price);
    const costPrice = parseFloat(form.costPrice || "0");
    const stock = parseInt(form.stock || "0", 10);
    const reorderLevel = parseInt(form.reorderLevel || "0", 10);
    if (!form.name.trim() || !form.category.trim() || !form.sku.trim()) return setError("Name, category and SKU are required.");
    if ([price, costPrice, stock, reorderLevel].some((n) => Number.isNaN(n) || n < 0)) {
      return setError("Prices, stock and reorder level can't be negative.");
    }
    const clash = products.find(
      (p) => p.tenantId === activeTenant.id && p.sku.toLowerCase() === form.sku.trim().toLowerCase() && p.id !== editing?.id
    );
    if (clash) return setError(`SKU ${form.sku.trim()} is already used by ${clash.name}.`);

    const next: Product = {
      id: editing?.id ?? uid("prod"),
      tenantId: activeTenant.id,
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category.trim(),
      supplierId: form.supplierId || null,
      costPrice,
      price,
      reorderLevel,
      description: form.description.trim(),
      stock: editing?.stock ?? 0,
      custom,
    };
    if (editing) {
      handleUpdateProduct(next);
    } else {
      handleAddProduct(next);
      if (stock > 0) {
        recordMovement({
          id: uid("mov"),
          tenantId: activeTenant.id,
          productId: next.id,
          productName: next.name,
          type: "OPENING",
          quantity: stock,
          unitCost: costPrice || null,
          supplierId: next.supplierId ?? null,
          note: "Opening stock",
          date: new Date().toISOString(),
        });
      }
    }
    onClose();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-1">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={form.name} onChange={set("name")} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={form.sku} onChange={set("sku")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-category">Category</Label>
              <Input id="p-category" list="p-categories" value={form.category} onChange={set("category")} />
              <datalist id="p-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="p-cost">Cost</Label>
              <Input id="p-cost" type="number" min={0} step="0.01" value={form.costPrice} onChange={set("costPrice")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-price">Selling price</Label>
              <Input id="p-price" type="number" min={0} step="0.01" value={form.price} onChange={set("price")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {editing ? (
              <div className="space-y-1">
                <Label>In stock</Label>
                <p className="flex h-8 items-center text-sm text-muted-foreground">{editing.stock} · use Restock / Adjust</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="p-stock">Starting stock</Label>
                <Input id="p-stock" type="number" min={0} value={form.stock} onChange={set("stock")} />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="p-reorder">Warn me at</Label>
              <Input id="p-reorder" type="number" min={0} value={form.reorderLevel} onChange={set("reorderLevel")} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-supplier">Supplier</Label>
            <select id="p-supplier" value={form.supplierId} onChange={set("supplierId")} className="h-8 w-full rounded-lg bg-input px-2 text-sm">
              <option value="">None</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <CustomFieldInputs columns={columnsFor("products")} values={custom} onChange={setCustom} />
          <div className="space-y-1">
            <Label htmlFor="p-desc">Notes</Label>
            <Textarea id="p-desc" rows={2} value={form.description} onChange={set("description")} />
          </div>
          <DialogFooter>
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={() => {
                  if (window.confirm(`Delete ${editing.name}? Past sales keep their record.`)) {
                    handleDeleteProduct(editing.id);
                    onClose();
                  }
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button type="submit">{editing ? "Save changes" : "Add product"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
