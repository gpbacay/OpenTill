"use client";

import { useEffect, useState } from "react";
import { useOps } from "@/contexts/ops-context";
import { usePos } from "@/contexts/pos-context";
import { uid } from "@/lib/ids";
import { Supplier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomFieldInputs } from "@/components/data-table/custom-columns";
import { FieldError, check, clearError, invalid } from "@/components/FieldError";
import { collect, emailError, maxLength, phoneError, required, type FieldErrors } from "@/lib/validation";

const blank = { name: "", contactPerson: "", phone: "", email: "", address: "", notes: "", active: true };

export function SupplierDialog({ target, onClose }: { target: Supplier | "new" | null; onClose: () => void }) {
  const { activeTenant } = usePos();
  const { suppliers, saveSupplier, deleteSupplier, columnsFor } = useOps();
  const [form, setForm] = useState(blank);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const editing = target && target !== "new" ? target : null;

  useEffect(() => {
    if (!target) return;
    setErrors({});
    if (target === "new") {
      setForm(blank);
      setCustom({});
    } else {
      setForm({ ...blank, ...target });
      setCustom(target.custom ?? {});
    }
  }, [target]);

  if (!activeTenant) return null;
  const set = (field: keyof typeof blank) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    clearError(setErrors, event.target.id);
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const duplicate = suppliers.some((s) => s.id !== editing?.id && s.name.toLowerCase() === name.toLowerCase());
    const ok = check(
      collect({
        "sup-name":
          required(name, "Give the supplier a name.") ??
          maxLength(name, 80, "Name") ??
          (duplicate ? `${name} is already in your supplier list.` : undefined),
        "sup-phone": phoneError(form.phone),
        "sup-email": emailError(form.email),
      }),
      setErrors
    );
    if (!ok) return;
    saveSupplier({
      id: editing?.id ?? uid("sup"),
      tenantId: activeTenant.id,
      name,
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      active: form.active,
      custom,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sup-name" required>Name</Label>
            <Input id="sup-name" {...invalid(errors, "sup-name")} value={form.name} onChange={set("name")} autoFocus />
            <FieldError errors={errors} id="sup-name" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="sup-contact">Contact person</Label>
              <Input id="sup-contact" value={form.contactPerson} onChange={set("contactPerson")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sup-phone">Phone</Label>
              <Input id="sup-phone" {...invalid(errors, "sup-phone")} type="tel" value={form.phone} onChange={(e) => {
                // Phone numbers: digits plus + ( ) - . and spaces, never letters.
                e.target.value = e.target.value.replace(/[^\d\s+().-]/g, "");
                set("phone")(e);
              }} />
              <FieldError errors={errors} id="sup-phone" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sup-email">Email</Label>
            <Input id="sup-email" {...invalid(errors, "sup-email")} type="email" value={form.email} onChange={set("email")} />
            <FieldError errors={errors} id="sup-email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sup-address">Address</Label>
            <Input id="sup-address" value={form.address} onChange={set("address")} />
          </div>
          <CustomFieldInputs columns={columnsFor("suppliers")} values={custom} onChange={setCustom} />
          <div className="space-y-1">
            <Label htmlFor="sup-notes">Notes</Label>
            <Textarea id="sup-notes" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
            Active supplier
          </label>
          <DialogFooter>
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={() => {
                  if (window.confirm(`Delete ${editing.name}? Products and expenses keep their history.`)) {
                    deleteSupplier(editing.id);
                    onClose();
                  }
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button type="submit">{editing ? "Save changes" : "Add supplier"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
