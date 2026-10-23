"use client";

import { usePos } from "@/contexts/pos-context";
import { Tenant } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StoreForm } from "./StoreForm";

export function StoreDialog({ target, onClose }: { target: Tenant | "new" | null; onClose: () => void }) {
  const { tenants, handleAddTenant, handleUpdateTenant } = usePos();
  const editing = target && target !== "new" ? target : undefined;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit store" : "Add store"}</DialogTitle>
        </DialogHeader>
        {target ? (
          <StoreForm
            // Remount per target so the fields reset instead of showing the previous store.
            key={editing?.id ?? "new"}
            tenants={tenants}
            store={editing}
            submitLabel={editing ? "Save changes" : "Add store"}
            onSubmit={(tenant) => {
              void (editing ? handleUpdateTenant(tenant) : handleAddTenant(tenant));
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
