"use client";

import { useEffect, useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { useAuth } from "@/contexts/auth-context";
import { canOpen } from "@/components/layout/Sidebar";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { FieldError, check, clearError, invalid } from "@/components/FieldError";
import { collect, numberError, type FieldErrors } from "@/lib/validation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type StockAction = { product: Product; mode: "restock" | "adjust" };

const REASONS = ["Count correction", "Damaged", "Lost / stolen", "Customer return", "Other"];

export function StockDialog({ action, onClose }: { action: StockAction | null; onClose: () => void }) {
  const { activeTenant } = usePos();
  const { suppliers, recordMovement, saveExpense } = useOps();
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  // A cashier given Inventory but not Expenses can't record spending.
  const canLogExpense = canOpen(useAuth().user, "/expenses");
  const [logExpense, setLogExpense] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!action) return;
    setQuantity("");
    setUnitCost(String(action.product.costPrice || ""));
    setSupplierId(action.product.supplierId ?? "");
    setReason(REASONS[0]);
    setNote("");
    setLogExpense(true);
    setErrors({});
  }, [action]);

  if (!action || !activeTenant) return <Dialog open={false} />;
  const { product, mode } = action;
  const qty = parseInt(quantity, 10);
  const cost = parseFloat(unitCost);
  const total = qty > 0 && cost > 0 ? qty * cost : 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const ok = check(
      collect({
        "s-qty":
          numberError(quantity, mode === "restock" ? "how many arrived" : "the change", { required: true, integer: true }) ??
          (qty === 0
            ? mode === "restock"
              ? "Enter how many arrived."
              : "Enter the change, like 3 or -2."
            : mode === "restock" && qty < 0
              ? "A restock can't be negative. Use Adjust to remove stock."
              : product.stock + qty < 0
                ? `Only ${product.stock} in stock, so you can't remove ${-qty}.`
                : undefined),
        "s-cost": mode === "restock" ? numberError(unitCost, "the cost", { min: 0 }) : undefined,
      }),
      setErrors
    );
    if (!ok) return;
    const now = new Date().toISOString();
    recordMovement({
      id: uid("mov"),
      tenantId: activeTenant.id,
      productId: product.id,
      productName: product.name,
      type: mode === "restock" ? "RESTOCK" : "ADJUSTMENT",
      quantity: qty,
      unitCost: mode === "restock" && cost > 0 ? cost : null,
      supplierId: mode === "restock" ? supplierId || null : null,
      note: mode === "restock" ? note.trim() : [reason, note.trim()].filter(Boolean).join(": "),
      date: now,
    });
    if (mode === "restock" && canLogExpense && logExpense && total > 0) {
      saveExpense({
        id: uid("exp"),
        tenantId: activeTenant.id,
        date: now,
        category: "Inventory",
        description: `Restock ${qty} × ${product.name}`,
        amount: total,
        paymentMethod: "CASH",
        supplierId: supplierId || null,
        createdAt: now,
      });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "restock" ? "Restock" : "Adjust stock"}: {product.name}</DialogTitle>
          <DialogDescription>Currently {product.stock} in stock.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="s-qty" required>{mode === "restock" ? "Quantity received" : "Change (+ adds, − removes)"}</Label>
            <NumberInput id="s-qty" {...invalid(errors, "s-qty")} decimals={false} negative={mode === "adjust"} value={quantity} onChange={(e) => {
              clearError(setErrors, "s-qty");
              setQuantity(e.target.value);
            }} autoFocus />
            <FieldError errors={errors} id="s-qty" />
          </div>
          {mode === "restock" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="s-cost">Cost each</Label>
                  <NumberInput id="s-cost" {...invalid(errors, "s-cost")} value={unitCost} onChange={(e) => {
                      clearError(setErrors, "s-cost");
                      setUnitCost(e.target.value);
                    }} />
                  <FieldError errors={errors} id="s-cost" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s-supplier">Supplier</Label>
                  <select id="s-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-8 w-full rounded-lg bg-input px-2 text-sm">
                    <option value="">None</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {canLogExpense && total > 0 ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={logExpense} onChange={(e) => setLogExpense(e.target.checked)} />
                  Also record a {money(activeTenant.currency, total)} expense
                </label>
              ) : null}
            </>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="s-reason">Reason</Label>
              <select id="s-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 w-full rounded-lg bg-input px-2 text-sm">
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="s-note">Note (optional)</Label>
            <Input id="s-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit">{mode === "restock" ? "Add stock" : "Save adjustment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
