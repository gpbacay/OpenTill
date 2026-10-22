"use client";

import { useEffect, useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { uid } from "@/lib/ids";
import { fromDateInput, toDateInput } from "@/lib/periods";
import { Expense, PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomFieldInputs } from "@/components/data-table/custom-columns";
import { FieldError, check, clearError, invalid } from "@/components/FieldError";
import { collect, maxLength, numberError, required, type FieldErrors } from "@/lib/validation";

export const EXPENSE_CATEGORIES = ["Inventory", "Rent", "Utilities", "Salaries", "Transport", "Maintenance", "Marketing", "Supplies", "Other"];

const blank = () => ({
  date: toDateInput(new Date().toISOString()),
  category: "Supplies",
  description: "",
  amount: "",
  paymentMethod: "CASH" as PaymentMethod,
  supplierId: "",
});

export function ExpenseDialog({ target, onClose }: { target: Expense | "new" | null; onClose: () => void }) {
  const { activeTenant } = usePos();
  const { expenses, suppliers, saveExpense, deleteExpense, columnsFor } = useOps();
  const [form, setForm] = useState(blank());
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const editing = target && target !== "new" ? target : null;

  useEffect(() => {
    if (!target) return;
    setErrors({});
    if (target === "new") {
      setForm(blank());
      setCustom({});
    } else {
      setForm({
        date: toDateInput(target.date),
        category: target.category,
        description: target.description,
        amount: String(target.amount),
        paymentMethod: target.paymentMethod,
        supplierId: target.supplierId ?? "",
      });
      setCustom(target.custom ?? {});
    }
  }, [target]);

  if (!activeTenant) return null;
  const set = (field: keyof ReturnType<typeof blank>) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    clearError(setErrors, event.target.id);
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };
  const categories = [...new Set([...EXPENSE_CATEGORIES, ...expenses.map((e) => e.category)])];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const ok = check(
      collect({
        "e-amount": numberError(form.amount, "the amount spent", { required: true, positive: true }),
        "e-date": form.date ? undefined : "Pick the date.",
        "e-category": required(form.category, "Pick or type a category.") ?? maxLength(form.category, 40, "Category"),
        "e-desc": maxLength(form.description, 200, "The description"),
      }),
      setErrors
    );
    if (!ok) return;
    const amount = parseFloat(form.amount);
    saveExpense({
      id: editing?.id ?? uid("exp"),
      tenantId: activeTenant.id,
      date: fromDateInput(form.date),
      category: form.category.trim(),
      description: form.description.trim(),
      amount,
      paymentMethod: form.paymentMethod,
      supplierId: form.supplierId || null,
      custom,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="e-amount" required>Amount</Label>
              <NumberInput id="e-amount" {...invalid(errors, "e-amount")} value={form.amount} onChange={set("amount")} autoFocus />
              <FieldError errors={errors} id="e-amount" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-date" required>Date</Label>
              <Input id="e-date" {...invalid(errors, "e-date")} type="date" value={form.date} onChange={set("date")} />
              <FieldError errors={errors} id="e-date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="e-category" required>Category</Label>
              <Input id="e-category" {...invalid(errors, "e-category")} list="e-categories" value={form.category} onChange={set("category")} />
              <FieldError errors={errors} id="e-category" />
              <datalist id="e-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-pay">Paid with</Label>
              <select id="e-pay" value={form.paymentMethod} onChange={set("paymentMethod")} className="h-8 w-full rounded-lg bg-input px-2 text-sm">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MOBILE_WALLET">Wallet</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="e-desc">What was it for?</Label>
            <Input id="e-desc" {...invalid(errors, "e-desc")} value={form.description} onChange={set("description")} />
            <FieldError errors={errors} id="e-desc" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="e-supplier">Supplier (optional)</Label>
            <select id="e-supplier" value={form.supplierId} onChange={set("supplierId")} className="h-8 w-full rounded-lg bg-input px-2 text-sm">
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <CustomFieldInputs columns={columnsFor("expenses")} values={custom} onChange={setCustom} />
          <DialogFooter>
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={() => {
                  if (window.confirm("Delete this expense?")) {
                    deleteExpense(editing.id);
                    onClose();
                  }
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button type="submit">{editing ? "Save changes" : "Add expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
