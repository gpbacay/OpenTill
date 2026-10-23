"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { uid } from "@/lib/ids";
import { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomFieldInputs } from "@/components/data-table/custom-columns";
import { ImagePicker } from "@/components/ImagePicker";
import { FieldError, check, clearError, invalid } from "@/components/FieldError";
import { collect, maxLength, numberError, required, type FieldErrors } from "@/lib/validation";

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
  const [skuHelp, setSkuHelp] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [image, setImage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const editing = target && target !== "new" ? target : null;

  useEffect(() => {
    if (!target) return;
    setErrors({});
    if (target === "new") {
      setForm(blank);
      setCustom({});
      setImage("");
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
    setImage(target.image ?? "");
  }, [target]);

  if (!activeTenant) return null;
  const set = (field: keyof typeof blank) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    clearError(setErrors, event.target.id);
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };
  const categories = [...new Set(products.filter((p) => p.tenantId === activeTenant.id).map((p) => p.category))].sort();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const sku = form.sku.trim();
    const clash = products.find(
      (p) => p.tenantId === activeTenant.id && p.sku.toLowerCase() === sku.toLowerCase() && p.id !== editing?.id
    );
    const ok = check(
      collect({
        "p-name": required(form.name, "Enter the product name.") ?? maxLength(form.name, 80, "Name"),
        "p-sku":
          required(sku, "Enter a SKU.") ??
          (/\s/.test(sku) ? "A SKU can't contain spaces." : clash ? `${sku.toUpperCase()} is already used by ${clash.name}.` : undefined),
        "p-category": required(form.category, "Pick or type a category.") ?? maxLength(form.category, 40, "Category"),
        "p-cost": numberError(form.costPrice, "the cost", { min: 0 }),
        "p-price": numberError(form.price, "the selling price", { required: true, min: 0 }),
        "p-stock": editing ? undefined : numberError(form.stock, "starting stock", { min: 0, integer: true }),
        "p-reorder": numberError(form.reorderLevel, "the warning level", { min: 0, integer: true }),
      }),
      setErrors
    );
    if (!ok) return;
    const price = parseFloat(form.price);
    const costPrice = parseFloat(form.costPrice || "0");
    const stock = parseInt(form.stock || "0", 10);
    const reorderLevel = parseInt(form.reorderLevel || "0", 10);

    const next: Product = {
      id: editing?.id ?? uid("prod"),
      tenantId: activeTenant.id,
      name: form.name.trim(),
      sku: sku.toUpperCase(),
      category: form.category.trim(),
      supplierId: form.supplierId || null,
      costPrice,
      price,
      reorderLevel,
      description: form.description.trim(),
      stock: editing?.stock ?? 0,
      custom,
      image,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          {/* ponytail: photos live inline on the product (~20 KB each, cached in localStorage); move to file storage if catalogs get large. */}
          <ImagePicker label="Product photo (optional)" value={image} onChange={setImage} max={320} />
          <div className="space-y-1">
            <Label htmlFor="p-name" required>Name</Label>
            <Input id="p-name" {...invalid(errors, "p-name")} value={form.name} onChange={set("name")} autoFocus />
            <FieldError errors={errors} id="p-name" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="p-sku" required>SKU</Label>
                {/* Controlled so a tap opens it on phones, where there is no hover. */}
                <Tooltip open={skuHelp} onOpenChange={setSkuHelp}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="What is a SKU?"
                      className="-m-1 rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() => setSkuHelp((open) => !open)}
                      onBlur={() => setSkuHelp(false)}
                    >
                      <HugeiconsIcon icon={InformationCircleIcon} size={14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="block">
                    SKU (Stock Keeping Unit) is a short, unique code you give each product, like COLA-500ML or BRK-PAD-01.
                    It tells similar items apart and makes them quick to find. No spaces, and no two products can share one.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input id="p-sku" {...invalid(errors, "p-sku")} value={form.sku} onChange={set("sku")} />
              <FieldError errors={errors} id="p-sku" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-category" required>Category</Label>
              <Input id="p-category" {...invalid(errors, "p-category")} list="p-categories" value={form.category} onChange={set("category")} />
              <FieldError errors={errors} id="p-category" />
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
              <NumberInput id="p-cost" {...invalid(errors, "p-cost")} value={form.costPrice} onChange={set("costPrice")} />
              <FieldError errors={errors} id="p-cost" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-price" required>Selling price</Label>
              <NumberInput id="p-price" {...invalid(errors, "p-price")} value={form.price} onChange={set("price")} />
              <FieldError errors={errors} id="p-price" />
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
                <NumberInput id="p-stock" {...invalid(errors, "p-stock")} decimals={false} value={form.stock} onChange={set("stock")} />
                <FieldError errors={errors} id="p-stock" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="p-reorder">Warn me at</Label>
              <NumberInput id="p-reorder" {...invalid(errors, "p-reorder")} decimals={false} value={form.reorderLevel} onChange={set("reorderLevel")} />
              <FieldError errors={errors} id="p-reorder" />
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
