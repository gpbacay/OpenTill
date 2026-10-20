"use client";

import { useEffect, useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [logExpense, setLogExpense] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!action) return;
    setQuantity("");
    setUnitCost(String(action.product.costPrice || ""));
    setSupplierId(action.product.supplierId ?? "");
    setReason(REASONS[0]);
    setNote("");
    setLogExpense(true);
    setError("");
  }, [action]);

  if (!action || !activeTenant) return <Dialog open={false} />;
  const { product, mode } = action;
  const qty = parseInt(quantity, 10);
  const cost = parseFloat(unitCost);
  const total = qty > 0 && cost > 0 ? qty * cost : 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!qty) return setError(mode === "restock" ? "Enter how many arrived." : "Enter the change, like 3 or -2.");
    if (mode === "restock" && qty < 0) return setError("A restock can't be negative. Use Adjust to remove stock.");
    if (product.stock + qty < 0) return setError(`Only ${product.stock} in stock, so you can't remove ${-qty}.`);
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
    if (mode === "restock" && logExpense && total > 0) {
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
        <form onSubmit={submit} className="space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-1">
            <Label htmlFor="s-qty">{mode === "restock" ? "Quantity received" : "Change (+ adds, − removes)"}</Label>
            <Input id="s-qty" type="number" step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
          </div>
          {mode === "restock" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="s-cost">Cost each</Label>
                  <Input id="s-cost" type="number" min={0} step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
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
              {total > 0 ? (
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
